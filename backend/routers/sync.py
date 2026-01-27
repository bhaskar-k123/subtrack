from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from models import Transaction, Account, Category, Merchant, Subscription, Setting
from schemas import SyncPushRequest, SyncPullResponse, TransactionBase, AccountBase, CategoryBase, MerchantBase, SubscriptionBase, SettingBase
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Helper to merge data
def merge_items(db: Session, model_class, items_data):
    for item_data in items_data:
        # Pydantic model to dict
        data_dict = item_data.model_dump()
        
        # Check if exists
        existing = db.query(model_class).filter(model_class.id == data_dict['id']).first()
        
        if existing:
            # Update existing
            for key, value in data_dict.items():
                setattr(existing, key, value)
        else:
            # Create new
            new_item = model_class(**data_dict)
            db.add(new_item)

@router.post("/sync/push")
async def sync_push(
    payload: SyncPushRequest,
    db: Session = Depends(get_db)
):
    """
    Receive data from frontend and merge into backend SQLite.
    Simplistic strategy: "Last write wins" (Frontend pushes state).
    """
    try:
        # Merge all entities
        # Note: Order matters due to foreign keys if we enforced them strictly,
        # but for sync usually we just upsert all.
        
        # Settings
        for setting in payload.settings:
            data = setting.model_dump()
            existing = db.query(Setting).filter(Setting.key == data['key']).first()
            if existing:
                existing.value = data['value']
                existing.updatedAt = data['updatedAt']
            else:
                db.add(Setting(**data))
        
        # Delete deleted transactions
        if payload.deletedTransactionIds:
            db.query(Transaction).filter(Transaction.id.in_(payload.deletedTransactionIds)).delete(synchronize_session=False)

        # Merge other entities
        merge_items(db, Account, payload.accounts)
        merge_items(db, Category, payload.categories)
        merge_items(db, Merchant, payload.merchants)
        merge_items(db, Subscription, payload.subscriptions)
        
        # Merge Transactions with Hash Collision Handling
        for item_data in payload.transactions:
            data = item_data.model_dump()
            
            # 1. Check by ID (Update)
            existing_id = db.query(Transaction).filter(Transaction.id == data['id']).first()
            if existing_id:
                for key, value in data.items():
                    setattr(existing_id, key, value)
                continue
            
            # 2. Check by Hash (Collision / Re-upload)
            existing_hash = db.query(Transaction).filter(Transaction.transactionHash == data['transactionHash']).first()
            if existing_hash:
                # Collision found! The user likely re-uploaded.
                # We should replace the old record with the new one to match the Frontend's new ID.
                db.delete(existing_hash)
                db.flush() # Ensure delete happens before insert
            
            # 3. Insert New
            db.add(Transaction(**data))
        
        db.commit()
        return {"status": "success", "message": "Sync complete"}
    except Exception as e:
        db.rollback()
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/pull", response_model=SyncPullResponse)
async def sync_pull(db: Session = Depends(get_db)):
    """
    Send entire backend state to frontend.
    """
    try:
        return {
            "transactions": db.query(Transaction).all(),
            "accounts": db.query(Account).all(),
            "categories": db.query(Category).all(),
            "merchants": db.query(Merchant).all(),
            "subscriptions": db.query(Subscription).all(),
            "settings": db.query(Setting).all()
        }
    except Exception as e:
        logger.error(f"Pull failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
