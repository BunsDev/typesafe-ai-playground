import { readBoundedBody, validatePayload } from "./api";
export class JevProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Server/CLI transport. Keys stay out of model payloads and responses. */
export async function serverJevTransport(
  value: unknown,
  signal?: AbortSignal,
  override?: string | null,
) {
  const payload = validatePayload(value);
  const key = override?.trim() || process.env.TYPESAFE_API_KEY?.trim();
  if (
    override !== undefined &&
    override !== null &&
    (!override.trim() ||
      !/^[\x21-\x7e]+$/.test(override.trim()) ||
      override.length > 1024)
  )
    throw new JevProviderError("Invalid API key override.", 400);
  if (!key)
    throw new JevProviderError(
      "Set TYPESAFE_API_KEY on the server to run Jev.",
      503,
    );
  try {
    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(45000),
      ]),
      cache: "no-store",
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      throw new JevProviderError(
        `TypeSafe returned HTTP ${upstream.status}. Check your API configuration or try again.`,
        upstream.status === 429 ? 429 : 502,
      );
    }
    const data = JSON.parse(
      await readBoundedBody(upstream.body, 2 * 1024 * 1024),
    );
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !data.answers ||
      typeof data.answers !== "object" ||
      Array.isArray(data.answers)
    )
      throw Error("Invalid upstream response.");
    return data;
  } catch (e) {
    if (e instanceof JevProviderError) throw e;
    throw new JevProviderError(
      "TypeSafe could not complete this request. Please try again.",
      502,
    );
  }
}
