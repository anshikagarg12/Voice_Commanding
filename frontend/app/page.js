'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from '../components/Header';
import VoiceHero from '../components/VoiceHero';
import SmartRecommendations from '../components/SmartRecommendations';
import ShoppingCart from '../components/ShoppingCart';
import MobileBottomNav from '../components/MobileBottomNav';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useShoppingList } from '../hooks/useShoppingList';

export default function Home() {
  const [mobileTab, setMobileTab] = useState('all');

  const {
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
  } = useShoppingList();

  // Mutable refs to avoid circular useCallback deps
  const processCommandRef = useRef(processCommand);
  const speakResponseRef = useRef(null);
  const setSelectedLangRef = useRef(null);
  const selectedLangRef = useRef('en-US');

  useEffect(() => { processCommandRef.current = processCommand; }, [processCommand]);

  // A single stable callback — uses only refs, never changes identity
  const handleCommandDetected = useCallback(async (commandText) => {
    try {
      const data = await processCommandRef.current(commandText, selectedLangRef.current);
      if (data) {
        if (data.action === "language_switch") {
          const langMap = { en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", hi: "hi-IN", ja: "ja-JP", zh: "zh-CN" };
          const targetLang = langMap[data.language] || "en-US";
          if (setSelectedLangRef.current) setSelectedLangRef.current(targetLang);
        }
        if (data.message && speakResponseRef.current) {
          speakResponseRef.current(data.message);
        }
      }
    } catch (e) {
      console.warn("Command processing error:", e);
    }
  }, []);

  const {
    isListening,
    transcript,
    statusText,
    statusColor,
    wakeWordMode,
    selectedLang,
    setSelectedLang,
    ttsEnabled,
    toggleListening,
    toggleWakeWord,
    toggleTts,
    speakResponse,
    setTranscript
  } = useVoiceRecognition(handleCommandDetected);

  // Keep refs in sync after hook values are available
  useEffect(() => { speakResponseRef.current = speakResponse; }, [speakResponse]);
  useEffect(() => { setSelectedLangRef.current = setSelectedLang; }, [setSelectedLang]);
  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);

  // Stable manual text handler
  const handleManualText = useCallback(async (text) => {
    setTranscript(text);
    handleCommandDetected(text);
  }, [setTranscript, handleCommandDetected]);

  const clearPriceFilter = useCallback(() => {
    setActiveMaxPrice(null);
  }, [setActiveMaxPrice]);

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-start p-3 sm:p-6 relative selection:bg-yellow-400 selection:text-white bg-white text-stone-800">
      {/* Background Glow Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-yellow-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-yellow-300/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-yellow-100/40 rounded-full blur-3xl" />
      </div>

      {/* Main Container */}
      <main className="w-full max-w-[1400px] mx-auto relative z-10 flex flex-col lg:grid lg:grid-cols-12 lg:items-start gap-5 pt-2 pb-20 sm:pb-12">
        {/* Header */}
        <div className="lg:col-span-12">
          <Header
            selectedLang={selectedLang}
            setSelectedLang={setSelectedLang}
            wakeWordMode={wakeWordMode}
            toggleWakeWord={toggleWakeWord}
            ttsEnabled={ttsEnabled}
            toggleTts={toggleTts}
            speakResponse={speakResponse}
            backendHealth={backendHealth}
          />
        </div>

        {/* Left Column: Voice & Recommendations (Stacked) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Voice AI Hero */}
          <div className={mobileTab === 'all' || mobileTab === 'voice' ? 'block' : 'hidden sm:block'}>
            <VoiceHero
              isListening={isListening}
              toggleListening={toggleListening}
              statusText={statusText}
              statusColor={statusColor}
              transcript={transcript}
              aiBannerData={aiBannerData}
              onSendManualText={handleManualText}
              isLoading={isLoading}
            />
          </div>

          {/* Smart Recommendations */}
          <div className={mobileTab === 'all' || mobileTab === 'recs' ? 'block' : 'hidden sm:block'}>
            <SmartRecommendations
              recommendations={recommendations}
              onAddRecommendedItem={addRecommendedItem}
              onRefresh={() => fetchRecommendations(selectedLang)}
            />
          </div>
        </div>

        {/* Right Column: Shopping Cart */}
        <div className={`lg:col-span-8 h-full ${mobileTab === 'all' || mobileTab === 'cart' ? 'block' : 'hidden sm:block'}`}>
          <ShoppingCart
            items={items}
            activeList={activeList}
            setActiveList={setActiveList}
            availableLists={availableLists}
            addNewList={addNewList}
            activeMaxPrice={activeMaxPrice}
            clearPriceFilter={clearPriceFilter}
            toggleItemChecked={toggleItemChecked}
            removeItem={removeItem}
            clearAllItems={clearAllItems}
          />
        </div>
      </main>

      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-5 right-5 bg-white/95 border border-stone-200 text-stone-800 px-4 py-3 rounded-2xl shadow-xl shadow-yellow-100/50 flex items-center gap-3 z-50 animate-bounce text-xs sm:text-sm font-medium">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Native Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={mobileTab}
        setActiveTab={setMobileTab}
        isListening={isListening}
        itemCount={items.length}
      />
    </div>
  );
}
