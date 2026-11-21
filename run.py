import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    reload_mode = os.environ.get("RELOAD", "true").lower() in ("true", "1", "yes")
    print(f"Starting FormGate backend on http://{host}:{port} (reload={reload_mode})")
    uvicorn.run("app.main:app", host=host, port=port, app_dir=backend_dir, reload=reload_mode)

