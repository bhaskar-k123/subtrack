from fastapi import APIRouter
from fastapi.responses import JSONResponse
import csv
import io

router = APIRouter()

@router.post("/export/csv")
async def export_csv(transactions: list):
    """Export transactions to CSV format"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Date', 'Merchant', 'Amount', 'Type', 'Category', 'Notes'])
    
    # Data
    for tx in transactions:
        writer.writerow([
            tx.get('date', ''),
            tx.get('merchantNormalized', tx.get('merchantRaw', '')),
            tx.get('amount', 0),
            tx.get('transactionType', 'debit'),
            tx.get('category', ''),
            tx.get('notes', '')
        ])
    
    return JSONResponse(
        content={"csv": output.getvalue()},
        media_type="application/json"
    )
