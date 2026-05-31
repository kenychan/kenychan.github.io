
import os
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

PORT = 8000
SAVE_DIR = "saved"

# create save folder if missing
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)


# ─────────────────────────────────────────────
# HTTP HANDLER
# ─────────────────────────────────────────────

class Handler(SimpleHTTPRequestHandler):

    # ─────────────────────────────
    # GET REQUESTS
    # ─────────────────────────────
    def do_GET(self):

        # LOAD ALL SAVES
        if self.path == "/saves":

            saves = {}

            for file in os.listdir(SAVE_DIR):

                if not file.endswith(".json"):
                    continue

                filepath = os.path.join(
                    SAVE_DIR,
                    file
                )

                try:

                    with open(
                        filepath,
                        "r",
                        encoding="utf-8"
                    ) as f:

                        saves[file[:-5]] = json.load(f)

                except Exception as e:

                    print("Load error:", e)

            self.send_response(200)

            self.send_header(
                "Content-Type",
                "application/json"
            )

            self.end_headers()

            self.wfile.write(
                json.dumps(saves).encode("utf-8")
            )

            return

        # NORMAL FILE SERVING
        return super().do_GET()

    # ─────────────────────────────
    # POST REQUESTS
    # ─────────────────────────────
    def do_POST(self):

        # ─────────────────────────
        # SAVE GAME
        # ─────────────────────────
        if self.path == "/save":

            try:

                length = int(
                    self.headers["Content-Length"]
                )

                body = self.rfile.read(length)

                data = json.loads(
                    body.decode("utf-8")
                )

                name = data["name"]
                save_data = data["data"]

                # sanitize filename
                name = "".join(
                    c for c in name
                    if c not in r'\/:*?"<>|'
                ).strip()

                if not name:
                    raise Exception(
                        "Invalid save name"
                    )

                filepath = os.path.join(
                    SAVE_DIR,
                    f"{name}.json"
                )

                with open(
                    filepath,
                    "w",
                    encoding="utf-8"
                ) as f:

                    json.dump(
                        save_data,
                        f,
                        indent=2,
                        ensure_ascii=False
                    )

                self.send_response(200)

                self.end_headers()

                self.wfile.write(b"ok")

                print(f"[SAVE] {name}")

                return

            except Exception as e:

                print("Save error:", e)

                self.send_response(500)
                self.end_headers()

                self.wfile.write(
                    str(e).encode("utf-8")
                )

                return

        # ─────────────────────────
        # DELETE SAVE
        # ─────────────────────────
        if self.path == "/delete-save":

            try:

                length = int(
                    self.headers["Content-Length"]
                )

                body = self.rfile.read(length)

                data = json.loads(
                    body.decode("utf-8")
                )

                name = data["name"]

                filepath = os.path.join(
                    SAVE_DIR,
                    f"{name}.json"
                )

                if os.path.exists(filepath):

                    os.remove(filepath)

                    print(f"[DELETE] {name}")

                self.send_response(200)

                self.end_headers()

                self.wfile.write(b"deleted")

                return

            except Exception as e:

                print("Delete error:", e)

                self.send_response(500)
                self.end_headers()

                self.wfile.write(
                    str(e).encode("utf-8")
                )

                return

        # UNKNOWN POST
        self.send_response(404)
        self.end_headers()


# ─────────────────────────────────────────────
# START SERVER
# ─────────────────────────────────────────────

print("====================================")
print(" MiniHouse Server Running")
print("====================================")
print(f"URL: http://localhost:{PORT}")
print(f"Saves Folder: ./{SAVE_DIR}")
print("====================================")

HTTPServer(
    ("0.0.0.0", PORT),
    Handler
).serve_forever()

