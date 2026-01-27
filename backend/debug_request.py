
import requests
import json

# Run this while the server is running (python start.py)
URL = "http://localhost:8000/api/sync/push"

payload = {
    "transactions": [
        {
            "id": "test-id",
            "accountId": "acc-1",
            "date": "2023-10-01T00:00:00.000Z",
            "transactionHash": "hash123",
            "amount": 100.50,
            "transactionType": "debit",
            "merchantRaw": "Test Merchant",
            "refNumber": "1234567890",
            "createdAt": "2023-10-01T00:00:00.000Z",
            "updatedAt": "2023-10-01T00:00:00.000Z",
            "currency": "INR",
            "status": "completed",
            "confidenceScore": 100,
            "isDuplicate": False
        }
    ],
    "accounts": [],
    "categories": [],
    "merchants": [],
    "subscriptions": [],
    "settings": []
}

try:
    print(f"Sending POST to {URL}...")
    resp = requests.post(URL, json=payload)
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 422:
        print("Validation Errors:")
        print(json.dumps(resp.json(), indent=2))
    else:
        print(resp.text)
except Exception as e:
    print(f"Error: {e}")
