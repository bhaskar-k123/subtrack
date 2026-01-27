import os
import sys
import subprocess
import shutil
import time
import webbrowser

def print_step(step, msg):
    print(f"\n[{step}] {msg}")

def run_command(cmd, cwd=None, shell=True):
    try:
        subprocess.check_call(cmd, cwd=cwd, shell=shell)
        return True
    except subprocess.CalledProcessError:
        return False

def main():
    print("\n" + "="*40)
    print("   SubTrack - Finance Tracker")
    print("   Starting..." )
    print("="*40 + "\n")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    venv_dir = os.path.join(backend_dir, "venv")
    
    # correct handling for windows scripts path
    if os.name == 'nt':
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
        venv_pip = os.path.join(venv_dir, "Scripts", "pip.exe")
    else:
        venv_python = os.path.join(venv_dir, "bin", "python")
        venv_pip = os.path.join(venv_dir, "bin", "pip")

    # 1. Check/Create Virtual Environment
    if not os.path.exists(venv_python):
        print_step("1/4", "Creating Python virtual environment...")
        if not run_command([sys.executable, "-m", "venv", venv_dir]):
            print("[ERROR] Failed to create virtual environment.")
            return

    # 2. Check Dependencies
    deps_marker = os.path.join(venv_dir, ".deps_installed")
    requirements_file = os.path.join(backend_dir, "requirements.txt")
    
    if not os.path.exists(deps_marker):
        print_step("2/4", "Installing backend dependencies...")
        if not run_command([venv_python, "-m", "pip", "install", "-q", "-r", requirements_file]):
             print("[WARNING] Failed to install some dependencies.")
        
        # Create marker file
        with open(deps_marker, "w") as f:
            f.write("installed")
    else:
        print_step("2/4", "Dependencies already installed \u2713")

    # 3. Check/Update Frontend
    static_dir = os.path.join(backend_dir, "static")
    frontend_dir = base_dir
    dist_dir = os.path.join(frontend_dir, "dist")
    
    if not os.path.exists(dist_dir) or not os.path.exists(os.path.join(dist_dir, "index.html")):
        print_step("3/4", "Setting up frontend (one-time setup)...")
        if not run_command("npm install && npm run build", cwd=frontend_dir):
            print("[ERROR] Frontend build failed.")
            return
    else:
        print_step("3/4", "Syncing latest frontend build...")
        
    # Always copy dist to backend/static to ensure we serve the latest build
    try:
        if os.path.exists(static_dir):
            shutil.rmtree(static_dir)
        shutil.copytree(dist_dir, static_dir)
        print("      Frontend synced to backend/static \u2713")
    except Exception as e:
        print(f"      [WARNING] Could not sync frontend: {e}")

    # 4. Start Server
    print_step("4/4", "Starting server...")
    print(f"      Open: http://localhost:8000")
    print("      Press Ctrl+C to stop.\n")

    # Open browser after a slight delay
    # Open browser after server is ready
    def open_browser():
        import socket
        host = "127.0.0.1"
        port = 8000
        max_retries = 30
        
        for _ in range(max_retries):
            try:
                with socket.create_connection((host, port), timeout=1):
                    # Server is listening
                    print("      Server is ready! Opening browser...")
                    webbrowser.open(f"http://{host}:{port}")
                    return
            except (OSError, ConnectionRefusedError):
                time.sleep(1)
        
        print("      [WARNING] Server took too long to start. Please open http://localhost:8000 manually.")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Run Uvicorn
    # python -m uvicorn main:app --host 127.0.0.1 --port 8000
    try:
        subprocess.call([venv_python, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=backend_dir)
    except KeyboardInterrupt:
        pass
    print("\nStopped.")

if __name__ == "__main__":
    main()
