import { jevHeaders } from "./api-key";
export async function runJev(payload: unknown, signal?: AbortSignal) {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: jevHeaders(),
    body: JSON.stringify(payload),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || `Request failed (${response.status}).`);
  return data;
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const percent = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "—";
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Try again.";
