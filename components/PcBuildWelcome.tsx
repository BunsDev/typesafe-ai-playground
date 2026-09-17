import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  HardDrive,
  Zap,
  Box,
  Wind,
  Monitor,
  ArrowUpRight,
} from "lucide-react";
const components = [
  [Monitor, "Graphics"],
  [Cpu, "Processor"],
  [CircuitBoard, "Board"],
  [MemoryStick, "Memory"],
  [HardDrive, "Storage"],
  [Zap, "Power"],
  [Box, "Case"],
  [Wind, "Cooling"],
] as const;
/** Decorative chassis sketch; never presented as a selected product. */
function TowerSketch() {
  return (
    <svg
      viewBox="0 0 430 350"
      fill="none"
      aria-hidden="true"
      className="pc-tower-sketch"
    >
      <defs>
        <linearGradient
          id="tower-face"
          x1="108"
          y1="50"
          x2="290"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity=".08" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".01" />
        </linearGradient>
        <linearGradient
          id="tower-edge"
          x1="300"
          y1="85"
          x2="300"
          y2="278"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--accent)" stopOpacity=".65" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity=".06" />
        </linearGradient>
        <radialGradient id="tower-light">
          <stop stopColor="var(--accent)" stopOpacity=".15" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="217" cy="190" rx="194" ry="150" fill="url(#tower-light)" />
      <path
        d="M52 289 202 339 393 264M51 258 198 308 384 234M78 318 354 226"
        stroke="currentColor"
        strokeOpacity=".045"
      />
      <path
        d="M104 60 238 28 334 76 202 110Z"
        fill="url(#tower-face)"
        stroke="currentColor"
        strokeOpacity=".2"
      />
      <path
        d="M104 60 202 110 202 312 104 260Z"
        fill="url(#tower-face)"
        stroke="currentColor"
        strokeOpacity=".25"
      />
      <path
        d="M202 110 334 76 334 278 202 312Z"
        fill="url(#tower-face)"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <path
        d="M211 117 325 88 325 268 211 298Z"
        stroke="currentColor"
        strokeOpacity=".1"
      />
      <path d="M317 91V266" stroke="url(#tower-edge)" strokeWidth="2" />
      <path
        d="M116 79 190 117 190 270 116 233Z"
        stroke="currentColor"
        strokeOpacity=".17"
      />
      <path
        d="M126 112 163 130 163 169 126 151Z"
        fill="var(--accent)"
        fillOpacity=".08"
        stroke="var(--accent)"
        strokeOpacity=".65"
      />
      <path
        d="M134 125 154 135 154 155 134 145Z"
        stroke="var(--accent)"
        strokeOpacity=".5"
      />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${172 + i * 5} ${135 + i * 2.5}v45`}
          stroke="currentColor"
          strokeOpacity=".23"
          strokeWidth="2"
        />
      ))}
      <path
        d="M123 181 185 212 185 233 123 202Z"
        fill="var(--accent)"
        fillOpacity=".12"
        stroke="var(--accent)"
        strokeOpacity=".6"
      />
      <path d="M128 188 179 214" stroke="var(--accent)" strokeOpacity=".5" />
      <path
        d="M121 220 182 251M121 227 155 244"
        stroke="currentColor"
        strokeOpacity=".2"
      />
      {[148, 207, 264].map((y, i) => (
        <g
          key={y}
          transform={`translate(267 ${y}) skewY(-14)`}
          opacity={1 - i * 0.15}
        >
          <circle r="23" stroke="var(--accent)" strokeOpacity=".55" />
          <circle r="17" stroke="currentColor" strokeOpacity=".14" />
          <circle r="6" fill="var(--accent)" fillOpacity=".3" />
          <path
            d="M0-6C-7-19-18-9-9 0M6 0C19-7 9-18 0-9M0 6C7 19 18 9 9 0M-6 0C-19 7-9 18 0 9"
            stroke="var(--accent)"
            strokeOpacity=".35"
          />
        </g>
      ))}
      <path
        d="m202 312 0 8 15-4v-8M321 281v8l13-4v-7M105 260v9l13 7v-9"
        stroke="currentColor"
        strokeOpacity=".3"
      />
      <path
        d="m224 57 26 13M261 73l13 6"
        stroke="currentColor"
        strokeOpacity=".3"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="285" cy="80" r="2" fill="var(--accent)" fillOpacity=".75" />
      <path
        d="M57 102H85L129 137M333 160H369M182 289H69"
        stroke="currentColor"
        strokeOpacity=".2"
        strokeDasharray="3 4"
      />
      <circle cx="129" cy="137" r="2" fill="var(--accent)" />
      <circle cx="333" cy="160" r="2" fill="var(--accent)" />
      <circle cx="182" cy="289" r="2" fill="var(--accent)" />
      <text
        x="22"
        y="97"
        fill="currentColor"
        opacity=".45"
        fontSize="8"
        fontFamily="monospace"
      >
        AM5 / DDR5
      </text>
      <text
        x="348"
        y="151"
        fill="currentColor"
        opacity=".45"
        fontSize="8"
        fontFamily="monospace"
      >
        AIRFLOW
      </text>
      <text
        x="22"
        y="283"
        fill="currentColor"
        opacity=".45"
        fontSize="8"
        fontFamily="monospace"
      >
        TOWER ONLY
      </text>
    </svg>
  );
}
export function PcBuildWelcome({ busy }: { busy: boolean }) {
  return (
    <div className={`pc-landing${busy ? " is-browsing" : ""}`}>
      <div className="pc-landing-content">
        <div className="pc-hero-row">
          <div className="pc-hero-copy">
            <div className="pc-eyebrow">
              <span /> LOCAL BROWSER / NEWEGG
            </div>
            <h2>
              {busy ? (
                <>
                  Good parts.
                  <br />
                  <em>Worth finding.</em>
                </>
              ) : (
                <>
                  Your next build.
                  <br />
                  <em>From the ground up.</em>
                </>
              )}
            </h2>
            <p>
              {busy
                ? "Opening your local browser and reading live listings. The page will appear here as soon as it's ready."
                : "Turn a budget into a parts list you can inspect. Live listings, clear sources, and room for your own judgment."}
            </p>
            <div className="pc-budget-line">
              <div>
                <strong>
                  $2,500<span>USD</span>
                </strong>
                <small>Your budget</small>
              </div>
              <div>
                <strong>1440p</strong>
                <small>Made for gaming</small>
              </div>
              <div>
                <strong>
                  8<span>parts</span>
                </strong>
                <small>One complete tower</small>
              </div>
            </div>
          </div>
          <div className="pc-hero-art">
            <TowerSketch />
            <span className="pc-sketch-caption">
              A plan for every component <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
        {!busy && (
          <>
            <div
              className="pc-parts-ribbon"
              aria-label="Eight component categories"
            >
              {components.map(([Icon, label], index) => (
                <div key={label}>
                  <Icon size={18} strokeWidth={1.5} />
                  <span>{label}</span>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </div>
              ))}
            </div>
            <ol
              className="pc-quickstart"
              aria-label="How this browser agent works"
            >
              <li>
                <span>01</span>
                <div>
                  <strong>Set the direction</strong>
                  <p>Use the preset or refine your goal below.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Follow the research</strong>
                  <p>The browser reads. Jev ranks. Code checks the budget.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Make it yours</strong>
                  <p>
                    Review parts, source links, and verification gaps in
                    Inspector.
                  </p>
                </div>
              </li>
            </ol>
            <p className="pc-landing-note">
              No cart changes. No text model. If Jev is unavailable, we show a
              local price-only baseline.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
