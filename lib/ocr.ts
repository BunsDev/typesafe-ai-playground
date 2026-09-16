/** English OCR in a lazy-loaded browser worker. Only reviewed text goes to Jev. */
export async function readMemeText(
  blob: Blob,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<string> {
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
    const result = await Promise.race([worker.recognize(blob), aborted]);
    signal.throwIfAborted();
    if (result.data.text.length > 8000)
      throw Error(
        "This image contains too much text. Crop to the meme and try again.",
      );
    return result.data.text.trim();
  } finally {
    signal.removeEventListener("abort", abort);
    if (worker) await worker.terminate();
  }
}
