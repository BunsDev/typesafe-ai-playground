import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import sharp from "sharp";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export function validateImageUrl(value: string): URL {
  if (value.length > 2048)
    throw Error("Use an image URL shorter than 2,048 characters.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Paste a complete HTTPS image URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw Error(
      "Use a public HTTPS image URL without credentials or a custom port.",
    );
  return url;
}
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function fetchMemeImage(
  value: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  let url = validateImageUrl(value);
  const deadline = AbortSignal.any([
    AbortSignal.timeout(15000),
    ...(signal ? [signal] : []),
  ]);
  for (let hop = 0; hop < 4; hop++) {
    deadline.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    deadline.throwIfAborted();
    if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
      throw Error("Image URLs must resolve to public internet addresses.");
    const pinned = addresses[0];
    const response = await new Promise<import("node:http").IncomingMessage>(
      (resolve, reject) => {
        const req = request(
          url,
          {
            signal: deadline,
            method: "GET",
            family: pinned.family,
              lookup: (_hostname, _options, callback) =>
              callback(null, pinned.address, pinned.family),
            headers: {
              Accept: "image/png,image/jpeg,image/webp,image/gif",
              "User-Agent": "TypeSafe-MemeLab/1.0",
            },
          },
          resolve,
        );
        req.on("error", reject);
        req.end();
      },
    );
    if (
      response.statusCode &&
      [301, 302, 303, 307, 308].includes(response.statusCode)
    ) {
      const location = response.headers.location;
      response.destroy();
      if (!location || hop === 3)
        throw Error(
          "The image URL redirects too many times. Use a direct image link.",
        );
      url = validateImageUrl(new URL(location, url).href);
      continue;
    }
    if (response.statusCode !== 200) {
      response.destroy();
      throw Error(
        "The image host could not serve this image. Use a public direct image link.",
      );
    }
    if (
      !/^image\/(png|jpeg|webp|gif)(?:;|$)/i.test(
        response.headers["content-type"] || "",
      )
    ) {
      response.destroy();
      throw Error(
        "Use a direct PNG, JPEG, WebP, or GIF image URL, not a webpage.",
      );
    }
    if (Number(response.headers["content-length"]) > MAX_IMAGE_BYTES) {
      response.destroy();
      throw Error("Choose an image smaller than 4 MB.");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        response.destroy();
        throw Error("Choose an image smaller than 4 MB.");
      }
      chunks.push(Buffer.from(chunk));
    }
    // Decode and normalize server-side to bound pixels and remove active metadata.
    const image = sharp(Buffer.concat(chunks), {
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const meta = await image.metadata();
    if (!["png", "jpeg", "webp", "gif"].includes(meta.format || ""))
      throw Error("Unsupported image format.");
    const output = await image
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#fff" })
      .jpeg({ quality: 90 })
      .toBuffer();
    if (output.length > MAX_IMAGE_BYTES)
      throw Error("The processed image is too large.");
    return output;
  }
  throw Error("Could not load image.");
}
