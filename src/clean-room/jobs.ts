import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { demos, demoAdapters, startDemoTarget } from "./demos";
import { liveAdapters } from "./models";
import { runPipeline } from "./run";
import type { DemoId } from "./examples";
export type DemoJob = {
  id: string;
  demo: DemoId;
  mode: "mock" | "live";
  stage: string;
  status: "running" | "passed" | "review-required" | "failed" | "closed";
  output: string;
  url?: string;
  targetUrl?: string;
  error?: string;
  report?: Awaited<ReturnType<typeof runPipeline>>["report"];
  cost?: Awaited<ReturnType<typeof runPipeline>>["cost"];
  close?: () => void;
};
const globalStore = globalThis as typeof globalThis & {
  cleanRoomJobs?: Map<string, DemoJob>;
};
const jobs = (globalStore.cleanRoomJobs ??= new Map<string, DemoJob>());
export async function startDemoJob(
  demo: DemoId,
  mode: "mock" | "live",
  viewport?: { width: number; height: number },
) {
  if ([...jobs.values()].filter((j) => j.status === "running").length >= 2)
    throw Error("Two rebuilds are already running. Wait for one to finish.");
  for (const [id, job] of jobs)
    if (jobs.size >= 6 && job.status !== "running") {
      job.close?.();
      jobs.delete(id);
    }
  const job: DemoJob = {
    id: randomUUID(),
    demo,
    mode,
    stage: "starting",
    status: "running",
    output: await mkdtemp(path.join(os.tmpdir(), "clean-room-")),
  };
  jobs.set(job.id, job);
  void (async () => {
    let target: Awaited<ReturnType<typeof startDemoTarget>> | undefined;
    try {
      target = await startDemoTarget();
      job.targetUrl = target.url + "/" + demo;
      const result = await runPipeline(
        {
          ...(demos[demo].config as object),
          target: target.url,
          ...(viewport ? { viewport } : {}),
        },
        {
          output: job.output,
          adapters: mode === "mock" ? demoAdapters() : liveAdapters(),
          keepAlive: true,
          onStage: (s) => {
            job.stage = s;
          },
        },
      );
      job.url = result.url + "/" + demo;
      job.report = result.report;
      job.cost = result.cost;
      job.status = result.report.status as DemoJob["status"];
      job.stage = "complete";
      job.close = () => {
        result.close();
        void target?.close();
        job.status = "closed";
        job.url = undefined;
        job.targetUrl = undefined;
      };
      const expiry = setTimeout(() => job.close?.(), 20 * 60 * 1000);
      expiry.unref();
    } catch (e) {
      await target?.close();
      job.status = "failed";
      job.error = e instanceof Error ? e.message : "Rebuild failed";
    }
  })();
  return publicJob(job);
}
export function getDemoJob(id: string) {
  const job = jobs.get(id);
  if (!job) throw Error("Run not found. Start a new demo.");
  return job;
}
export function publicJob(job: DemoJob) {
  const { close: _, ...data } = job;
  return data;
}
export async function artifact(id: string, name: string) {
  const job = getDemoJob(id);
  const allowed = [
    "config.json",
    "endpoints.json",
    "layouts.json",
    "decisions.json",
    "generation.json",
    "verification.json",
    "cost.json",
    "observations.json",
  ];
  if (name === "bundle") {
    if (job.status === "running")
      throw Error("Wait for the run before exporting.");
    const dest = path.join(os.tmpdir(), `clean-room-${job.id}.tar.gz`);
    await promisify(execFile)("tar", ["-czf", dest, "-C", job.output, "."]);
    return {
      body: await readFile(dest),
      type: "application/gzip",
      name: `clean-room-${job.demo}.tar.gz`,
    };
  }
  if (!allowed.includes(name)) throw Error("Unknown artifact.");
  return {
    body: await readFile(path.join(job.output, name)),
    type: "application/json",
    name,
  };
}
