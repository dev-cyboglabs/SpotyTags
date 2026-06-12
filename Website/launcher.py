import subprocess
import os
import sys
import time
import webbrowser
import threading
import signal

BASE_DIR = os.path.dirname(os.path.abspath(sys.executable if getattr(sys, "frozen", False) else __file__))

backend_proc = None
frontend_proc = None


def start_backend():
    """Start the FastAPI backend server."""
    backend_dir = os.path.join(BASE_DIR, "backend")
    # Use the bundled Python interpreter when frozen, else system Python
    python_path = sys.executable

    env = os.environ.copy()
    env["SEED_DEMO_DATA"] = "false"
    env["PYTHONDONTWRITEBYTECODE"] = "1"

    return subprocess.Popen(
        [python_path, "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"],
        cwd=backend_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )


def start_frontend():
    """Serve the built frontend files."""
    frontend_dir = os.path.join(BASE_DIR, "frontend", "dist")
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", "3001"],
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )


def open_browser():
    """Wait a few seconds then open the browser."""
    time.sleep(5)
    webbrowser.open("http://localhost:3001")


def shutdown(signum=None, frame=None):
    """Kill child processes on exit."""
    print("\nShutting down SpotyTags Server...")
    if backend_proc:
        backend_proc.terminate()
    if frontend_proc:
        frontend_proc.terminate()
    sys.exit(0)


if __name__ == "__main__":
    # Handle Ctrl+C and window close gracefully
    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, shutdown)

    print("=" * 40)
    print("  Starting SpotyTags Server...")
    print("=" * 40)

    backend_proc = start_backend()
    print("  Backend  -> http://localhost:8001")

    frontend_proc = start_frontend()
    print("  Frontend -> http://localhost:3001")

    threading.Thread(target=open_browser, daemon=True).start()

    print("\n  Opening browser...")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 40)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()
