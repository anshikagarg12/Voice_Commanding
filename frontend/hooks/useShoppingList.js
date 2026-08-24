import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = "https://voice-commanding-94wl.onrender.com";

const DEFAULT_LISTS = ['Groceries', 'Dairy', 'Clothes', 'Pharmacy'];

export function useShoppingList() {
  const [items, setItems] = useState([]);
  const [activeList, setActiveList] = useState('All');
  const [availableLists, setAvailableLists] = useState(DEFAULT_LISTS);
  const [recommendations, setRecommendations] = useState([]);
  const [activeMaxPrice, setActiveMaxPrice] = useState(null);
  const [aiBannerData, setAiBannerData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [backendHealth, setBackendHealth] = useState({ online: false, gemini: false, firestore: false });
  const [isLoading, setIsLoading] = useState(false);

  // Refs to break circular deps
  const activeListRef = useRef(activeList);
  const itemsRef = useRef(items);
  const toastTimerRef = useRef(null);

  useEffect(() => { activeListRef.current = activeList; }, [activeList]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const showToast = useCallback((msg) => {
    // Clear any pending toast dismissal to prevent a newer toast being wiped early
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  // Initial load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const localData = localStorage.getItem("voice_shopping_cart");
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            // Filter out corrupt entries missing the `item` field
            const clean = parsed.filter(i => i && typeof i.item === 'string' && i.item.trim());
            setItems(clean);
          }
        }
        const customLists = localStorage.getItem("voice_custom_lists");
        if (customLists) {
          const parsedLists = JSON.parse(customLists);
          if (Array.isArray(parsedLists) && parsedLists.length > 0) {
            setAvailableLists(parsedLists);
          }
        }
      } catch (e) {
        console.warn("Failed to parse local shopping cart:", e);
      }
    }
  }, []);

  // Save items and custom lists to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && items) {
      try {
        localStorage.setItem("voice_shopping_cart", JSON.stringify(items));
      } catch (e) {}
    }
  }, [items]);

  useEffect(() => {
    if (typeof window !== 'undefined' && availableLists) {
      try {
        localStorage.setItem("voice_custom_lists", JSON.stringify(availableLists));
      } catch (e) {}
    }
  }, [availableLists]);

  // Check health on load
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendHealth({
          online: data.status === "healthy",
          gemini: !!data.gemini_configured,
          firestore: !!data.firestore_configured
        });
      }
    } catch (e) {
      setBackendHealth({ online: false, gemini: false, firestore: false });
    }
  }, []);

  // Load server Firestore list
  const loadServerList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/get-list`);
      if (res.ok) {
        const serverItems = await res.json();
        if (Array.isArray(serverItems) && serverItems.length > 0) {
          setItems(serverItems.map((item, idx) => ({
            id: item.id || Date.now() + idx,
            item: item.item,
            quantity: item.quantity || "1",
            category: item.category || "Groceries",
            list_name: item.list_name || item.category || "Groceries",
            price_max: item.price_max || null,
            substitute_suggestion: item.substitute_suggestion || null,
            seasonal_note: item.seasonal_note || null,
            checked: !!item.checked
          })));
        }
      }
    } catch (e) {
      console.warn("Could not fetch Firestore list:", e);
    }
  }, []);

  // Fetch AI Recommendations — stable, reads items via ref
  const fetchRecommendations = useCallback(async (lang = 'en-US') => {
    const currentNames = itemsRef.current.map(i => i.item);
    if (currentNames.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_items: currentNames, language: lang })
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (e) {
      console.warn("Error fetching recommendations:", e);
    }
  }, []); // stable — uses ref

  useEffect(() => {
    checkHealth();
    loadServerList();
  }, [checkHealth, loadServerList]);

  // Create new custom list
  const addNewList = useCallback((listName) => {
    const trimmed = listName.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    setAvailableLists(prev => {
      if (!prev.includes(formatted)) {
        return [...prev, formatted];
      }
      return prev;
    });
    setActiveList(formatted);
    showToast(`Created new list "${formatted}"`);
  }, [showToast]);

  // Process NLU Command with FastAPI Backend — stable, reads activeList via ref
  const processCommand = useCallback(async (transcriptText, language = 'en-US') => {
    if (!transcriptText || !transcriptText.trim()) return null;
    setIsLoading(true);

    const currentActiveList = activeListRef.current;

    try {
      const res = await fetch(`${API_BASE}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, language, target_list: currentActiveList })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server Error ${res.status}`);
      }

      const data = await res.json();
      setAiBannerData(data);

      const targetList = data.target_list || currentActiveList || "Groceries";

      // Dynamically add target list to availableLists if new
      setAvailableLists(prev => {
        if (!prev.includes(targetList)) {
          return [...prev, targetList];
        }
        return prev;
      });

      if (data.price_max) {
        setActiveMaxPrice(data.price_max);
      }

      if (data.action === "add" && data.item) {
        setItems(prev => {
          const idx = prev.findIndex(i => i && i.item && i.item.toLowerCase() === data.item.toLowerCase() && (i.list_name || "Groceries").toLowerCase() === targetList.toLowerCase());
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              quantity: data.quantity || updated[idx].quantity,
              substitute_suggestion: data.substitute_suggestion || updated[idx].substitute_suggestion,
              seasonal_note: data.seasonal_note || updated[idx].seasonal_note,
              price_max: data.price_max || updated[idx].price_max
            };
            return updated;
          } else {
            return [{
              id: Date.now(),
              item: data.item,
              quantity: data.quantity || "1",
              category: data.category || "Groceries",
              list_name: targetList,
              price_max: data.price_max,
              substitute_suggestion: data.substitute_suggestion,
              seasonal_note: data.seasonal_note,
              checked: false
            }, ...prev];
          }
        });
        showToast(`Added "${data.item}" to ${targetList} list`);
      } else if (data.action === "modify" && data.item) {
        setItems(prev => {
          const idx = prev.findIndex(i => i && i.item && i.item.toLowerCase().includes(data.item.toLowerCase()));
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              quantity: data.quantity || updated[idx].quantity,
              category: data.category || updated[idx].category,
              price_max: data.price_max || updated[idx].price_max
            };
            return updated;
          } else {
            return [{
              id: Date.now(),
              item: data.item,
              quantity: data.quantity || "1",
              category: data.category || "Groceries",
              list_name: targetList,
              price_max: data.price_max,
              checked: false
            }, ...prev];
          }
        });
        showToast(`Updated "${data.item}" quantity to ${data.quantity}`);
      } else if (data.action === "check" && data.item) {
        setItems(prev => {
          const idx = prev.findIndex(i => i && i.item && i.item.toLowerCase().includes(data.item.toLowerCase()));
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], checked: true };
            return updated;
          } else {
            return [{
              id: Date.now(),
              item: data.item,
              quantity: data.quantity || "1",
              category: data.category || "Groceries",
              list_name: targetList,
              checked: true
            }, ...prev];
          }
        });
        showToast(`Checked off "${data.item}"`);
      } else if (data.action === "remove" && data.item) {
        setItems(prev => prev.filter(i => !i || !i.item || !i.item.toLowerCase().includes(data.item.toLowerCase())));
        showToast(`Removed "${data.item}"`);
      } else if (data.action === "clear") {
        const listToClear = currentActiveList || "Groceries";
        setItems(prev => prev.filter(i => (i.list_name || "Groceries").toLowerCase() !== listToClear.toLowerCase()));
        showToast(`Cleared ${listToClear} list`);
      } else if (data.action === "search") {
        showToast(`Searching for "${data.item}"`);
      } else {
        showToast(`Command: ${data.item || "Processed"}`);
      }

      fetchRecommendations(language);
      return data;
    } catch (e) {
      showToast(`❌ ${e.message}`);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [showToast, fetchRecommendations]); // stable deps only

  const toggleItemChecked = useCallback(async (itemName) => {
    if (!itemName) return;
    setItems(prev => prev.map(i => {
      if (i && i.item && i.item.toLowerCase() === itemName.toLowerCase()) {
        const nextState = !i.checked;
        fetch(`${API_BASE}/api/item/${encodeURIComponent(i.item)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: nextState })
        }).catch(() => {});
        return { ...i, checked: nextState };
      }
      return i;
    }));
  }, []);

  const removeItem = useCallback(async (itemName) => {
    if (!itemName) return;
    setItems(prev => prev.filter(i => !i.item || i.item.toLowerCase() !== itemName.toLowerCase()));
    showToast(`Removed "${itemName}"`);
    fetch(`${API_BASE}/api/item/${encodeURIComponent(itemName)}`, { method: "DELETE" }).catch(() => {});
  }, [showToast]);

  const clearAllItems = useCallback(async () => {
    const listToClear = activeListRef.current;
    // Count only items belonging to the active list
    const listItems = listToClear === 'All'
      ? itemsRef.current
      : itemsRef.current.filter(i => (i.list_name || 'Groceries').toLowerCase() === listToClear.toLowerCase());
    
    if (listItems.length === 0) return;
    
    if (window.confirm(`Are you sure you want to clear the ${listToClear} shopping list?`)) {
      if (listToClear === 'All') {
        setItems([]);
        fetch(`${API_BASE}/api/clear-list`, { method: "DELETE" }).catch(() => {});
      } else {
        setItems(prev => prev.filter(i => (i.list_name || "Groceries").toLowerCase() !== listToClear.toLowerCase()));
        // Delete each item from the backend so they don't reappear
        listItems.forEach(item => {
          if (item && item.item) {
            fetch(`${API_BASE}/api/item/${encodeURIComponent(item.item)}`, { method: "DELETE" }).catch(() => {});
          }
        });
      }
      showToast(`${listToClear} list cleared`);
    }
  }, [showToast]);

  const addRecommendedItem = useCallback(async (recItem, quantity, category) => {
    const currentActiveList = activeListRef.current === 'All' ? 'Groceries' : activeListRef.current;
    const exists = itemsRef.current.some(i => i.item.toLowerCase() === recItem.toLowerCase() && (i.list_name || "Groceries").toLowerCase() === currentActiveList.toLowerCase());
    if (!exists) {
      setItems(prev => [{
        id: Date.now(),
        item: recItem,
        quantity: quantity || "1",
        category: category || "Groceries",
        list_name: currentActiveList,
        checked: false
      }, ...prev]);
      showToast(`Added "${recItem}" to ${currentActiveList}`);
    } else {
      showToast(`"${recItem}" is already in your ${currentActiveList} list`);
    }
  }, [showToast]);

  return {
    items,
    activeList,
    setActiveList,
    availableLists,
    addNewList,
    recommendations,
    activeMaxPrice,
    setActiveMaxPrice,
    aiBannerData,
    toastMessage,
    backendHealth,
    isLoading,
    processCommand,
    toggleItemChecked,
    removeItem,
    clearAllItems,
    addRecommendedItem,
    fetchRecommendations,
    showToast
  };
}
