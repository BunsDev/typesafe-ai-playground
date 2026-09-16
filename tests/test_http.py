import http.client
import json
from http.server import ThreadingHTTPServer
from threading import Thread
import unittest
from unittest.mock import patch

from server import PlaygroundHandler


class QuietHandler(PlaygroundHandler):
    def log_message(self, *_args):
        pass


class LocalHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path="/api/health", method="GET", headers=None, body=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        status = response.status
        connection.close()
        return status, data

    def test_health_and_catalog_are_served_without_revealing_key(self):
        with patch.dict("os.environ", {"TYPESAFE_API_KEY": "example-secret"}):
            status, raw = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {"ok": True, "configured": True})
        self.assertNotIn(b"example-secret", raw)
        status, raw = self.request("/catalog.json")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["schemaVersion"], 1)

    def test_rebinding_host_is_rejected(self):
        self.assertEqual(self.request(headers={"Host": "untrusted.example"})[0], 403)

    def test_cross_origin_request_never_reaches_provider(self):
        with patch("server.call_typesafe") as upstream:
            status, _ = self.request("/api/run", "POST",
                {"Origin": "https://untrusted.example", "Content-Type": "application/json"},
                '{"state":"test","questions":{}}')
        self.assertEqual(status, 403)
        upstream.assert_not_called()

    def test_plain_text_form_cannot_spend_key(self):
        self.assertEqual(self.request("/api/run", "POST",
            {"Content-Type": "text/plain"}, '{}')[0], 415)

    def test_same_origin_request_reaches_proxy(self):
        payload = {"state": "Synthetic test", "questions": {
            "check": {"type": "noul", "instructions": "Is this a test?"}}}
        with patch("server.call_typesafe", return_value={"answers": {}}) as upstream:
            status, _ = self.request("/api/run", "POST", {
                "Content-Type": "application/json",
                "Origin": f"http://127.0.0.1:{self.server.server_port}"
            }, json.dumps(payload))
        self.assertEqual(status, 200)
        upstream.assert_called_once()

    def test_private_project_paths_are_not_served(self):
        for path in ["/../server.py", "/%2e%2e/server.py", "/.agent/state.md"]:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)
