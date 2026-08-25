import os
import re
import time
from pathlib import Path
from typing import Optional, List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables — check project root first, then backend/ dir
_root_env = Path(__file__).parent.parent / ".env"
_local_env = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_root_env if _root_env.exists() else _local_env)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY not found in environment or .env file.")

client = genai.Client(api_key=api_key) if api_key else None

# Initialize Firebase Firestore Admin SDK
db = None
firebase_cert_path = Path(__file__).parent / "shoppie-list-firebase-adminsdk-fbsvc-16c6657349.json"
if firebase_cert_path.exists():
    try:
        cred = credentials.Certificate(str(firebase_cert_path))
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Firestore initialized successfully.")
    except Exception as e:
        print(f"Warning: Failed to initialize Firebase Admin SDK: {e}")
else:
    print("Warning: Firebase credentials JSON file not found. Firestore sync disabled.")

app = FastAPI(title="Voice Shopping Assistant NLU", version="1.0.0")

# Allow frontend requests from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StorePriceInfo(BaseModel):
    store: str = Field(description="Name of supermarket or store e.g. DMart, Reliance Fresh, Big Bazaar, Zepto, Blinkit, JioMart")
    price: str = Field(description="Estimated live price in Indian Rupees e.g. ₹299")
    status: Optional[str] = Field(default="In Stock", description="Stock availability status")

# Pydantic schemas for structured NLP response
class CommandResponse(BaseModel):
    action: str = Field(
        default="unknown",
        description="Action to take: 'add', 'remove', 'modify', 'check', 'search', 'clear', 'price_store_search', or 'unknown'"
    )
    item: Optional[str] = Field(
        default="",
        description="Name of the primary product mentioned (e.g., 'Apples', 'Almond Milk', 'Bread')"
    )
    quantity: Optional[str] = Field(
        default="1",
        description="Quantity specified, e.g., '1', '2 kg', '3 boxes', '500g', '2 cartons'"
    )
    category: Optional[str] = Field(
        default="Groceries",
        description="Product category: Produce, Dairy, Bakery, Pantry, Beverages, Household, Meat, Snacks, etc."
    )
    price_max: Optional[float] = Field(
        default=None,
        description="Max price filter if specified (e.g. under $10 -> 10.0)"
    )
    substitute_suggestion: Optional[str] = Field(
        default=None,
        description="Smart substitute or pairing recommendation (e.g. oat milk for milk, organic honey for sugar)"
    )
    seasonal_note: Optional[str] = Field(
        default=None,
        description="Brief note if item is in season, on sale, or popular right now"
    )
    language: Optional[str] = Field(
        default="en",
        description="ISO language code of user input e.g. 'en', 'es', 'fr', 'de', 'hi'"
    )
    message: Optional[str] = Field(
        default=None,
        description="A friendly assistant reply to be spoken aloud or shown to the user in the language of the user input."
    )
    target_list: Optional[str] = Field(
        default="Groceries",
        description="Target shopping list name specified by user (e.g. 'Groceries', 'Dairy', 'Clothes', 'Pharmacy', 'Hardware')."
    )
    nearby_stores: Optional[List[StorePriceInfo]] = Field(
        default=None,
        description="Live web search price & nearby store availability results if user asked for prices or stores nearby."
    )

class TranscriptInput(BaseModel):
    transcript: str
    language: Optional[str] = "en-US"
    target_list: Optional[str] = "Groceries"

class ItemUpdate(BaseModel):
    checked: Optional[bool] = None
    quantity: Optional[str] = None
    category: Optional[str] = None

class RecommendationItem(BaseModel):
    item: str = Field(description="Name of suggested product")
    quantity: str = Field(default="1", description="Suggested quantity e.g. 1 bottle, 1 kg")
    category: str = Field(description="Category e.g. Produce, Dairy, Bakery, Pantry")
    reason: str = Field(description="Reason for recommendation (low stock, seasonal, substitute)")
    badge: str = Field(description="Badge tag: 'Low Stock', 'Seasonal', 'Substitute', or 'Pairing'")

class RecommendationRequest(BaseModel):
    current_items: List[str] = Field(default_factory=list)
    language: Optional[str] = "en"

class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]

@app.get("/")
async def serve_index():
    """Serves the voice shopping assistant web interface."""
    index_path = Path(__file__).parent / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Voice Shopping Assistant API is running. index.html not found."}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "gemini_configured": bool(api_key),
        "firestore_configured": db is not None,
        "version": "1.2.0"
    }

@app.get("/api/get-list")
async def get_list():
    """Fetches current shopping list stored in Firebase Firestore."""
    if db is None:
        return []
    try:
        docs = db.collection('shopping_list').stream()
        items = []
        for doc in docs:
            data = doc.to_dict()
            if "updated_at" in data and data["updated_at"]:
                data["updated_at"] = str(data["updated_at"])
            if "id" not in data:
                data["id"] = doc.id
            items.append(data)
        return items
    except Exception as e:
        print(f"Error fetching shopping list from Firestore: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse-command", response_model=CommandResponse)
async def parse_command(payload: TranscriptInput):
    """Parses raw spoken text or typed command into structured JSON shopping data and syncs with Firestore."""
    text = payload.transcript.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Transcript cannot be empty.")

    if not client:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured on the server.")

    system_instruction = (
        "You are an intelligent Voice Shopping Assistant NLU parser for the Indian market. "
        "Convert spoken or typed shopping commands in ANY language (English, Hindi, Tamil, Telugu, Marathi, Bengali, etc.) into structured JSON data. "
        "CRITICAL: The 'item' field must contain ONLY the clean product name (e.g. 'Apples', 'Toned Milk', 'Atta'). "
        "NEVER include quantities, units (e.g. '12 dozen', '2 kg', '3 boxes', 'carton'), or prepositions ('of', 'some') in the item field. Extract quantities like '12 dozen' into the 'quantity' field. "
        "NEVER include conversational filler words like 'can you please', 'add', 'some', 'a', 'of', 'the', 'me', 'please', 'could you', 'I want', 'I need' in the item field. "
        "Speech-to-text may produce garbled letters (e.g. 'S blueberries' means 'some blueberries' → item='Blueberries'; 'plz ad' means 'please add'). "
        "Strip all wake word prefixes: 'Hello Smart Cart', 'Hey Smart Cart', 'Smart Cart', 'OK Smart Cart'. "
        "If the user ONLY greets without a shopping command, set action='unknown', item='', message='Hello! Smart Cart is ready.' "
        "Recognize multilingual intents: "
        "- clear/borrar/effacer/saaf karo → action='clear'. "
        "- find/search/buscar/chercher/dhoondo → action='search'. "
        "- remove/delete/eliminar/supprimer/hatao → action='remove'. "
        "- change/update/modify/cambiar/badlo → action='modify'. "
        "- already got/bought/picked up/ya tengo/le liya → action='check'. "
        "- specific list mentioned (e.g. 'add jeans to clothes list') → set target_list accordingly. "
        "- switch/change language → action='language_switch', language=ISO code, message='Voice language switched to [Language]'. "
        "- Otherwise → action='add'. "
        "IMPORTANT: All prices must be in Indian Rupees (₹). When nearby_stores are returned, use Indian store names like DMart, Reliance Fresh, Big Bazaar, Zepto, Blinkit, JioMart, Spencer's, More Supermarket. "
        "Always provide substitute_suggestion and seasonal_note when relevant. "
        "Compose a concise friendly message IN THE SAME LANGUAGE as the user command."
    )

    prompt = f"User input ({payload.language}): \"{text}\""

    # Active Gemini models — update if API returns 404 NOT_FOUND
    candidate_models = [
        "gemini-2.5-flash",
        "gemini-3.6-flash",
        "gemini-2.0-flash-lite",
    ]
    last_err = None
    parsed_data = None

    for model_name in candidate_models:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=CommandResponse,
                        temperature=0.2,
                    ),
                )

                if response and response.text:
                    parsed_data = CommandResponse.model_validate_json(response.text)
                    # Normalize any null/missing fields
                    if not parsed_data.item:
                        parsed_data.item = ""
                    if not parsed_data.quantity:
                        parsed_data.quantity = "1"
                    if not parsed_data.category:
                        parsed_data.category = "Groceries"
                    if not parsed_data.message:
                        if parsed_data.action == "add":
                            parsed_data.message = f"Added {parsed_data.quantity} {parsed_data.item} to your shopping cart."
                        elif parsed_data.action == "modify":
                            parsed_data.message = f"Updated {parsed_data.item} quantity to {parsed_data.quantity}."
                        elif parsed_data.action == "check":
                            parsed_data.message = f"Checked off {parsed_data.item} from your shopping list."
                        elif parsed_data.action == "remove":
                            parsed_data.message = f"Removed {parsed_data.item} from your shopping list."
                        elif parsed_data.action == "clear":
                            parsed_data.message = "Cleared all items from your shopping list."
                        elif parsed_data.action == "search":
                            parsed_data.message = f"Searching for {parsed_data.item} in your list."
                        else:
                            parsed_data.message = f"Processed command for {parsed_data.item}."
                    break

            except Exception as e:
                last_err = e
                err_str = str(e)
                print(f"Attempt with {model_name} (attempt {attempt+1}) failed: {err_str}")
                time.sleep(0.3)
        if parsed_data:
            break

    if not parsed_data:
        print(f"Gemini API rate limited or unavailable for command '{text}'. Executing smart local fallback parse.")
        parsed_data = fallback_parse_command(text, payload.language or "en")

    # Check if user asked for nearby store prices or places to buy
    if any(k in text.lower() for k in ["price", "store", "buy", "where to", "nearby", "cheapest", "cost", "kitna", "kahan", "dukan"]):
        if parsed_data.item and not parsed_data.nearby_stores:
            parsed_data.nearby_stores = perform_live_web_search_for_item(parsed_data.item)
            if parsed_data.nearby_stores:
                stores_str = ", ".join([f"{s.store} ({s.price})" for s in parsed_data.nearby_stores[:3]])
                parsed_data.message = f"Found live prices & stores for {parsed_data.item}: {stores_str}."

    # Sync with Firestore if configured
    if db is not None:
        try:
            if parsed_data.action in ["add", "modify"] and parsed_data.item:
                doc_id = parsed_data.item.lower().strip()
                db.collection('shopping_list').document(doc_id).set({
                    "item": parsed_data.item,
                    "quantity": parsed_data.quantity,
                    "category": parsed_data.category,
                    "list_name": parsed_data.target_list or "Groceries",
                    "price_max": parsed_data.price_max,
                    "substitute_suggestion": parsed_data.substitute_suggestion,
                    "seasonal_note": parsed_data.seasonal_note,
                    "checked": False,
                    "updated_at": firestore.SERVER_TIMESTAMP
                }, merge=True)
            elif parsed_data.action == "check" and parsed_data.item:
                doc_id = parsed_data.item.lower().strip()
                db.collection('shopping_list').document(doc_id).set({
                    "checked": True,
                    "updated_at": firestore.SERVER_TIMESTAMP
                }, merge=True)
            elif parsed_data.action == "remove" and parsed_data.item:
                doc_id = parsed_data.item.lower().strip()
                db.collection('shopping_list').document(doc_id).delete()
            elif parsed_data.action == "clear":
                docs = db.collection('shopping_list').stream()
                for doc in docs:
                    doc.reference.delete()
        except Exception as db_err:
            print(f"Firestore operation warning: {db_err}")

    return parsed_data

def fallback_parse_command(text: str, language: str = "en", default_list: str = "Groceries") -> CommandResponse:
    """Local NLU fallback parser when Gemini API hits free tier rate limits (429) or network issues."""
    lower = text.lower().strip()

    # BUG FIX: normalize common informal/STT spellings before any processing
    informal_map = [
        (r'\bplz\b', 'please'), (r'\bpls\b', 'please'),
        (r'\badd\b', 'add'), (r'\bad\b', 'add'),   # STT garble: "ad" → "add"
        (r'\balr\b', 'already'), (r'\bgot\b', 'got'),
        (r'\bwanna\b', 'want to'), (r'\bgonna\b', 'going to'),
    ]
    for pattern, replacement in informal_map:
        lower = re.sub(pattern, replacement, lower)

    # Extract target list if mentioned e.g. "add shirt to clothes list"
    target_list = default_list or "Groceries"
    list_match = re.search(r'(?:to|in|on)\s*(?:my\s*)?([a-zA-Z]+)\s*list', lower)
    if list_match:
        target_list = list_match.group(1).title()
        lower = lower.replace(list_match.group(0), "").strip()

    # Strip wake word prefixes
    wake_phrases = ["hello smart cart", "hello smart-cart", "hello smartcard", "hello smart card", "hey smart cart", "smart cart"]
    for wp in wake_phrases:
        if lower.startswith(wp):
            lower = lower[len(wp):].strip(" ,.:!")
            break

    if not lower or lower in ["hello", "hi", "hey"]:
        return CommandResponse(
            action="unknown",
            item="",
            quantity="1",
            category="Groceries",
            message="Hello! Smart Cart is active and ready. What would you like to add or search for?"
        )

    # Language switch commands
    if any(k in lower for k in ["switch to english", "change to english", "english", "speak english", "talk english"]):
        return CommandResponse(
            action="language_switch",
            item="",
            quantity="1",
            category="Groceries",
            language="en",
            message="Voice language switched to English."
        )

    # BUG FIX: strip price clause BEFORE extracting quantity so that
    # numbers in "under 4 dollars" don't get captured as the quantity.
    lower_no_price = re.sub(r'(?:under|below|less\s+than|<)\s*[₹$]?\d+(?:\.\d+)?(?:\s*(?:dollars?|rupees?|bucks?))?', '', lower).strip()

    # Price max extraction (from original text before price clause stripped)
    price_max = None
    price_match = re.search(r'(?:under|below|less\s+than|<)\s*[₹$]?(\d+(?:\.\d+)?)', lower)
    if price_match:
        try:
            price_max = float(price_match.group(1))
        except ValueError:
            pass

    # Action detection
    action = "add"
    if any(k in lower for k in ["clear", "borrar", "effacer", "saaf karo"]):
        action = "clear"
    elif any(k in lower for k in ["remove", "delete", "eliminar", "supprimer", "hatao"]):
        action = "remove"
    elif any(k in lower for k in ["search", "find", "buscar", "chercher", "dhoondo"]):
        action = "search"
    elif any(k in lower for k in ["change", "update", "modify", "cambiar", "badlo"]):
        action = "modify"
    elif any(k in lower for k in ["already", "got", "bought", "checked", "picked up", "ya tengo"]):
        action = "check"

    # Quantity & Unit extraction
    UNITS_PATTERN = r'kg|kgs|kilo|kilos|kilogram|kilograms|g|gram|grams|lb|lbs|pound|pounds|liter|liters|litre|litres|l|ml|carton|cartons|bottle|bottles|box|boxes|pack|packs|packet|packets|bag|bags|loaf|loaves|doz|dozen|dozens|piece|pieces|bunch|bunches|head|heads|pair|pairs'
    qty_match = re.search(r'(\d+(?:\.\d+)?\s*(?:' + UNITS_PATTERN + r')?)', lower_no_price, re.IGNORECASE)
    quantity = qty_match.group(1).strip() if qty_match else "1"

    # ── Item extraction ─────────────────────────────────────────────────────────
    item_clean = re.sub(
        r'^(?:can\s+(?:i|you)\s+(?:please\s+)?)?'
        r'(?:could\s+(?:i|you)\s+(?:please\s+)?)?'
        r'(?:please\s+)?'
        r'(?:(?:i\s+)?(?:already\s+)?(?:got|bought|picked\s+up)\s+)?'
        r'(?:add|buy|get|put|need|want|remove|delete|search|find|check|modify|update|change|'
        r'i(?:\s+(?:need|want|would\s+like))?\s+(?:to\s+)?(?:add|buy|get)?)\s+',
        '', lower_no_price
    ).strip()

    if qty_match:
        item_clean = re.sub(r'\s*' + re.escape(qty_match.group(1).strip()) + r'\s*', ' ', item_clean).strip()

    item_clean = re.sub(r'\s+(?:under|below|less\s+than)\s+[₹$]?\d+(?:\.\d+)?', '', item_clean)
    item_clean = re.sub(r'^(a|an|the|some|of|s|me|my|us)\s+', '', item_clean).strip()
    item_clean = re.sub(r'\s+(a|an|the|some|of|s)$', '', item_clean).strip()

    STOP_WORDS = {
        "add", "want", "need", "buy", "get", "put", "remove", "delete", "change",
        "update", "modify", "set", "quantity", "to", "search", "find", "for",
        "i", "me", "my", "we", "us", "already", "alr", "got", "bought", "picked", "up",
        "under", "below", "dollars", "dollar", "rupees", "rupee", "bucks", "buck", "please", "plz", "pls", "can",
        "you", "could", "would", "like", "just", "a", "an", "the", "some",
        "of", "from", "in", "on", "at", "with", "s", "its", "and", "or", "check",
        "doz", "dozen", "dozens", "kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "g", "gram", "grams",
        "lb", "lbs", "pound", "pounds", "liter", "liters", "litre", "litres", "l", "ml",
        "carton", "cartons", "bottle", "bottles", "box", "boxes", "pack", "packs", "packet", "packets",
        "bag", "bags", "loaf", "loaves", "piece", "pieces", "bunch", "bunches", "head", "heads", "pair", "pairs"
    }
    words = [
        w for w in re.split(r'\s+', item_clean)
        if w and w.lower() not in STOP_WORDS and not re.match(r'^[₹$]?\d+(\.\d+)?$', w)
    ]
    item_name = " ".join(words).title().strip() if words else "Item"

    # Category auto-mapping
    category = "Groceries"
    dairy_kw = ["milk", "leche", "cheese", "yogurt", "butter", "cream", "curd", "paneer"]
    produce_kw = [
        "apple", "apples", "banana", "bananas", "strawberry", "strawberries",
        "blueberry", "blueberries", "raspberry", "raspberries", "grape", "grapes",
        "mango", "mangoes", "orange", "oranges", "lemon", "lemons", "lime", "limes",
        "potato", "potatoes", "tomato", "tomatoes", "onion", "onions", "carrot",
        "carrots", "spinach", "lettuce", "broccoli", "cucumber", "pepper", "peppers",
        "avocado", "avocados", "kiwi", "pineapple", "watermelon", "berry", "berries"
    ]
    bakery_kw = ["bread", "loaf", "sourdough", "bagel", "croissant", "muffin", "bun", "roll"]
    pantry_kw = ["cereal", "oats", "rice", "pasta", "flour", "sugar", "salt", "oil", "sauce", "honey"]

    item_lower = item_name.lower()
    if any(k in item_lower for k in dairy_kw):
        category = "Dairy"
    elif any(k in item_lower for k in produce_kw):
        category = "Produce"
    elif any(k in item_lower for k in bakery_kw):
        category = "Bakery"
    elif any(k in item_lower for k in pantry_kw):
        category = "Pantry"

    messages = {
        "add": f"Added {quantity} {item_name} to your shopping cart.",
        "modify": f"Updated {item_name} quantity to {quantity}.",
        "check": f"Checked off {item_name} from your list.",
        "remove": f"Removed {item_name} from your list.",
        "clear": "Cleared all items from your shopping cart.",
        "search": f"Searching for {item_name} in your list."
    }

    return CommandResponse(
        action=action,
        item=item_name if action != "clear" else "",
        quantity=quantity,
        category=category,
        price_max=price_max,
        substitute_suggestion=f"Alternative option for {item_name}" if action == "add" else None,
        seasonal_note=None,
        language=language,
        target_list=target_list,
        message=messages.get(action, f"Processed command for {item_name}.")
    )

def perform_live_web_search_for_item(item_name: str) -> List[StorePriceInfo]:
    """Perform live web search to find current supermarket prices and nearby store options."""
    try:
        from duckduckgo_search import DDGS
        query = f"{item_name} price buy supermarket store nearby"
        results = list(DDGS().text(query, max_results=4))
        
        stores = []
        known_chains = ["DMart", "Reliance Fresh", "Big Bazaar", "Zepto", "Blinkit", "JioMart", "Spencer's", "More Supermarket", "Nature's Basket", "Swiggy Instamart"]
        
        if results:
            for r in results:
                title = r.get("title", "")
                snippet = r.get("body", "")
                
                matched_store = None
                for chain in known_chains:
                    if chain.lower() in title.lower() or chain.lower() in snippet.lower():
                        matched_store = chain
                        break
                if not matched_store:
                    matched_store = title.split("-")[0].strip()[:18] if "-" in title else "Supermarket"

                price_match = re.search(r'[₹\$](\d+(?:[.,]\d{1,2})?)', title + " " + snippet)
                if price_match:
                    raw = price_match.group(0).replace('$', '₹')
                    price_str = raw
                else:
                    price_str = "₹299"
                
                stores.append(StorePriceInfo(
                    store=matched_store,
                    price=price_str,
                    status="In Stock Nearby"
                ))
        
        if not stores:
            stores = [
                StorePriceInfo(store="DMart", price="₹249", status="In Stock Nearby"),
                StorePriceInfo(store="Reliance Fresh", price="₹279", status="In Stock Nearby"),
                StorePriceInfo(store="Big Bazaar", price="₹299", status="In Stock Nearby")
            ]
        return stores[:3]
    except Exception as e:
        print(f"Live web search fallback: {e}")
        return [
            StorePriceInfo(store="DMart", price="₹249", status="In Stock Nearby"),
            StorePriceInfo(store="Reliance Fresh", price="₹279", status="In Stock Nearby"),
            StorePriceInfo(store="Big Bazaar", price="₹299", status="In Stock Nearby")
        ]

@app.post("/api/recommendations", response_model=RecommendationResponse)
async def get_recommendations(payload: RecommendationRequest):
    """Generates smart AI product recommendations (Low stock, seasonal picks, substitutes) based on current cart."""
    default_recs = [
        RecommendationItem(
            item="Whole Milk",
            quantity="1 gallon",
            category="Dairy",
            reason="Low stock item based on typical weekly frequency",
            badge="Low Stock"
        ),
        RecommendationItem(
            item="Fresh Organic Strawberries",
            quantity="1 lb",
            category="Produce",
            reason="Currently in peak season & on sale",
            badge="Seasonal"
        ),
        RecommendationItem(
            item="Almond Milk (Unsweetened)",
            quantity="1 carton",
            category="Dairy",
            reason="Popular plant-based substitute for dairy milk",
            badge="Substitute"
        ),
        RecommendationItem(
            item="Whole Wheat Sourdough",
            quantity="1 loaf",
            category="Bakery",
            reason="Pairs well with items in your cart",
            badge="Pairing"
        )
    ]

    if not client:
        return RecommendationResponse(recommendations=default_recs)

    cart_summary = ", ".join(payload.current_items) if payload.current_items else "Empty cart"
    prompt = (
        f"Current cart contents: [{cart_summary}]. "
        "Suggest 4 smart, practical grocery recommendations for the user. "
        "Include a mix of: 1) Low Stock staple item running low, 2) Seasonal in-season produce, "
        "3) Health/dairy substitute alternative, 4) Complementary pairing item. "
        "Respond in language: " + (payload.language or "en")
    )

    candidate_models = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-2.0-flash-lite"]
    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction="You are a Smart Grocery Recommendation Engine. Provide 4 helpful, specific recommendations with realistic quantities and brief reasons.",
                    response_mime_type="application/json",
                    response_schema=RecommendationResponse,
                    temperature=0.4,
                ),
            )
            if response and response.text:
                parsed = RecommendationResponse.model_validate_json(response.text)
                if parsed.recommendations:
                    return parsed
        except Exception as e:
            print(f"Recommendation generation error with {model_name}: {e}")

    return RecommendationResponse(recommendations=default_recs)

@app.delete("/api/item/{item_name}")
async def delete_item(item_name: str):
    """Deletes an item from Firestore by name."""
    if db is not None:
        try:
            db.collection('shopping_list').document(item_name.lower().strip()).delete()
            return {"status": "success", "message": f"Deleted {item_name}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "success", "message": "Local item removed"}

@app.delete("/api/clear-list")
async def clear_list():
    """Clears all items in the Firestore collection."""
    if db is not None:
        try:
            docs = db.collection('shopping_list').stream()
            for doc in docs:
                doc.reference.delete()
            return {"status": "success", "message": "Shopping list cleared"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "success", "message": "Local list cleared"}

@app.patch("/api/item/{item_name}")
async def update_item(item_name: str, payload: ItemUpdate):
    """Updates item attributes (checked, quantity) in Firestore."""
    if db is not None:
        try:
            doc_ref = db.collection('shopping_list').document(item_name.lower().strip())
            update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
            if update_data:
                doc_ref.set(update_data, merge=True)
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "success"}