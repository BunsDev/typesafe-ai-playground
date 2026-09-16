from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parent
WEB_ROOT = PROJECT_ROOT / "web"
DEFAULT_MODEL = "jev-latest"
DEFAULT_API_URL = "https://api.typesafe.ai/v1/systemone"
MAX_BODY_BYTES = 512 * 1024
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class ValidationError(ValueError):
    """A safe, user-facing request validation error."""


class UpstreamError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be a non-empty string.")
    return value.strip()


def validate_payload(payload: Any) -> dict[str, Any]:
    """Validate and normalize the small API shape exposed by the playground."""
    if not isinstance(payload, dict):
        raise ValidationError("Request must be a JSON object.")
    if "state" not in payload:
        raise ValidationError("Add some state before running questions.")

    state = payload["state"]
    if isinstance(state, str):
        if not state.strip():
            raise ValidationError("State must not be empty.")
    elif not isinstance(state, (dict, list)):
        raise ValidationError("State must be text, an object, or an array.")

    questions = payload.get("questions")
    if not isinstance(questions, dict) or not questions:
        raise ValidationError("Select at least one question.")
    if len(questions) > 100:
        raise ValidationError("A run can contain at most 100 questions.")

    normalized_questions: dict[str, dict[str, Any]] = {}
    for key, question in questions.items():
        if not isinstance(key, str) or not key.strip():
            raise ValidationError("Every question needs a name.")
        clean_question_key = key.strip()
        if clean_question_key in normalized_questions:
            raise ValidationError("Question names must be unique after trimming whitespace.")
        if not isinstance(question, dict):
            raise ValidationError(f"Question '{key}' must be an object.")

        question_type = _nonempty_string(question.get("type"), f"Question '{key}' type").lower()
        if question_type not in {"noul", "choice", "score"}:
            raise ValidationError(f"Question '{key}' uses an unsupported type.")

        normalized: dict[str, Any] = {
            "type": question_type,
            "instructions": _nonempty_string(
                question.get("instructions"), f"Question '{key}' instructions"
            ),
        }

        if question_type == "choice":
            criteria = question.get("criteria")
            if not isinstance(criteria, dict) or len(criteria) < 2:
                raise ValidationError(f"Choice question '{key}' needs at least two criteria.")
            normalized_criteria: dict[str, str] = {}
            for criterion_key, description in criteria.items():
                clean_key = _nonempty_string(criterion_key, f"Question '{key}' criterion name")
                if clean_key in normalized_criteria:
                    raise ValidationError(f"Question '{key}' choice names must be unique after trimming whitespace.")
                normalized_criteria[clean_key] = _nonempty_string(
                    description, f"Question '{key}' criterion '{clean_key}'"
                )
            normalized["criteria"] = normalized_criteria

        if question_type == "score":
            criteria = question.get("criteria")
            if not isinstance(criteria, list) or len(criteria) < 2:
                raise ValidationError(f"Score question '{key}' needs at least two levels.")
            normalized["criteria"] = [
                _nonempty_string(item, f"Question '{key}' score level") for item in criteria
            ]

        normalized_questions[clean_question_key] = normalized

    model = payload.get("model", DEFAULT_MODEL)
    if not isinstance(model, str) or not model.strip():
        model = DEFAULT_MODEL

    return {"state": state, "model": model.strip(), "questions": normalized_questions}


def build_typesafe_request(
    payload: dict[str, Any], api_key: str, api_url: str = DEFAULT_API_URL
) -> Request:
    """Build the upstream request without exposing credentials to callers."""
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return Request(
        api_url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )


def _safe_upstream_message(status: int, raw_body: bytes, api_key: str) -> str:
    """Return a short error while making a best effort to redact the key."""
    message = f"TypeSafe returned HTTP {status}."
    try:
        decoded = json.loads(raw_body.decode("utf-8"))
        candidate = decoded.get("detail") or decoded.get("error") or decoded.get("message")
        if isinstance(candidate, str) and candidate.strip():
            message = candidate.strip()
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
        pass
    return message.replace(api_key, "[redacted]")[:240]


def call_typesafe(
    payload: dict[str, Any],
    *,
    api_key: str | None = None,
    api_url: str | None = None,
    opener: Callable[..., Any] = urlopen,
    timeout: float = 45,
) -> dict[str, Any]:
    """Send one validated request to TypeSafe and return its JSON response."""
    key = api_key if api_key is not None else os.environ.get("TYPESAFE_API_KEY", "")
    if not key.strip():
        raise UpstreamError(503, "TYPESAFE_API_KEY is not configured for this local server.")
    key = key.strip()

    request = build_typesafe_request(
        payload,
        key.strip(),
        api_url or os.environ.get("TYPESAFE_API_URL", DEFAULT_API_URL),
    )
    try:
        with opener(request, timeout=timeout) as response:
            raw_body = response.read(MAX_RESPONSE_BYTES)
        decoded = json.loads(raw_body.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise UpstreamError(502, "TypeSafe returned an unexpected response.")
        return decoded
    except HTTPError as error:
        raw_body = error.read(MAX_RESPONSE_BYTES)
        raise UpstreamError(error.code, _safe_upstream_message(error.code, raw_body, key)) from None
    except (URLError, TimeoutError, OSError):
        raise UpstreamError(502, "The local server could not reach TypeSafe.") from None
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise UpstreamError(502, "TypeSafe returned invalid JSON.") from None


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False).encode("utf-8")


class PlaygroundHandler(BaseHTTPRequestHandler):
    server_version = "TypeSafePlayground/0.1"

    def _local_request(self) -> bool:
        port = self.server.server_port
        host = self.headers.get("Host", "")
        if host not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
            self._send_json({"error": "Use the local playground address."}, HTTPStatus.FORBIDDEN)
            return False
        origin = self.headers.get("Origin")
        if (origin and origin != f"http://{host}") or self.headers.get("Sec-Fetch-Site") == "cross-site":
            self._send_json({"error": "Cross-site requests are not allowed."}, HTTPStatus.FORBIDDEN)
            return False
        return True

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def _send_json(self, value: Any, status: int = HTTPStatus.OK) -> None:
        body = _json_bytes(value)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Any:
        content_length = self.headers.get("Content-Length")
        try:
            length = int(content_length or "0")
        except ValueError:
            raise ValidationError("Content-Length must be a number.") from None
        if length <= 0:
            raise ValidationError("Request body is empty.")
        if length > MAX_BODY_BYTES:
            raise ValidationError("Request body is too large.")
        raw_body = self.rfile.read(length)
        try:
            return json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValidationError("Request body must be valid JSON.") from None

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if not self._local_request():
            return
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send_json(
                {
                    "ok": True,
                    "configured": bool(os.environ.get("TYPESAFE_API_KEY", "").strip()),
                }
            )
            return
        self._serve_static(path)

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if not self._local_request():
            return
        path = urlsplit(self.path).path
        if path != "/api/run":
            self._send_json({"error": "Not found."}, HTTPStatus.NOT_FOUND)
            return
        if self.headers.get_content_type() != "application/json":
            self._send_json({"error": "Use Content-Type: application/json."}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return
        try:
            payload = validate_payload(self._read_json_body())
            response = call_typesafe(payload)
        except ValidationError as error:
            self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
            return
        except UpstreamError as error:
            self._send_json({"error": error.message}, error.status)
            return
        self._send_json(response)

    def _serve_static(self, path: str) -> None:
        relative = unquote(path.lstrip("/")) or "index.html"
        candidate = (WEB_ROOT / relative).resolve()
        try:
            candidate.relative_to(WEB_ROOT.resolve())
        except ValueError:
            self._send_json({"error": "Not found."}, HTTPStatus.NOT_FOUND)
            return
        if not candidate.is_file():
            self._send_json({"error": "Not found."}, HTTPStatus.NOT_FOUND)
            return

        content_type = {
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".html": "text/html; charset=utf-8",
            ".json": "application/json; charset=utf-8",
        }.get(candidate.suffix, "application/octet-stream")
        body = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        # Keep logs useful without ever including request bodies or headers.
        path = urlsplit(self.path).path
        print(f"[playground] {self.command} {path}")


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    httpd = ThreadingHTTPServer((host, port), PlaygroundHandler)
    print(f"TypeSafe AI Playground: http://{host}:{port}")
    print("API key status: configured" if os.environ.get("TYPESAFE_API_KEY", "").strip() else "API key status: not configured")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    serve()
