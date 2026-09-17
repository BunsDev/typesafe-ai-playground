export function BrowserAgentGuide() {
  return (
    <article className="agent-guide" aria-label="About this example">
      <h2>A local browser with closed choices</h2>
      <p>
        Choose the Newegg preset and run Find PC parts. The app opens an
        isolated local browser-use session, reads rendered listings, and shows
        each observed page here. Jev ranks candidate IDs; code selects one part
        per category within the $2,500 budget and rechecks all eight product
        pages. No text-generation model is required.
      </p>
      <p>
        If Jev reaches its billing or quota limit, the run continues with a
        labeled local price-only baseline. Inspector retains the provider error.
        Review this baseline as a starting point, not a performance ranking.
      </p>
      <h3>Local setup</h3>
      <p>
        Run this app on localhost with uv installed, Chromium available, and
        TYPESAFE_API_KEY configured. Install Chromium with{" "}
        <code>pnpm exec playwright install chromium</code>. The first run
        downloads the pinned browser-use Python package.
        LOCAL_BROWSER_EXECUTABLE can select another Chromium executable. Hosted
        deployments cannot start a browser on your computer.
      </p>
      <h3>What the browser does</h3>
      <p>
        This is a focused Newegg research workflow: nine AM5/DDR5 listing
        searches and eight product checks. It navigates and reads pages without
        adding to cart or purchasing. The viewport shows captured browser
        observations; it is not an interactive remote desktop. Challenges or
        unavailable listings remain coverage gaps.
      </p>
      <h3>Evidence and limits</h3>
      <p>
        Open Inspector for candidate IDs, prices, specifications, budget totals,
        and Copy debug report. The report includes rendered-document URL traces
        and hashes, exact Jev requests and responses, timing, provider token
        usage when available, and unresolved verification gaps. Prices exclude
        tax and shipping. No benchmark, exhaustive market search, or complete
        compatibility guarantee is implied.
      </p>
      <h3>Flight sandbox</h3>
      <p>
        The optional flight preset demonstrates the observe–choose–validate–act
        loop on a synthetic page. Jev chooses operations, target IDs, and
        literal goal spans for text fields. A BLOCKED response gets an
        independent completion check and one fresh observation before stopping.
        Flight checks apply only to the flight preset.
      </p>
      <p>
        The flight loop is based on{" "}
        <a
          href="https://github.com/browser-use/jev-ultrafast"
          target="_blank"
          rel="noreferrer"
        >
          browser-use/jev-ultrafast
        </a>
        . The PC workflow uses browser-use directly for local navigation and
        observation.
      </p>
    </article>
  );
}
