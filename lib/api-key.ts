const STORAGE_KEY = "typesafe-api-key-override";
export const API_KEY_EVENT = "typesafe-api-key-change";
export function readApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
export function saveApiKey(value: string) {
  const key = value.trim();
  if (key && (!/^[\x21-\x7e]+$/.test(key) || key.length > 1024))
    throw Error("Use an API key without spaces, up to 1,024 characters.");
  if (key) localStorage.setItem(STORAGE_KEY, key);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(API_KEY_EVENT));
}
export function jevHeaders(): Record<string, string> {
  const key = readApiKey();
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-TypeSafe-API-Key": key } : {}),
  };
}
