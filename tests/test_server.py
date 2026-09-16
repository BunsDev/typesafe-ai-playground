from __future__ import annotations

import json
import unittest
from urllib.error import HTTPError

from server import (
    UpstreamError,
    build_typesafe_request,
    call_typesafe,
    validate_payload,
)


class FakeResponse:
    def __init__(self, body: dict) -> None:
        self.body = json.dumps(body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit: int) -> bytes:
        return self.body


class ServerContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = {
            "state": "A short post and reply",
            "model": "jev-latest",
            "questions": {
                "intent": {
                    "type": "choice",
                    "instructions": "What is the reply doing?",
                    "criteria": {"question": "seeking information", "bait": "trying to provoke"},
                },
                "urgent": {"type": "noul", "instructions": "Is this urgent?"},
            },
        }

    def test_validation_keeps_the_documented_typesafe_shape(self):
        normalized = validate_payload(self.payload)
        self.assertEqual(normalized["model"], "jev-latest")
        self.assertEqual(normalized["questions"]["intent"]["criteria"]["question"], "seeking information")

    def test_validation_rejects_empty_question_set(self):
        with self.assertRaisesRegex(ValueError, "Select at least one"):
            validate_payload({"state": "hello", "questions": {}})

    def test_validation_rejects_malformed_choice(self):
        payload = {"state": "hello", "questions": {"intent": {"type": "choice", "instructions": "pick"}}}
        with self.assertRaisesRegex(ValueError, "at least two criteria"):
            validate_payload(payload)

    def test_question_keys_cannot_collide_after_trimming(self):
        self.payload["questions"][" intent "] = self.payload["questions"]["urgent"]
        with self.assertRaisesRegex(ValueError, "Question names must be unique"):
            validate_payload(self.payload)

    def test_choice_keys_cannot_collide_after_trimming(self):
        self.payload["questions"]["intent"]["criteria"] = {"yes": "First", " yes ": "Second"}
        with self.assertRaisesRegex(ValueError, "choice names must be unique"):
            validate_payload(self.payload)

    def test_noncolliding_keys_are_still_trimmed(self):
        self.payload["questions"] = {" intent ": self.payload["questions"]["intent"]}
        self.payload["questions"][" intent "]["criteria"] = {" yes ": "First", " no ": "Second"}
        result = validate_payload(self.payload)
        self.assertEqual(list(result["questions"]), ["intent"])
        self.assertEqual(list(result["questions"]["intent"]["criteria"]), ["yes", "no"])

    def test_request_has_bearer_auth_but_no_key_in_body(self):
        request = build_typesafe_request(self.payload, "secret-value", "https://example.test/run")
        self.assertEqual(request.get_header("Authorization"), "Bearer secret-value")
        self.assertEqual(request.get_header("Content-type"), "application/json")
        self.assertNotIn(b"secret-value", request.data)

    def test_call_uses_injected_opener_and_returns_json(self):
        captured = {}

        def opener(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse({"model": "jev-1.13.0", "answers": {}})

        result = call_typesafe(self.payload, api_key="test-key", api_url="https://example.test/run", opener=opener)
        self.assertEqual(result["model"], "jev-1.13.0")
        self.assertEqual(captured["timeout"], 45)
        self.assertEqual(captured["request"].get_header("Authorization"), "Bearer test-key")

    def test_call_fails_clearly_without_a_key(self):
        with self.assertRaises(UpstreamError) as raised:
            call_typesafe(self.payload, api_key="")
        self.assertEqual(raised.exception.status, 503)
        self.assertIn("TYPESAFE_API_KEY", raised.exception.message)

    def test_upstream_error_does_not_echo_key(self):
        key = "test-key"

        def opener(*_args, **_kwargs):
            raise HTTPError(
                "https://example.test/run",
                401,
                "unauthorized",
                {},
                FakeHTTPErrorBody(b'{"detail":"invalid test-key credential"}'),
            )

        with self.assertRaises(UpstreamError) as raised:
            call_typesafe(self.payload, api_key=key, api_url="https://example.test/run", opener=opener)
        self.assertEqual(raised.exception.status, 401)
        self.assertNotIn(key, raised.exception.message)


class FakeHTTPErrorBody:
    def __init__(self, body: bytes) -> None:
        self.body = body

    def read(self, _limit: int) -> bytes:
        return self.body

    def close(self) -> None:
        return None


if __name__ == "__main__":
    unittest.main()
