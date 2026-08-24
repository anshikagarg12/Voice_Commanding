'use client';

import React from 'react';
import { ShoppingBag, Volume2, VolumeX, Globe, Zap, Megaphone } from 'lucide-react';

export default function Header({
  selectedLang,
  setSelectedLang,
  wakeWordMode,
  toggleWakeWord,
  ttsEnabled,
  toggleTts,
  speakResponse,
  backendHealth
}) {
  const handleTestAudio = () => {
    if (speakResponse) {
      speakResponse("Hello! Voice Shopping Assistant speaker is active and working.");
    }
  };

  return (
    <header className="flex items-center justify-between pt-2 pb-2 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-200/50">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-800 font-heading">
            Voice Cart AI
          </h1>
          <p className="text-xs text-stone-400 font-medium">Cross-Platform Web & Mobile Assistant</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Wake Word Badge */}
        <button
          onClick={toggleWakeWord}
          title="Toggle Hands-Free Wake-Word ('Hello Smart Cart')"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
            wakeWordMode
              ? "bg-pink-100 hover:bg-pink-200 border-pink-200 text-pink-600"
              : "bg-white/60 hover:bg-white/80 border-stone-200 text-stone-500"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${wakeWordMode ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'}`} />
          <Zap className="w-3.5 h-3.5" />
          <span>{wakeWordMode ? 'Say "Hello Smart-Cart"' : 'Wake-Word Off'}</span>
        </button>

        {/* Language Selector */}
        <div className="relative flex items-center">
          <Globe className="w-3.5 h-3.5 absolute left-2 text-stone-400 pointer-events-none" />
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            title="Select Voice Language"
            className="pl-7 pr-2 py-1.5 bg-white/70 hover:bg-white/90 border border-stone-200 text-stone-700 text-xs rounded-xl focus:outline-none focus:border-pink-300 cursor-pointer font-medium"
          >
            <option value="en-US">🇺🇸 EN</option>
            <option value="es-ES">🇪🇸 ES</option>
            <option value="fr-FR">🇫🇷 FR</option>
            <option value="de-DE">🇩🇪 DE</option>
            <option value="hi-IN">🇮🇳 HI</option>
            <option value="ja-JP">🇯🇵 JA</option>
            <option value="zh-CN">🇨🇳 ZH</option>
          </select>
        </div>

        {/* TTS Toggle & Test Audio */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTts}
            title="Toggle Voice Feedback"
            className="p-2 rounded-xl bg-white/70 hover:bg-white/90 border border-stone-200 text-stone-600 transition-all shadow-sm"
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-rose-400 opacity-60" />}
          </button>
          <button
            onClick={handleTestAudio}
            title="Test Voice Speaker"
            className="px-2 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-600 text-xs font-medium flex items-center gap-1 transition-all shadow-sm"
          >
            <Megaphone className="w-3.5 h-3.5 text-pink-500" />
            <span className="hidden sm:inline">Test Voice</span>
          </button>
        </div>

        {/* Backend Online Tag */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium shadow-sm ${
          backendHealth.online
            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
            : "bg-rose-50 border-rose-200 text-rose-600"
        }`}>
          <span className={`w-2 h-2 rounded-full ${backendHealth.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span>{backendHealth.online ? `AI Online${backendHealth.firestore ? ' • Sync' : ''}` : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
