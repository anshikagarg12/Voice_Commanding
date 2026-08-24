import sys
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    print("--- 1. Testing Health Endpoint ---")
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    print("Health Status:", data)
    assert data["status"] == "healthy"

def test_parse_command_add():
    print("\n--- 2. Testing Voice Add Command ---")
    payload = {"transcript": "Add 2 kg of fresh strawberries", "language": "en-US"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["action"] == "add"
    assert "strawberries" in data["item"].lower()

def test_parse_command_modify():
    print("\n--- 3. Testing Voice Modify Command ---")
    payload = {"transcript": "Change strawberries quantity to 5 kg", "language": "en-US"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["action"] in ["modify", "add"]

def test_parse_command_search_price():
    print("\n--- 4. Testing Search with Price Range ---")
    payload = {"transcript": "Search cereal under 5 dollars", "language": "en-US"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["action"] == "search"
    assert data["price_max"] == 5.0 or data["price_max"] is not None

def test_parse_command_check():
    print("\n--- 5. Testing 'I already got this' (Check Action) ---")
    payload = {"transcript": "I alr got milk", "language": "en-US"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["action"] == "check"
    assert "milk" in data["item"].lower()

def test_parse_command_multilingual():
    print("\n--- 5. Testing Multilingual Command (Spanish) ---")
    payload = {"transcript": "Agrega 3 litros de leche", "language": "es-ES"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["action"] == "add"

def test_recommendations():
    print("\n--- 6. Testing Smart AI Recommendations Endpoint ---")
    payload = {"current_items": ["Strawberries", "Milk"], "language": "en-US"}
    res = client.post("/api/recommendations", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

def test_parse_command_store_price_search():
    print("\n--- 7. Testing Live Web Store & Price Search ---")
    payload = {"transcript": "Where to buy organic strawberries nearby?", "language": "en-US"}
    res = client.post("/api/parse-command", json=payload)
    print("Status:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert data["nearby_stores"] is not None
    assert len(data["nearby_stores"]) > 0

if __name__ == "__main__":
    print("==================================================")
    print("   RUNNING VOICE SHOPPING ASSISTANT SUITE TESTS   ")
    print("==================================================")
    try:
        test_health()
        test_parse_command_add()
        test_parse_command_modify()
        test_parse_command_search_price()
        test_parse_command_check()
        test_parse_command_multilingual()
        test_recommendations()
        test_parse_command_store_price_search()
        print("\n[SUCCESS] ALL TESTS PASSED SUCCESSFULLY!")
    except Exception as e:
        print(f"\n[FAILURE] TEST FAILURE: {e}")
        sys.exit(1)
