import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://voice-commanding-lhnt.onrender.com";

const DEFAULT_LISTS = ['Groceries', 'Dairy', 'Clothes', 'Pharmacy'];

function localParseCommand(text, language = 'en-US', defaultList = 'Groceries') {
  let lower = text.toLowerCase().trim();

  // Normalize common STT garbles & fillers
  lower = lower
    .replace(/\bplz\b|\bpls\b/g, 'please')
    .replace(/\bad\b/g, 'add');

  let targetList = defaultList || 'Groceries';
  const listMatch = lower.match(/(?:to|in|on)\s*(?:my\s*)?([a-zA-Z]+)\s*list/i);
  if (listMatch) {
    targetList = listMatch[1].charAt(0).toUpperCase() + listMatch[1].slice(1).toLowerCase();
    lower = lower.replace(listMatch[0], '').trim();
  }

  // Wake word strip
  const wakeWords = ["hello smart cart", "hey smart cart", "smart cart"];
  for (const wp of wakeWords) {
    if (lower.startsWith(wp)) {
      lower = lower.slice(wp.length).replace(/^[ ,.:!]+/, '').trim();
      break;
    }
  }

  if (!lower || ["hello", "hi", "hey"].includes(lower)) {
    return {
      action: "unknown",
      item: "",
      quantity: "1",
      category: "Groceries",
      target_list: targetList,
      message: "Hello! Smart Cart is ready."
    };
  }

  let action = "add";
  if (/\b(?:clear|saaf)\b/i.test(lower)) action = "clear";
  else if (/\b(?:remove|delete|hatao)\b/i.test(lower)) action = "remove";
  else if (/\b(?:search|find|dhoondo)\b/i.test(lower)) action = "search";
  else if (/\b(?:change|update|modify|badlo)\b/i.test(lower)) action = "modify";
  else if (/\b(?:already|got|bought|checked|picked)\b/i.test(lower)) action = "check";

  // Price max extraction
  let priceMax = null;
  const priceMatch = lower.match(/(?:under|below|less\s+than|<)\s*[₹$]?(\d+(?:\.\d+)?)/i);
  if (priceMatch) {
    priceMax = parseFloat(priceMatch[1]);
  }
  const lowerNoPrice = lower.replace(/(?:under|below|less\s+than|<)\s*[₹$]?\d+(?:\.\d+)?(?:\s*(?:dollars?|rupees?|bucks?))?/gi, '').trim();

  // Comprehensive Quantity & Unit extraction (e.g., "12 dozen", "2 kg", "3 boxes", "500 grams", "1 carton", "6 pieces")
  const UNITS_PATTERN = 'kg|kgs|kilo|kilos|kilogram|kilograms|g|gram|grams|lb|lbs|pound|pounds|liter|liters|litre|litres|l|ml|carton|cartons|bottle|bottles|box|boxes|pack|packs|packet|packets|bag|bags|loaf|loaves|doz|dozen|dozens|piece|pieces|bunch|bunches|head|heads|pair|pairs';
  const qtyRegex = new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:${UNITS_PATTERN})?)`, 'i');
  const qtyMatch = lowerNoPrice.match(qtyRegex);
  const quantity = qtyMatch ? qtyMatch[1].trim() : "1";

  // Strip leading action verbs, conversational fillers, and quantity match
  let itemClean = lowerNoPrice
    .replace(/^(?:can|could)\s+(?:i|you)\s+(?:please\s+)?/i, '')
    .replace(/^(?:please\s+)?(?:add|buy|get|put|need|want|remove|delete|search|find|check|modify|update|change|i\s+would\s+like\s+to\s+add|i\s+want\s+to\s+add|i\s+need\s+to\s+add)\s+/i, '')
    .replace(/^(a|an|the|some|of|me|my)\s+/i, '')
    .trim();

  if (qtyMatch) {
    itemClean = itemClean.replace(qtyMatch[1].trim(), '').trim();
  }

  // Exhaustive Stop Words filter to strip prepositions ("of", "for") and unit names ("dozen", "dozens", "kg") from product name
  const STOP_WORDS = new Set([
    "add", "buy", "get", "need", "want", "put", "remove", "delete", "check", "modify", "update", "change",
    "please", "plz", "pls", "can", "could", "would", "like", "just", "i", "me", "my", "we", "us",
    "already", "alr", "got", "bought", "picked", "up",
    "a", "an", "the", "some", "of", "from", "for", "in", "on", "at", "to", "with", "s", "its", "and", "or",
    "under", "below", "dollars", "dollar", "rupees", "rupee", "bucks", "buck",
    "doz", "dozen", "dozens", "kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "g", "gram", "grams",
    "lb", "lbs", "pound", "pounds", "liter", "liters", "litre", "litres", "l", "ml",
    "carton", "cartons", "bottle", "bottles", "box", "boxes", "pack", "packs", "packet", "packets",
    "bag", "bags", "loaf", "loaves", "piece", "pieces", "bunch", "bunches", "head", "heads", "pair", "pairs"
  ]);

  const words = itemClean.split(/\s+/).filter(w => w && !STOP_WORDS.has(w) && !/^[₹$]?\d+(\.\d+)?$/.test(w));
  const itemName = words.length > 0 ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "Item";

  let category = "Groceries";
  const itemLow = itemName.toLowerCase();
  if (/milk|cheese|yogurt|butter|cream|paneer|curd/i.test(itemLow)) category = "Dairy";
  else if (/apple|apples|banana|bananas|strawberry|strawberries|mango|mangoes|orange|oranges|lemon|lemons|potato|potatoes|tomato|tomatoes|onion|onions|spinach|carrot|carrots|broccoli|grape|grapes/i.test(itemLow)) category = "Produce";
  else if (/bread|loaf|sourdough|croissant|muffin|bagel|bun/i.test(itemLow)) category = "Bakery";
  else if (/rice|oats|flour|sugar|salt|oil|pasta|cereal/i.test(itemLow)) category = "Pantry";

  return {
    action,
    item: action === "clear" ? "" : itemName,
    quantity,
    category,
    price_max: priceMax,
    target_list: targetList,
    message: action === "add" ? `Added ${quantity} ${itemName} to ${targetList} list.` : `Processed command for ${itemName}.`
  };
}

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
      } else {
        setBackendHealth({ online: false, gemini: false, firestore: false });
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
  }, []);

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

  // Process NLU Command (FastAPI with seamless Client-side Fallback)
  const processCommand = useCallback(async (transcriptText, language = 'en-US') => {
    if (!transcriptText || !transcriptText.trim()) return null;
    setIsLoading(true);

    const currentActiveList = activeListRef.current;
    let data = null;

    try {
      const res = await fetch(`${API_BASE}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, language, target_list: currentActiveList })
      });

      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.warn("Backend API unavailable, using client NLU parser:", e);
    }

    if (!data) {
      data = localParseCommand(transcriptText, language, currentActiveList);
    }

    setAiBannerData(data);
    const targetList = data.target_list || currentActiveList || "Groceries";

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
    setIsLoading(false);
    return data;
  }, [showToast, fetchRecommendations]);

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
