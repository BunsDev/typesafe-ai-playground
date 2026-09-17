import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PublicDocument } from "./publicDocument";

export function validateNeweggBrowserUrl(value: string) {
  const target = new URL(value);
  if (
    target.origin !== "https://www.newegg.com" ||
    target.username ||
    target.password ||
    !/^\/(?:[^/]+\/)?p\/(?:pl|[A-Z0-9-]+)$/i.test(target.pathname)
  )
    throw Error("Unsupported browser URL.");
  return target;
}
export function requireLocalBrowser(request: Request) {
  const url = new URL(request.url);
  if (
    process.env.VERCEL ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (request.headers.get("origin") &&
      request.headers.get("origin") !== url.origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw Error(
      "Local browser is available only from this app running on localhost.",
    );
}
class LocalBrowser {
  private process: ChildProcessWithoutNullStreams;
  private startProcess(viewport: { width: number; height: number }) {
    return spawn(
      process.env.UV_EXECUTABLE || "uv",
      [
        "run",
        "--python",
        "3.12",
        "--with",
        "browser-use==0.13.10",
        "python",
        path.join(process.cwd(), "scripts/local-browser.py"),
        String(viewport.width),
        String(viewport.height),
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ANONYMIZED_TELEMETRY: "false" },
      },
    );
  }
  private pending = new Map<
    string,
    { resolve: (value: PublicDocument) => void; reject: (error: Error) => void }
  >();
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private timer: ReturnType<typeof setTimeout>;
  screenshot: string | null = null;
  url = "";
  error: string | null = null;
  busy = false;
  used = false;
  phase = "Ready";
  completedReads = 0;
  constructor(viewport: { width: number; height: number }) {
    this.process = this.startProcess(viewport);
    this.timer = setTimeout(() => this.close(), 10 * 60_000);
    this.timer.unref();
    this.process.stdin.on("error", () =>
      this.close("Local browser input closed."),
    );
    this.process.stderr.on("data", () => {}); // Library diagnostics never enter reports or expose environment data.
    createInterface({ input: this.process.stdout }).on("line", (line) => {
      try {
        const message = JSON.parse(line);
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          this.error = message.error;
          pending.reject(Error(message.error));
        } else {
          this.error = null;
          this.screenshot = message.result.screenshot;
          this.url = message.result.url;
          pending.resolve({
            url: message.result.url,
            body: message.result.body,
            contentType: "text/html",
          });
        }
      } catch {
        /* Ignore non-protocol library output. */
      }
    });
    this.process.on("error", () =>
      this.close(
        "Could not start uv. Install uv and Chromium for local browser-use.",
      ),
    );
    this.process.on("exit", () =>
      this.close("Local browser session ended. Start a new run."),
    );
  }
  read = (url: string, signal: AbortSignal): Promise<PublicDocument> => {
    const run = this.queue.then(async () => {
      signal.throwIfAborted();
      if (this.closed) throw Error(this.error || "Local browser closed.");
      validateNeweggBrowserUrl(url);
      return new Promise<PublicDocument>((resolve, reject) => {
        const id = randomUUID();
        const deadline = setTimeout(
          () => this.close("Local browser read timed out."),
          90_000,
        );
        const abort = () => this.close("Local browser run stopped.");
        signal.addEventListener("abort", abort, { once: true });
        const finish = () => {
          clearTimeout(deadline);
          signal.removeEventListener("abort", abort);
        };
        this.pending.set(id, {
          resolve: (value) => {
            finish();
            resolve(value);
          },
          reject: (error) => {
            finish();
            reject(error);
          },
        });
        this.process.stdin.write(JSON.stringify({ id, url }) + "\n");
      });
    });
    this.queue = run.catch(() => {});
    return run;
  };
  close(reason = "Local browser closed.") {
    if (this.closed) return;
    this.closed = true;
    this.error = reason;
    clearTimeout(this.timer);
    this.process.stdin.end();
    const process = this.process;
    const kill = setTimeout(() => process.kill(), 5000);
    kill.unref();
    for (const pending of this.pending.values()) pending.reject(Error(reason));
    this.pending.clear();
  }
}
const globalStore = globalThis as typeof globalThis & {
  localBrowsers?: Map<string, LocalBrowser>;
  localBrowserStarts?: number[];
};
const sessions = (globalStore.localBrowsers ??= new Map());
export function createLocalBrowser(viewport = { width: 1440, height: 900 }) {
  const now = Date.now();
  const starts = (globalStore.localBrowserStarts ?? []).filter(
    (time) => now - time < 60_000,
  );
  if (starts.length >= 3)
    throw Error("Local browser start limit reached. Try again in a minute.");
  globalStore.localBrowserStarts = starts;
  if (sessions.size >= 3)
    throw Error("Close an existing local browser before starting another.");
  starts.push(now);
  const id = randomUUID();
  sessions.set(id, new LocalBrowser(viewport));
  const expiry = setTimeout(() => {
    sessions.get(id)?.close();
    sessions.delete(id);
  }, 10 * 60_000);
  expiry.unref();
  return id;
}
export function getLocalBrowser(id: string) {
  const session = sessions.get(id);
  if (!session)
    throw Error("Local browser session not found. Start a new run.");
  return session;
}
export function closeLocalBrowser(id: string) {
  sessions.get(id)?.close();
  sessions.delete(id);
}
