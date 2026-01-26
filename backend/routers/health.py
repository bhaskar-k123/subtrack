from fastapi import APIRouter
from datetime import datetime
from services.parsers import DOCLING_AVAILABLE

router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "docling_available": DOCLING_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }
