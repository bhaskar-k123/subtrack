
import requests
import json
from datetime import datetime

URL = "http://localhost:8000/api/sync/push"

# Minimal valid transaction
valid_tx = {
    "id": "tx-1",
    "date": "2023-10-01T00:00:00.000Z",
    "transactionHash": "hash1",
    "amount": 100.0,
    "transactionType": "debit",
    "createdAt": "2023-10-01T00:00:00.000Z",
    "updatedAt": "2023-10-01T00:00:00.000Z"
}

scenarios = [
    ("Ref Number missing", {**valid_tx, "accountId": "acc1"}), # refNumber undefined
    ("Ref Number null", {**valid_tx, "accountId": "acc1", "refNumber": None}), 
    ("Ref Number string", {**valid_tx, "accountId": "acc1", "refNumber": "123"}), 
    ("Extra field", {**valid_tx, "accountId": "acc1", "extra_stuff": "ignored?"}),
    ("Amount string", {**valid_tx, "accountId": "acc1", "amount": "100.0"}), # Should fail if strict? Pydantic usually coerces
    ("Bad Date", {**valid_tx, "accountId": "acc1", "date": "invalid-date"}), # Should fail
    ("Missing AccountId", {**valid_tx}), # Should pass (optional)
]

for name, tx in scenarios:
    payload = {
        "transactions": [tx],
        "accounts": [],
        "categories": [],
        "merchants": [],
        "subscriptions": [],
        "settings": []
    }
    try:
        resp = requests.post(URL, json=payload)
        if resp.status_code != 200:
            print(f"[{name}] FAILED: {resp.status_code} - {resp.text}")
        else:
            print(f"[{name}] PASSED")
    except Exception as e:
        print(f"[{name}] ERROR: {e}")
