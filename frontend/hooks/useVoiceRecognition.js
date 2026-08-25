import { useState, useEffect, useRef, useCallback } from 'react';

const WAKE_PHRASES = [
  "hello smart cart", "hello smart-cart", "hello smartcard", "hello smart card", "hello smart kart",
  "hey smart cart", "hey smart-cart", "hey smartcard", "hey smart card",
  "ok smart cart", "hi smart cart", "smart cart", "smartcard", "smart card", "smart kart"
];

let _sharedAudioCtx = null;
function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!_sharedAudioCtx || _sharedAudioCtx.state === 'closed') {
      _sharedAudioCtx = new AudioCtx();
    }
    return _sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

async function playChimeSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);
  } catch (e) {}
}

export function useVoiceRecognition(onCommandDetected) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusText, setStatusText] = useState('Tap mic or say "Hello Smart Cart"');
  const [statusColor, setStatusColor] = useState('text-yellow-500');
  const [wakeWordMode, setWakeWordMode] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognitionRef = useRef(null);
  const onCommandDetectedRef = useRef(onCommandDetected);
  const wakeWordModeRef = useRef(wakeWordMode);
  const isListeningRef = useRef(isListening);
  const voicesRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const accumulatedSpeechRef = useRef('');

  useEffect(() => {
    onCommandDetectedRef.current = onCommandDetected;
  }, [onCommandDetected]);

  useEffect(() => {
    wakeWordModeRef.current = wakeWordMode;
  }, [wakeWordMode]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const detectWakeWord = useCallback((rawText) => {
    if (!rawText) return { found: false, command: "" };
    const lower = rawText.toLowerCase().trim();
    for (const phrase of WAKE_PHRASES) {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        const remaining = lower.substring(idx + phrase.length).replace(/^[\s,.:!]+/, '').trim();
        return { found: true, phrase, command: remaining };
      }
    }
    return { found: false, command: rawText };
  }, []);

  const speakResponse = useCallback((text) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    playChimeSound();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = voicesRef.current;
    if (voices && voices.length > 0) {
      const prefix = selectedLang.split('-')[0];
      const match = voices.find(v => v.lang === selectedLang) || voices.find(v => v.lang.startsWith(prefix));
      if (match) {
        utterance.voice = match;
      }
    }

    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, selectedLang]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const loaded = window.speechSynthesis.getVoices();
      if (loaded && loaded.length > 0) {
        voicesRef.current = loaded;
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const processCapturedSentence = useCallback((sentenceText) => {
    if (!sentenceText || !sentenceText.trim()) return;
    const cleanText = sentenceText.trim();
    
    const wakeCheck = detectWakeWord(cleanText);

    if (wakeCheck.found) {
      setStatusText("⚡ Wake word detected! Processing...");
      setStatusColor("text-yellow-600");
      const cmdToRun = wakeCheck.command ? wakeCheck.command : null;
      if (cmdToRun && onCommandDetectedRef.current) {
        onCommandDetectedRef.current(cmdToRun);
      } else if (!cmdToRun) {
        setStatusText('👋 Hey! Say a command after the wake word.');
        setStatusColor('text-yellow-500');
      }
    } else {
      setStatusText("Analyzing command...");
      setStatusColor("text-yellow-500");
      if (onCommandDetectedRef.current) {
        onCommandDetectedRef.current(cleanText);
      }
    }
  }, [detectWakeWord]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText('Speech recognition not supported in browser. Use text input.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = selectedLang;

    rec.onstart = () => {
      setIsListening(true);
      accumulatedSpeechRef.current = '';
      setStatusText("Listening... Speak your command smoothly");
      setStatusColor("text-yellow-600");
    };

    rec.onresult = (event) => {
      let fullFinal = '';
      let fullInterim = '';

      for (let i = 0; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          fullFinal += (fullFinal ? ' ' : '') + text;
        } else {
          fullInterim += (fullInterim ? ' ' : '') + text;
        }
      }

      const fullSentence = (fullFinal + ' ' + fullInterim).trim();
      if (fullSentence) {
        setTranscript(fullSentence);
        accumulatedSpeechRef.current = fullSentence;
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      if (fullSentence) {
        silenceTimerRef.current = setTimeout(() => {
          if (accumulatedSpeechRef.current) {
            const captured = accumulatedSpeechRef.current;
            accumulatedSpeechRef.current = '';
            processCapturedSentence(captured);
            try { rec.stop(); } catch (e) {}
          }
        }, 1200);
      }
    };

    rec.onerror = (event) => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      console.warn("Speech recognition event error:", event.error);
      if (event.error === "aborted") {
        return;
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setWakeWordMode(false);
        wakeWordModeRef.current = false;
        setStatusText("⚠️ Mic blocked! Click lock icon 🔒 in browser URL bar to allow mic.");
        setStatusColor("text-yellow-500");
      } else if (event.error === "no-speech") {
        setStatusText('No speech detected. Tap mic to speak');
        setStatusColor("text-yellow-500");
      } else if (event.error === "network") {
        setStatusText("Network glitch. Retrying mic...");
        setStatusColor("text-yellow-500");
        rec._networkRetrying = true;
        setTimeout(() => {
          rec._networkRetrying = false;
          if (wakeWordModeRef.current) {
            try { rec.start(); } catch (e) {}
          }
        }, 500);
      } else {
        setStatusText(`Mic status: ${event.error}`);
        setStatusColor("text-yellow-400");
      }
    };

    rec.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (accumulatedSpeechRef.current) {
        const captured = accumulatedSpeechRef.current;
        accumulatedSpeechRef.current = '';
        processCapturedSentence(captured);
      }

      if (wakeWordModeRef.current && !rec._networkRetrying) {
        setTimeout(() => {
          try {
            rec.start();
          } catch (e) {}
        }, 150);
      } else if (!wakeWordModeRef.current) {
        setStatusText('Tap mic or say "Hello Smart Cart"');
        setStatusColor("text-yellow-500");
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      rec._networkRetrying = true;
      try {
        rec.stop();
      } catch (e) {}
    };
  }, [selectedLang, detectWakeWord, processCapturedSentence]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Brave.");
      return;
    }

    playChimeSound();

    if (isListeningRef.current) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (accumulatedSpeechRef.current) {
        const captured = accumulatedSpeechRef.current;
        accumulatedSpeechRef.current = '';
        processCapturedSentence(captured);
      }
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      accumulatedSpeechRef.current = '';
      setTranscript('');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  };

  const toggleWakeWord = () => {
    setWakeWordMode(prev => {
      const next = !prev;
      if (next && recognitionRef.current && !isListeningRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      } else if (!next && recognitionRef.current && isListeningRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      return next;
    });
  };

  const toggleTts = () => {
    setTtsEnabled(prev => {
      if (prev && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return !prev;
    });
  };

  return {
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
  };
}
