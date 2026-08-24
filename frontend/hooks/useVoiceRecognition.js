import { useState, useEffect, useRef, useCallback } from 'react';

const WAKE_PHRASES = [
  "hello smart cart", "hello smart-cart", "hello smartcard", "hello smart card", "hello smart kart",
  "hey smart cart", "hey smart-cart", "hey smartcard", "hey smart card",
  "ok smart cart", "hi smart cart", "smart cart", "smartcard", "smart card", "smart kart"
];
// NOTE: removed bare "hello smart" — too broad; caused false positives on unrelated speech

// Web Audio API Audio Chime — reuse a singleton AudioContext to avoid leaks
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

// BUG FIX: playChimeSound now awaits ctx.resume() so oscillator starts
// only after AudioContext is resumed (Chrome autoplay policy).
async function playChimeSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume(); // was: ctx.resume() without await → silence on first play
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
  // BUG FIX: store loaded voices in a ref so speakResponse always has them
  const voicesRef = useRef([]);

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

  // BUG FIX: speakResponse reads from voicesRef (always populated) instead of
  // calling getVoices() inline which returns [] during first invocation.
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

  // BUG FIX: populate voicesRef on mount and whenever voices are loaded.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const loaded = window.speechSynthesis.getVoices();
      if (loaded && loaded.length > 0) {
        voicesRef.current = loaded;
      }
    };

    updateVoices(); // synchronous on Firefox; may be empty on Chrome (that's fine, onvoiceschanged fills it)
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText('Speech recognition not supported in browser. Use text input.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = selectedLang;

    rec.onstart = () => {
      setIsListening(true);
      setStatusText("Listening... Speak your command");
      setStatusColor("text-yellow-600");
    };

    rec.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // BUG FIX: only show interim in transcript display; don't dispatch commands on interim
      // Previously currentText could be interim, causing command dispatch on partial speech
      const currentText = final || interim;
      if (currentText) {
        setTranscript(currentText);
      }

      // BUG FIX: only process final results to avoid duplicate/premature commands
      if (!final) return;

      const wakeCheck = detectWakeWord(final);

      if (wakeCheck.found) {
        setStatusText("⚡ Wake word detected! Processing...");
        setStatusColor("text-yellow-600");
        // BUG FIX: don't dispatch if only a greeting with no actual command
        const cmdToRun = wakeCheck.command ? wakeCheck.command : null;
        if (cmdToRun && onCommandDetectedRef.current) {
          onCommandDetectedRef.current(cmdToRun);
        } else if (!cmdToRun) {
          // Just greeted — acknowledge without sending to backend
          setStatusText('👋 Hey! Say a command after the wake word.');
          setStatusColor('text-yellow-500');
        }
      } else {
        setStatusText("Analyzing command...");
        setStatusColor("text-yellow-500");
        if (onCommandDetectedRef.current) onCommandDetectedRef.current(final);
      }
    };

    rec.onerror = (event) => {
      setIsListening(false);
      console.warn("Speech recognition event error:", event.error);
      if (event.error === "aborted") {
        return;
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Kill the wake-word loop immediately so onend doesn't keep retrying
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
        // Use a flag to prevent onend from also trying to restart simultaneously
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
      // Don't restart if a network-error retry is already scheduled
      if (wakeWordModeRef.current && !rec._networkRetrying) {
        // BUG FIX: reduced restart delay from 400ms to 150ms so wake-word mode
        // doesn't miss speech right after a command completes
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
      // Stop the old recognition instance before it is replaced (e.g. on language change)
      // Suppress the resulting `onend` from triggering a wake-word restart
      rec._networkRetrying = true; // reuse flag to suppress onend restart
      try {
        rec.stop();
      } catch (e) {}
    };
  }, [selectedLang, detectWakeWord]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Brave.");
      return;
    }

    // Play chime on tap
    playChimeSound();

    if (isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
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
