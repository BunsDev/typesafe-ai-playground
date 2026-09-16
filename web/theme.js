(() => {
  "use strict";
  const key = "typesafe-playground-theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  if (preference !== "light" && preference !== "dark") preference = null;

  function applyTheme() {
    const dark = preference ? preference === "dark" : system.matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#10131b" : "#f4f6f8";
    const button = document.getElementById("theme-toggle");
    if (button) button.setAttribute("aria-pressed", String(dark));
  }

  // Apply before the stylesheet loads to avoid a flash of the wrong theme.
  applyTheme();
  system.addEventListener("change", applyTheme);
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    document.getElementById("theme-toggle").addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, preference); } catch { /* Keep the choice for this page. */ }
      applyTheme();
    });
  });
})();
