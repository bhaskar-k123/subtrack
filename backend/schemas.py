from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class TransactionBase(BaseModel):
    id: str
    accountId: Optional[str] = None
    date: datetime
    transactionHash: str
    merchantId: Optional[str] = None
    merchantRaw: Optional[str] = None
    categoryId: Optional[str] = None
    subscriptionId: Optional[str] = None
    amount: float
    transactionType: str
    currency: str = "INR"
    status: str = "completed"
    description: Optional[str] = None
    notes: Optional[str] = None
    sourceFileName: Optional[str] = None
    merchantNormalized: Optional[str] = None
    refNumber: Optional[str] = None
    paymentMethod: str = "Other"
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

class AccountBase(BaseModel):
    id: str
    name: str
    type: str
    status: str
    balance: Optional[float] = 0.0
    currency: str
    lastSync: Optional[datetime] = None
    pdfPassword: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    id: str
    name: str
    parentId: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    isDefault: bool = False
    sortOrder: int = 0
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

class MerchantBase(BaseModel):
    id: str
    normalizedName: str
    categoryId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

class SubscriptionBase(BaseModel):
    id: str
    merchantId: str
    accountId: Optional[str] = None
    amount: float
    currency: str = "INR"
    frequency: str
    status: str
    nextExpectedDate: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True

class SettingBase(BaseModel):
    key: str
    value: Any
    updatedAt: datetime

    class Config:
        from_attributes = True

class SyncPushRequest(BaseModel):
    transactions: List[TransactionBase] = []
    accounts: List[AccountBase] = []
    categories: List[CategoryBase] = []
    merchants: List[MerchantBase] = []
    subscriptions: List[SubscriptionBase] = []
    settings: List[SettingBase] = []
    deletedTransactionIds: List[str] = []

class SyncPullResponse(BaseModel):
    transactions: List[TransactionBase]
    accounts: List[AccountBase]
    categories: List[CategoryBase]
    merchants: List[MerchantBase]
    subscriptions: List[SubscriptionBase]
    settings: List[SettingBase]
