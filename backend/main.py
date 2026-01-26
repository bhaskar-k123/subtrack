"""
SubTrack Backend Server
=======================
FastAPI server, refactored for modularity.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from routers import processing, export, health

# Initialize FastAPI app
app = FastAPI(
    title="SubTrack API",
    description="Privacy-first document processing for expense tracking",
    version="1.0.0"
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(processing.router, prefix="/api", tags=["processing"])
app.include_router(export.router, prefix="/api", tags=["export"])

# Serve React frontend static files
# Adjust path relative to this file
FRONTEND_DIR = Path(__file__).parent / "static"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React frontend for all non-API routes"""
        # Skip API routes just in case regex matches
        if full_path.startswith("api/"):
            return {"error": "API route not found"}
            
        file_path = FRONTEND_DIR / full_path
        
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Return index.html for SPA routing
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"error": "Frontend not built. Run 'npm run build' in subtrack-local-finance/"}
else:
    @app.get("/")
    async def root():
        return {
            "message": "SubTrack API is running (Modular)",
            "docs": "/docs",
            "health": "/api/health",
            "note": "Frontend not found. Build the React app and copy to backend/static/"
        }


if __name__ == "__main__":
    import uvicorn
    # Use generic host to listen on all interfaces if needed, or localhost
    uvicorn.run(app, host="0.0.0.0", port=8000)
