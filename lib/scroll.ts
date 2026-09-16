/** Only explicit completed actions move the viewport; streaming updates never steal it. */
export function revealResults(id: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.top < 0 || bounds.top > innerHeight * 0.65)
      target.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  });
}
