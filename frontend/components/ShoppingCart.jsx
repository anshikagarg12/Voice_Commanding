'use client';

import React, { useState } from 'react';
import { ShoppingCart as CartIcon, Trash2, X, Search, Plus, FolderPlus } from 'lucide-react';

const CATEGORY_MAP = {
  produce: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  fruits: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  dairy: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  bakery: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  pantry: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  beverages: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  household: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  snacks: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  meat: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  clothes: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  clothing: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  pharmacy: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  hardware: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" },
  default: { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: "" }
};

function getCategoryMeta(categoryName) {
  if (!categoryName) return CATEGORY_MAP.default;
  const key = categoryName.toLowerCase().trim();
  return CATEGORY_MAP[key] || CATEGORY_MAP.default;
}

export default function ShoppingCart({
  items,
  activeList,
  setActiveList,
  availableLists,
  addNewList,
  activeMaxPrice,
  clearPriceFilter,
  toggleItemChecked,
  removeItem,
  clearAllItems
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showAddListForm, setShowAddListForm] = useState(false);

  const handleCreateList = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    addNewList(newListName);
    setNewListName('');
    setShowAddListForm(false);
  };

  // Filter items by active list tab (or 'All' option)
  // Also filter out any corrupt items missing the `item` field
  let displayedItems = (items || []).filter(i => i && i.item);
  if (activeList !== 'All') {
    displayedItems = displayedItems.filter(i =>
      (i.list_name || i.category || 'Groceries').toLowerCase() === activeList.toLowerCase()
    );
  }

  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    displayedItems = displayedItems.filter(i =>
      (i.item || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
    );
  }

  if (activeMaxPrice !== null) {
    displayedItems = displayedItems.filter(i => !i.price_max || i.price_max <= activeMaxPrice);
  }

  return (
    <section className="rounded-3xl p-5 bg-white border border-stone-200 shadow-sm space-y-4">
      {/* List Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Shopping Lists</span>
          <button
            onClick={() => setShowAddListForm(prev => !prev)}
            className="text-[11px] text-purple-500 hover:text-purple-600 font-semibold flex items-center gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ New List</span>
          </button>
        </div>

        {/* List Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
          <button
            onClick={() => setActiveList('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
              activeList === 'All'
                ? 'bg-yellow-500 text-white shadow-yellow-500/30'
                : 'bg-stone-50 text-stone-500 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            All Items ({items.length})
          </button>

          {availableLists.map((listName) => {
            const count = items.filter(i => (i.list_name || i.category || 'Groceries').toLowerCase() === listName.toLowerCase()).length;
            const meta = getCategoryMeta(listName);
            return (
              <button
                key={listName}
                onClick={() => setActiveList(listName)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-sm ${
                  activeList.toLowerCase() === listName.toLowerCase()
                    ? 'bg-yellow-500 text-white shadow-yellow-500/30'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{listName}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeList.toLowerCase() === listName.toLowerCase() ? 'bg-yellow-100 text-yellow-700' : 'bg-stone-100 text-stone-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Custom List Input */}
        {showAddListForm && (
          <form onSubmit={handleCreateList} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Custom list name (e.g. Clothes, Pharmacy)..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-stone-50 border border-yellow-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none shadow-sm"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50 disabled:hover:bg-yellow-500"
            >
              Create
            </button>
          </form>
        )}
      </div>

      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-stone-200">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-stone-800 font-heading">
            {activeList === 'All' ? 'All Cart Items' : `${activeList} List`}
          </h2>
          <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 font-bold px-2.5 py-0.5 rounded-full">
            {activeList === 'All' ? 'Everything' : activeList}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeMaxPrice !== null && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-600 text-xs font-semibold shadow-sm">
              <span>Under ₹{activeMaxPrice}</span>
              <button onClick={clearPriceFilter} className="hover:text-yellow-700 font-bold ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Filter Input */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search in list..."
              className="pl-7 pr-2.5 py-1 w-24 sm:w-32 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-yellow-300 shadow-sm"
            />
          </div>

          <button
            onClick={() => clearAllItems(activeList !== 'All' ? activeList : undefined)}
            className="text-[11px] font-medium text-yellow-600 hover:text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-50 transition-colors"
          >
            Clear List
          </button>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-2.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
        {displayedItems.length === 0 ? (
          <div className="py-8 text-center text-stone-400 flex flex-col items-center justify-center gap-2 border border-dashed border-stone-200 rounded-2xl">
            <CartIcon className="w-8 h-8 opacity-40 text-stone-400" />
            <p className="text-sm font-medium text-stone-500">No items in {activeList} list</p>
            <p className="text-xs text-stone-400">Say "Add 2 shirts to Clothes list" or type command</p>
          </div>
        ) : (
          displayedItems.map((item) => {
            const meta = getCategoryMeta(item.list_name || item.category);
            return (
              <div
                key={item.id || item.item}
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-yellow-200 shadow-sm transition-all duration-200"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Completion Checkbox */}
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    onChange={() => toggleItemChecked(item.item)}
                    className="mt-1 w-4 h-4 rounded-md accent-yellow-500 bg-white border-stone-300 cursor-pointer"
                  />

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm truncate ${item.checked ? 'line-through opacity-50 text-stone-400' : 'text-stone-800'}`}>
                        {item.item}
                      </span>
                      <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-200">
                        {item.quantity}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-medium ${meta.color}`}>
                        <span>{meta.icon}</span> <span>{item.list_name || item.category}</span>
                      </span>
                      {item.price_max && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-600 border border-yellow-200 font-medium">
                          &lt; ₹{item.price_max}
                        </span>
                      )}
                    </div>

                    {/* AI Suggestions & Notes */}
                    {item.substitute_suggestion && (
                      <p className="text-[11px] text-yellow-500 mt-1 flex items-center gap-1">
                        <span>Suggestion:</span> <span className="text-yellow-600 font-medium">{item.substitute_suggestion}</span>
                      </p>
                    )}
                    {item.seasonal_note && (
                      <p className="text-[11px] text-yellow-500 mt-0.5 flex items-center gap-1">
                        <span>Note:</span> <span className="text-yellow-600 font-medium">{item.seasonal_note}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => removeItem(item.item)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
