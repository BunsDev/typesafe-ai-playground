import {
  captionScore,
  splitCaptions,
  type CaptionLine,
  type MemeCaptions,
} from "./meme-captions";

/** English OCR in a lazy-loaded browser worker. Only reviewed text goes to Jev. */
export async function readMemeText(
  blob: Blob,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<MemeCaptions> {
  const { createWorker, PSM } = await import("tesseract.js");
  signal.throwIfAborted();
  let rejectAbort: (error: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const abort = () =>
    rejectAbort(signal.reason || new DOMException("Stopped", "AbortError"));
  signal.addEventListener("abort", abort, { once: true });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const initializing = createWorker("eng", 1, {
    logger: (message) => {
      if (!signal.aborted)
        onProgress(
          `${message.status} · ${Math.round(message.progress * 100)}%`,
        );
    },
  });
  // An aborted initialization may finish later; do not leave its worker alive.
  void initializing.then(
    (w) => {
      if (signal.aborted) void w.terminate();
    },
    () => {},
  );
  try {
    worker = await Promise.race([initializing, aborted]);
    await Promise.race([
      worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }),
      aborted,
    ]);
    // Upscale small captions, with a bounded canvas (at most four megapixels).
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, 2000 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw Error("Image processing is unavailable.");
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let best: CaptionLine[] = [];
    for (let pass = 0; pass < 2; pass++) {
      signal.throwIfAborted();
      onProgress(pass ? "Reading outlined captions…" : "Reading captions…");
      if (pass) {
        // White lettering with a dark outline becomes black text on white.
        // A second pass preserves ordinary dark-on-light captions in the first.
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const luminance =
            0.299 * pixels.data[i] +
            0.587 * pixels.data[i + 1] +
            0.114 * pixels.data[i + 2];
          const value = luminance >= 235 ? 0 : 255;
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
          pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
      }
      const result = await Promise.race([
        worker.recognize(canvas, {}, { text: true, blocks: true }),
        aborted,
      ]);
      signal.throwIfAborted();
      if (result.data.text.length > 8000)
        throw Error(
          "This image contains too much text. Crop to the meme and try again.",
        );
      const lines = (result.data.blocks || []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines),
      );
      if (captionScore(lines) > captionScore(best)) best = lines;
    }
    return splitCaptions(best, canvas.height);
  } finally {
    signal.removeEventListener("abort", abort);
    if (worker) await worker.terminate();
  }
}
