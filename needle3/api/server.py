
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from cactus import Needle, tool


@tool
def activate_defcon(level: int):
    """Set the simulated NORAD DEFCON level from 1 to 5."""
    if not 1 <= level <= 5:
        return {"error": "DEFCON must be between 1 and 5"}
    return {"action": "activate_defcon", "level": level}


@tool
def launch_simulation(target: str):
    """Start a fictional WOPR military simulation for a named target."""
    return {"action": "launch_simulation", "target": target}


model = Needle(tools=[activate_defcon, launch_simulation])
model_lock = threading.Lock()


class APIHandler(BaseHTTPRequestHandler):

    def respond(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.respond(200, {
                "status": "ok",
                "service": "needle3",
                "engine": "cactus"
            })
        else:
            self.respond(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/command":
            self.respond(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))

            if length <= 0 or length > 8192:
                self.respond(400, {"error": "Invalid request size"})
                return

            payload = json.loads(self.rfile.read(length))
            command = payload.get("command")

            if not isinstance(command, str) or not command.strip():
                self.respond(400, {"error": "Missing command"})
                return

            with model_lock:
                result = model.run(command, max_steps=1)

            self.respond(200, result)

        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.respond(400, {"error": str(exc)})
        except Exception:
            self.respond(500, {"error": "Internal server error"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), APIHandler)

    print(f"Needle 3 API listening on port {port}", flush=True)

    try:
        server.serve_forever()
    finally:
        model.close()
