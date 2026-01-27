
from schemas import SyncPushRequest
from datetime import datetime
import json

# Mock payload that closely resembles Dexie output + JSON.stringify
# Note: JSON.stringify converts Dates to strings
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
            
            # Extra fields from Frontend that are NOT in Backend Schema
            "confidenceScore": 100,
            "isDuplicate": False,
            "sourceType": "statement",
            "tags": []
        }
    ],
    "accounts": [],
    "categories": [],
    "merchants": [],
    "subscriptions": [],
    "settings": []
}

try:
    req = SyncPushRequest(**payload)
    print("Validation Success!")
except Exception as e:
    print(f"Validation Failed: {e}")
