"""Keep the small-screen stage switcher wired across the UI layers."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MobileContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        cls.script = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
        cls.styles = (ROOT / "web" / "styles.css").read_text(encoding="utf-8")

    def test_mobile_stages_have_named_controls_and_panels(self):
        self.assertIn('id="mobile-nav"', self.html)
        for view in ("library", "test", "results"):
            self.assertIn(f'data-mobile-view="{view}"', self.html)
        for panel in ("library-panel", "test-panel", "results-panel"):
            self.assertIn(f'id="{panel}"', self.html)

    def test_stage_changes_are_wired_to_the_user_flow(self):
        self.assertIn('$("mobile-nav").addEventListener', self.script)
        self.assertIn('setMobileView("test")', self.script)
        self.assertIn('setMobileView("results")', self.script)
        self.assertIn('window.scrollTo({top:0, behavior});', self.script)

    def test_mobile_css_shows_one_stage_and_uses_touch_sized_controls(self):
        self.assertIn('@media (max-width:660px)', self.styles)
        self.assertIn('.workspace[data-mobile-view="library"] > .test-panel', self.styles)
        self.assertIn('.workspace[data-mobile-view="test"] > .library-panel', self.styles)
        self.assertIn('.workspace[data-mobile-view="results"] > .test-panel', self.styles)
        self.assertIn('min-height:44px', self.styles)
        self.assertIn('font-size:16px', self.styles)
        self.assertIn('prefers-reduced-motion: reduce', self.script)


if __name__ == "__main__":
    unittest.main()
