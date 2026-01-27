
import shutil
import os

DIST_DIR = "dist"
STATIC_DIR = os.path.join("backend", "static")

def update_static():
    if not os.path.exists(DIST_DIR):
        print(f"Error: {DIST_DIR} not found. Run 'npm run build' first.")
        return

    if os.path.exists(STATIC_DIR):
        print(f"Removing old {STATIC_DIR}...")
        shutil.rmtree(STATIC_DIR)
    
    print(f"Copying {DIST_DIR} to {STATIC_DIR}...")
    shutil.copytree(DIST_DIR, STATIC_DIR)
    print("Success: Frontend assets updated.")

if __name__ == "__main__":
    update_static()
