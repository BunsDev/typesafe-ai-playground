import os
import unittest
from unittest.mock import patch

from run import main


class StartupTests(unittest.TestCase):
    def start(self, args=(), environment=None, interactive=True, answer=""):
        with patch.dict(os.environ, environment or {}, clear=True), \
                patch("sys.argv", ["run.py", *args]), \
                patch("sys.stdin.isatty", return_value=interactive), \
                patch("getpass.getpass", return_value=answer) as prompt, \
                patch("run.serve") as serve:
            main()
            return prompt.call_count, serve.call_args.args, os.environ.get("TYPESAFE_API_KEY")

    def test_hidden_prompt_places_key_only_in_runtime_environment(self):
        calls, address, key = self.start(answer="  synthetic-test-key  ")
        self.assertEqual(calls, 1)
        self.assertEqual(address, ("127.0.0.1", 8765))
        self.assertEqual(key, "synthetic-test-key")

    def test_existing_environment_key_does_not_prompt(self):
        calls, _, key = self.start(environment={"TYPESAFE_API_KEY": "synthetic-test-key"})
        self.assertEqual(calls, 0)
        self.assertEqual(key, "synthetic-test-key")

    def test_empty_prompt_starts_catalog_only(self):
        calls, _, key = self.start()
        self.assertEqual(calls, 1)
        self.assertIsNone(key)

    def test_explicit_catalog_only_mode_and_port(self):
        calls, address, key = self.start(args=("--no-key-prompt", "--port", "8766"))
        self.assertEqual(calls, 0)
        self.assertEqual(address, ("127.0.0.1", 8766))
        self.assertIsNone(key)

    def test_noninteractive_start_does_not_prompt(self):
        calls, _, key = self.start(interactive=False)
        self.assertEqual(calls, 0)
        self.assertIsNone(key)

    def test_port_environment_is_supported(self):
        _, address, _ = self.start(environment={"PORT": "9876"})
        self.assertEqual(address, ("127.0.0.1", 9876))
