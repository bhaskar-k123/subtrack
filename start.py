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

    # 3. Check Frontend
    static_dir = os.path.join(backend_dir, "static")
    index_html = os.path.join(static_dir, "index.html")
    
    if not os.path.exists(index_html):
        print_step("3/4", "Setting up frontend...")
        
        frontend_dir = base_dir
        dist_dir = os.path.join(frontend_dir, "dist")
        
        # If dist doesn't exist, we might need to build (or just error if user wants simple start)
        # Assuming we want to try building if missing
        if not os.path.exists(os.path.join(dist_dir, "index.html")):
             print("      Building frontend (one-time setup)...")
             if not run_command("npm install && npm run build", cwd=frontend_dir):
                 print("[ERROR] Frontend build failed.")
                 return

        # Copy dist to backend/static
        if os.path.exists(static_dir):
            shutil.rmtree(static_dir)
        shutil.copytree(dist_dir, static_dir)
    else:
        print_step("3/4", "Frontend already ready \u2713")

    # 4. Start Server
    print_step("4/4", "Starting server...")
    print(f"      Open: http://localhost:8000")
    print("      Press Ctrl+C to stop.\n")

    # Open browser after a slight delay
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:8000")
    
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
