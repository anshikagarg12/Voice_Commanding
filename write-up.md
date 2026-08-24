# write-up

Smart Cart is built using **FastAPI** (Python) on the backend and modern **HTML5/Vanilla JavaScript** with the **Web Speech API** and Tailwind CSS on the frontend.

For Natural Language Understanding (NLU), we leverage **Google Gemini 3.6 Flash** structured JSON schema output (`response_schema`). Gemini intelligently parses multilingual spoken or typed input into normalized JSON entities: action (`add`, `remove`, `modify`, `search`, `clear`), item name, quantity, auto-categorization, price constraints (`price_max`), substitute recommendations, and seasonal notes. The parser is resilient to speech recognition typos and generates context-aware spoken responses in the user's selected language.

State management employs a hybrid strategy: instant local browser persistence via `localStorage` combined with optional cloud sync through **Firebase Firestore**. Real-time Text-to-Speech (TTS) voice feedback delivers hands-free audio confirmations.

A dedicated **Smart AI Recommendations Engine** analyzes cart context to dynamically suggest low-stock staples, peak-season produce, dietary substitutes, and food pairings with 1-click addition.

The system is lightweight, production-ready, and optimized for mobile and voice-first shopping workflows.
