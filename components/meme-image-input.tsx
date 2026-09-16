"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import type { MemeCaptions } from "../lib/meme-captions";
import { readMemeText } from "../lib/ocr";
import { errorMessage } from "../lib/client";
import { ErrorNote } from "./ui";
export function MemeImageInput({
  disabled,
  onReady,
  onBusy,
}: {
  disabled: boolean;
  onReady: (url: string, captions: MemeCaptions, preview: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load() {
    const source = url.trim();
    if (!source) return;
    setError("");
    setBusy(true);
    onBusy(true);
    setStatus("Loading image…");
    controller.current = new AbortController();
    const signal = AbortSignal.any([
      controller.current.signal,
      AbortSignal.timeout(90000),
    ]);
    let preview = "";
    try {
      const response = await fetch("/api/meme-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: source }),
        signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw Error(data.error || "Could not load image.");
      }
      const blob = await response.blob();
      preview = URL.createObjectURL(blob);
      let captions: MemeCaptions = { text: "", setup: "", punchline: "" };
      try {
        captions = await readMemeText(blob, signal, setStatus);
      } catch (e) {
        if (signal.aborted) throw e;
        setError(
          "The image loaded, but OCR could not read it. Type its caption below before testing.",
        );
      }
      signal.throwIfAborted();
      onReady(source, captions, preview);
      preview = "";
      setStatus(
        captions.text
          ? captions.punchline
            ? "Setup and punchline detected by position. Review both before testing."
            : "Caption detected. Review the setup and add a punchline if needed."
          : "No caption detected. Add the caption or describe the scene.",
      );
    } catch (e) {
      setError(
        signal.aborted
          ? "Image reading stopped. Try again or enter the caption manually."
          : errorMessage(e),
      );
      setStatus("");
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="image-import">
      <label htmlFor="meme-image-url">Image address URL</label>
      <div className="image-url-row">
        <input
          id="meme-image-url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/meme.jpg"
          value={url}
          disabled={disabled || busy}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!disabled && !busy) void load();
            }
          }}
        />
        <button
          type="button"
          className="button"
          disabled={disabled || busy || !url.trim()}
          onClick={load}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <ImagePlus size={15} />
          )}
          Read image
        </button>
        {busy && (
          <button
            type="button"
            className="button quiet"
            onClick={() => controller.current?.abort()}
          >
            Cancel image
          </button>
        )}
      </div>
      <p className="muted">
        Public PNG, JPG, WebP, or GIF · up to 4 MB. English OCR; GIFs use the
        first frame.
      </p>
      <p className="ocr-status" role="status">
        {status}
      </p>
      <ErrorNote message={error} />
    </div>
  );
}
