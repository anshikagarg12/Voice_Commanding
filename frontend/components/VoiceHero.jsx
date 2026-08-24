'use client';

import React, { useState } from 'react';
import { Mic, Square, Send, Sparkles, Lightbulb, Sprout, Tag, Store, ShoppingBag } from 'lucide-react';

export default function VoiceHero({
  isListening,
  toggleListening,
  statusText,
  statusColor,
  transcript,
  aiBannerData,
  onSendManualText,
  isLoading
}) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onSendManualText(textInput);
    setTextInput('');
  };

  const runSample = (sampleText) => {
    setTextInput(sampleText);
    onSendManualText(sampleText);
  };

  return (
    <section className="relative rounded-3xl p-5 sm:p-6 bg-white border border-stone-200 shadow-sm flex flex-col items-center text-center">
      {/* Mic Button with Radar Rings */}
      <div className="relative my-3 flex items-center justify-center">
        {isListening && (
          <div className="absolute inset-0 -m-6 rounded-full border-2 border-yellow-300/40 animate-ping pointer-events-none" />
        )}
        <div className={`absolute -inset-2 bg-yellow-300 rounded-full blur-xl transition-all duration-500 ${isListening ? 'opacity-90 scale-110' : 'opacity-40'}`} />

        <button
          onClick={toggleListening}
          disabled={isLoading}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl shadow-yellow-400/40 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-yellow-300/30 ${
            isListening
              ? "bg-yellow-500"
              : "bg-yellow-400"
          }`}
        >
          {isListening ? (
            <Square className="w-10 h-10 text-yellow-100 fill-current" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>
      </div>

      {/* Live Speech Waveform Bars */}
      {isListening && (
        <div className="mt-8 flex items-center gap-1.5 h-6">
          <div className="w-1 bg-yellow-300 rounded-full h-3 animate-pulse" />
          <div className="w-1 bg-yellow-400 rounded-full h-5 animate-pulse delay-100" />
          <div className="w-1 bg-yellow-500 rounded-full h-6 animate-pulse delay-200" />
          <div className="w-1 bg-yellow-400 rounded-full h-4 animate-pulse delay-300" />
          <div className="w-1 bg-yellow-200 rounded-full h-2 animate-pulse delay-400" />
        </div>
      )}

      {/* Status Text */}
      <p className={`text-sm font-semibold tracking-wide transition-all ${statusColor}`}>
        {statusText}
      </p>

      {/* Live Transcript Box */}
      <div className="w-full mt-3 p-3 rounded-2xl bg-stone-50 border border-stone-200 min-h-[2.8rem] flex items-center justify-center">
        <p className="text-xs sm:text-sm italic text-stone-500">
          {transcript ? `"${transcript}"` : '"Try saying: Hello Smart Cart, add 2 kg apples!"'}
        </p>
      </div>

      {/* Dynamic Assistant AI Feedback Banner */}
      {aiBannerData && (
        <div className="w-full mt-3 flex flex-col gap-2 p-3 rounded-2xl bg-yellow-50 border border-yellow-100 text-left text-xs animate-fadeIn">
          <div className="flex items-center justify-between text-yellow-700 font-medium">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              {aiBannerData.action === "add" ? "Adding to Cart:" :
               aiBannerData.action === "remove" ? "Removing from Cart:" : "Command Recognized:"}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-yellow-200 text-yellow-800 text-[11px]">
              {aiBannerData.category || "Groceries"}
            </span>
          </div>
          <p className="text-stone-800 font-medium">{aiBannerData.message}</p>

          {/* Live Nearby Store Prices Card */}
          {aiBannerData.nearby_stores && aiBannerData.nearby_stores.length > 0 && (
            <div className="mt-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-600">
                <Store className="w-3.5 h-3.5 text-yellow-500" />
                <span>Live Web Prices & Nearby Store Options:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {aiBannerData.nearby_stores.map((s, idx) => (
                  <div key={idx} className="flex flex-col p-2 rounded-lg bg-stone-50 border border-stone-100 text-xs">
                    <span className="font-bold text-stone-800">{s.store}</span>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-stone-700">{s.name}</span>
                      <span className="text-yellow-600 font-bold">{s.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(aiBannerData.substitute_suggestion || aiBannerData.seasonal_note || aiBannerData.price_max) && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-yellow-500/20 text-[11px] text-yellow-700/80">
              {aiBannerData.substitute_suggestion && (
                <span className="inline-flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-md">
                  <Lightbulb className="w-3 h-3 text-yellow-600" /> Alt: <b>{aiBannerData.substitute_suggestion}</b>
                </span>
              )}
              {aiBannerData.seasonal_note && (
                <span className="inline-flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-md">
                  <Sprout className="w-3 h-3 text-yellow-600" /> <b>{aiBannerData.seasonal_note}</b>
                </span>
              )}
              {aiBannerData.price_max && (
                <span className="inline-flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-md">
                  <Tag className="w-3 h-3 text-yellow-600" /> Max: <b>₹{aiBannerData.price_max}</b>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual Input Form */}
      <form onSubmit={handleSubmit} className="w-full mt-4 flex items-center gap-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Or type command (e.g. 'Where to buy strawberries nearby?')..."
          className="flex-1 px-4 py-2.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={!textInput.trim() || isLoading}
          className="px-4 py-2.5 rounded-2xl bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-white font-medium text-xs sm:text-sm transition-all shadow-md shadow-yellow-500/20 flex items-center gap-1.5 disabled:opacity-50"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Quick Suggestion Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto w-full mt-3 py-1 text-[11px] no-scrollbar">
        <span className="text-stone-500 whitespace-nowrap">Try:</span>
        <button
          onClick={() => runSample('Hello Smart Cart, add 2 kg of bananas')}
          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-600 whitespace-nowrap transition-colors flex items-center gap-1 shadow-sm"
        >
          Hello Smart Cart
        </button>
        <button
          onClick={() => runSample('Where to buy strawberries nearby?')}
          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-yellow-600 whitespace-nowrap transition-colors flex items-center gap-1 font-semibold shadow-sm"
        >
          Stores & Prices Nearby
        </button>
        <button
          onClick={() => runSample('Add almond milk under 4 dollars')}
          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-600 whitespace-nowrap transition-colors shadow-sm"
        >
          Almond milk &lt; $4
        </button>
        <button
          onClick={() => runSample('I alr got milk')}
          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-600 whitespace-nowrap transition-colors shadow-sm"
        >
          I alr got milk
        </button>
      </div>
    </section>
  );
}
