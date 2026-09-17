import { serverJevTransport } from "../../../lib/serverJev";
import { createHash } from "node:crypto";
import { ResearchMeter } from "../../../lib/researchMetrics";
import { readBoundedBody } from "../../../lib/api";
import {
  collectParts,
  PART_SEARCHES,
  verifySelectedParts,
} from "../../../lib/neweggResearch";
import { resolveBrowserContext } from "../../../lib/browserTaskContext";
import {
  getLocalBrowser,
  requireLocalBrowser,
} from "../../../lib/localBrowser";
import {
  selectPcBuild,
  localBudgetBuild,
  type SelectionExchange,
} from "../../../lib/pcSelection";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export async function POST(request: Request) {
  const started = performance.now();
  const meter = new ResearchMeter();
  const documentReads: object[] = [];
  const selectionExchanges: SelectionExchange[] = [];
  const respond = (body: object, status = 200) =>
    Response.json(
      {
        ...body,
        executor: "local browser-use",
        documentReads,
        selectionExchanges,
        metrics: meter.finish(),
        elapsedMs: Math.round(performance.now() - started),
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  let goal: string, sessionId: string;
  let localOnly = false;
  try {
    requireLocalBrowser(request);
    const input = JSON.parse(await readBoundedBody(request.body, 4096));
    goal = input.goal;
    sessionId = input.sessionId;
    localOnly = input.selectionMode === "local";
    if (
      typeof goal !== "string" ||
      resolveBrowserContext(goal).kind !== "newegg"
    )
      throw Error(
        "This endpoint requires the $2,500 USD / 1440p Newegg PC goal.",
      );
    if (typeof sessionId !== "string")
      throw Error("Start a local browser session before researching.");
  } catch (error) {
    return respond(
      { error: error instanceof Error ? error.message : "Invalid request." },
      400,
    );
  }
  let session: ReturnType<typeof getLocalBrowser>;
  try {
    session = getLocalBrowser(sessionId);
  } catch (error) {
    return respond({ error: String(error) }, 400);
  }
  if (session.busy)
    return respond({ error: "This browser is already running a task." }, 409);
  session.busy = true;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(550000)]);
  const read = async (url: string, signal: AbortSignal) => {
    meter.documentCalls++;
    const began = performance.now();
    const trace = {
      url,
      startedAt: new Date().toISOString(),
      elapsedMs: 0,
      finalUrl: null as string | null,
      bytes: null as number | null,
      sha256: null as string | null,
      error: null as string | null,
    };
    documentReads.push(trace);
    try {
      const document = await session.read(url, signal);
      trace.finalUrl = document.url;
      trace.bytes = Buffer.byteLength(document.body);
      trace.sha256 = createHash("sha256").update(document.body).digest("hex");
      return document;
    } catch (error) {
      trace.error = String(error);
      throw error;
    } finally {
      trace.elapsedMs = Math.round(performance.now() - began);
    }
  };
  let collection: Awaited<ReturnType<typeof collectParts>> | undefined;
  try {
    collection = await collectParts(signal, read);
    const missing = Object.keys(PART_SEARCHES).filter(
      (category) =>
        !collection!.candidates.some((c) => c.category === category),
    );
    if (missing.length)
      return respond({
        ...collection,
        build: null,
        error: `No verified listings for: ${missing.join(", ")}. Cannot produce a complete PC build.`,
      });
    let build;
    try {
      build = localOnly
        ? localBudgetBuild(
            collection.candidates,
            "Local selection requested; Jev was not called.",
          )
        : await selectPcBuild(
            collection.candidates,
            goal,
            signal,
            selectionExchanges,
            (payload, signal) =>
              serverJevTransport(
                payload,
                signal,
                request.headers.get("x-typesafe-api-key"),
              ),
          );
    } finally {
      meter.modelCalls = selectionExchanges.length;
      const exchange = selectionExchanges[0];
      meter.contextCharacters = exchange
        ? JSON.stringify(exchange.request).length
        : 0;
      meter.usage =
        (exchange?.response as { usage?: Record<string, unknown> })?.usage ??
        null;
    }
    const checks = await verifySelectedParts(build, signal, read);
    let pricesVerified = true;
    for (const check of checks) {
      const part = build.parts.find((p) => p.id === check.id)!;
      if (check.priceCents !== part.priceCents || !check.available) {
        pricesVerified = false;
        build.warnings.push(
          `${part.category}: listing price or stock could not be reconfirmed on its product page. Review before purchase.`,
        );
      }
    }
    // Only explicit structured specs may establish compatibility. Missing facts stay unresolved.
    const partText = (category: string) => {
      const part = build.parts.find((p) => p.category === category)!;
      const check = checks.find((c) => c.id === part.id);
      return `${part.title} ${Object.entries(check?.specs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(" ")}`;
    };
    const socketVerified =
      /AM5/i.test(partText("cpu")) &&
      /AM5/i.test(partText("motherboard")) &&
      /AM5/i.test(partText("cooler"));
    const memoryVerified =
      /DDR5/i.test(partText("motherboard")) &&
      /DDR5/i.test(partText("memory")) &&
      !/SO-?DIMM/i.test(partText("memory"));
    if (!socketVerified)
      build.warnings.push(
        "AM5 socket support is not explicit for the CPU, motherboard, and cooler.",
      );
    if (!memoryVerified)
      build.warnings.push(
        "Desktop DDR5 memory compatibility could not be verified.",
      );
    build.warnings.push(
      "Confirm exact CPU/BIOS support, RAM QVL, GPU and cooler clearance, case fans, and PSU connectors/capacity using the linked specifications. This is a proposed build, not a fully verified compatibility guarantee.",
    );
    return respond({
      ...collection,
      build,
      checks,
      pricesVerified,
      compatibility: { socketVerified, memoryVerified },
      modelCalls: meter.modelCalls,
      contextCharacters: meter.contextCharacters,
    });
  } catch (error) {
    return respond({
      ...collection,
      candidates: collection?.candidates ?? [],
      gaps: collection?.gaps ?? [],
      build: null,
      error: error instanceof Error ? error.message : "PC research failed.",
    });
  } finally {
    session.busy = false;
  }
}
