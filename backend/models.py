from sqlalchemy import Column, String, Float, Integer, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)
    accountId = Column(String, index=True, nullable=True)
    date = Column(DateTime, index=True) # Storing as DateTime for flexibility, though likely just Date needed
    transactionHash = Column(String, unique=True, index=True)
    merchantId = Column(String, index=True, nullable=True)
    merchantRaw = Column(String, nullable=True) # Added to match frontend data usage frequently
    categoryId = Column(String, index=True, nullable=True)
    subscriptionId = Column(String, index=True, nullable=True)
    amount = Column(Float)
    transactionType = Column(String) # 'debit' or 'credit'
    currency = Column(String, default="INR")
    status = Column(String, default="completed")
    description = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    sourceFileName = Column(String, nullable=True)
    merchantNormalized = Column(String, nullable=True)
    refNumber = Column(String, nullable=True)
    paymentMethod = Column(String, default="Other")
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    type = Column(String) # 'bank', 'credit_card', etc.
    status = Column(String)
    balance = Column(Float, default=0.0)
    currency = Column(String, default="INR")
    lastSync = Column(DateTime, nullable=True)
    pdfPassword = Column(String, nullable=True) # For encrypted statements
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)

class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    parentId = Column(String, nullable=True)
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    isDefault = Column(Boolean, default=False)
    sortOrder = Column(Integer, default=0)
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String, primary_key=True, index=True)
    normalizedName = Column(String, unique=True, index=True)
    categoryId = Column(String, nullable=True)
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, index=True)
    merchantId = Column(String, index=True)
    accountId = Column(String, nullable=True)
    amount = Column(Float)
    currency = Column(String, default="INR")
    frequency = Column(String) # 'monthly', 'yearly'
    status = Column(String) # 'active', 'cancelled'
    nextExpectedDate = Column(DateTime, nullable=True)
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String) # JSON string or simple value
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow)
