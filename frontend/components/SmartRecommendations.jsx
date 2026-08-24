'use client';

import React from 'react';
import { Sparkles, RefreshCw, Plus, AlertTriangle, Sprout, RefreshCcw, Heart } from 'lucide-react';

export default function SmartRecommendations({
  recommendations,
  onAddRecommendedItem,
  onRefresh,
  isLoading
}) {
  const getBadgeMeta = (badgeTag) => {
    const b = (badgeTag || "").toLowerCase();
    if (b.includes("low")) {
      return { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <AlertTriangle className="w-3 h-3" />, label: "Low Stock" };
    } else if (b.includes("season")) {
      return { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <Sprout className="w-3 h-3" />, label: "Seasonal" };
    } else if (b.includes("substitut")) {
      return { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <RefreshCcw className="w-3 h-3" />, label: "Substitute" };
    } else {
      return { color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <Heart className="w-3 h-3" />, label: "Pairing" };
    }
  };

  return (
    <section className="rounded-3xl p-5 bg-white border border-stone-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-center text-sm">
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-800 font-heading">Smart Recommendations</h2>
            <p className="text-[11px] text-stone-500">AI-curated staples, seasonal picks & substitutes</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-xl bg-stone-50 hover:bg-yellow-50 border border-stone-200 text-yellow-600 hover:text-yellow-700 transition-all text-xs flex items-center gap-1 font-medium shadow-sm"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[6rem]">
        {isLoading ? (
          <p className="text-xs text-stone-500 col-span-2 py-3 text-center">Loading smart AI recommendations...</p>
        ) : recommendations.length === 0 ? (
          <p className="text-xs text-stone-500 col-span-2 py-3 text-center">No recommendations at the moment.</p>
        ) : (
          recommendations.map((rec, idx) => {
            const meta = getBadgeMeta(rec.badge);
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50 border border-stone-200 hover:border-yellow-200 transition-all shadow-sm"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-stone-800 truncate">{rec.item}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 ${meta.color}`}>
                      {meta.icon}
                      <span>{rec.label || rec.badge}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5 truncate" title={rec.reason}>
                    {rec.reason}
                  </p>
                </div>
                <button
                  onClick={() => onAddRecommendedItem(rec.item, rec.quantity || 1, rec.category || "Groceries")}
                  className="px-2.5 py-1 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-white text-xs font-medium whitespace-nowrap transition-all shadow-sm flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
