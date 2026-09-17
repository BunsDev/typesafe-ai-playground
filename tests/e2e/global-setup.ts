import { execFileSync } from "node:child_process";
/**
 * Refuses to test an application that is not this checkout.
 *
 * `reuseExistingServer` adopts whatever is already listening on the port, and
 * it cannot tell one Next app from another. Observed: a `next dev` from an
 * unrelated worktree held 3001, and a full suite reported green against a
 * different application — new tests appeared to fail, unrelated ones appeared
 * to pass, and nothing in the output said the app under test was not this one.
 *
 * Playwright starts (or reuses) the web server before this hook, so by now
 * something is listening. Whatever it is, its working directory says which
 * checkout it belongs to: a server this run started inherits the repository
 * root, and a stranger does not.
 */
export default function globalSetup() {
  const port = process.env.E2E_PORT || "3001";
  const root = process.cwd();
  let pid: string;
  try {
    pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")[0];
  } catch {
    // No lsof, or nothing listening: leave it to Playwright's own webServer
    // handling rather than inventing a second failure mode.
    return;
  }
  if (!pid) return;
  let cwd = "";
  try {
    cwd = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .find((line) => line.startsWith("n"))!
      .slice(1);
  } catch {
    return;
  }
  if (cwd && cwd !== root)
    throw Error(
      `Port ${port} is served by a process from ${cwd}, not this checkout (${root}).\n` +
        `Testing it would report results for a different application. Stop that ` +
        `server, or run with E2E_PORT set to a free port.`,
    );
}
