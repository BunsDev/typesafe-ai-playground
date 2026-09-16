"""Check the complete authored library against the actual proxy contract."""
import json
from copy import deepcopy
from pathlib import Path
import unittest
from server import validate_payload


class CatalogContractTests(unittest.TestCase):
    def test_every_authored_state_and_question_set_is_accepted(self):
        path = Path(__file__).resolve().parents[1] / "web" / "catalog.json"
        catalog = json.loads(path.read_text(encoding="utf-8"))
        seen = set()
        for pack in catalog["packs"]:
            for example in pack["examples"]:
                with self.subTest(example=example["id"]):
                    self.assertNotIn(example["id"], seen)
                    seen.add(example["id"])
                    questions = example.get("questions") or pack["questions"]
                    payload = validate_payload({
                        "state": example["state"],
                        "model": "jev-latest",
                        "questions": {q["id"]: q for q in questions},
                    })
                    self.assertEqual(len(payload["questions"]), len(questions))
                    if "comparison" in example:
                        variant = deepcopy(example["state"])
                        node = variant
                        for key in example["comparison"]["path"][:-1]:
                            node = node[key]
                        node[example["comparison"]["path"][-1]] = example["comparison"]["value"]
                        self.assertEqual(validate_payload({**payload, "state": variant})["state"], variant)
        self.assertGreaterEqual(len(seen), 110)
