'use client';

import React from 'react';
import { ShoppingBag, Mic, Sparkles, SlidersHorizontal } from 'lucide-react';

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  isListening,
  itemCount
}) {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 px-4 py-2 flex items-center justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button
        onClick={() => setActiveTab('cart')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
          activeTab === 'cart' || activeTab === 'all' ? 'text-yellow-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        <div className="relative">
          <ShoppingBag className={`w-5 h-5 ${activeTab === 'cart' || activeTab === 'all' ? 'text-yellow-500' : ''}`} />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-yellow-500 text-white text-[9px] font-extrabold flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </div>
        <span>Cart</span>
      </button>

      <button
        onClick={() => setActiveTab('voice')}
        className={`relative -top-4 flex flex-col items-center justify-center w-14 h-14 rounded-full border-4 shadow-lg transition-all ${
          activeTab === 'voice' 
            ? 'bg-purple-500 border-purple-300 text-white shadow-purple-200' 
            : 'bg-white border-stone-100 text-stone-500 shadow-stone-200'
        }`}
      >
        <Mic className={`w-6 h-6 ${activeTab === 'voice' ? 'animate-pulse' : ''}`} />
      </button>

      <button
        onClick={() => setActiveTab('recs')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
          activeTab === 'recs' ? 'text-purple-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        <Sparkles className="w-5 h-5" />
        <span>Recs</span>
      </button>

      <button
        onClick={() => setActiveTab('all')}
        className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
          activeTab === 'all' ? 'text-purple-600 font-bold scale-105' : 'text-stone-400 hover:text-stone-600'
        }`}
      >
        <SlidersHorizontal className="w-5 h-5" />
        <span>Full View</span>
      </button>
    </nav>
  );
}
