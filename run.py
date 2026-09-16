from __future__ import annotations

import argparse
import getpass
import os
import sys

from server import serve


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local TypeSafe AI example playground.")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    parser.add_argument("--no-key-prompt", action="store_true", help="Open the catalog without prompting for a key.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    if not os.environ.get("TYPESAFE_API_KEY", "").strip() and not args.no_key_prompt and sys.stdin.isatty():
        try:
            key = getpass.getpass("TypeSafe API key (hidden; Enter for catalog only): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nStartup cancelled.")
            return
        if key:
            os.environ["TYPESAFE_API_KEY"] = key
    try:
        serve("127.0.0.1", args.port)
    except OSError:
        print(f"Could not start on port {args.port}. Try: python3 run.py --port {args.port + 1}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
