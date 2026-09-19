export type BoundedStudyResult<T, R> = { item: T; value: R | null; success: boolean; attempts: number; latencyMs: number; errorCode: string | null };
export type BoundedStudyOptions = { concurrency?: number; timeoutMs?: number; maxAttempts?: number; pacingMs?: number; signal?: AbortSignal };

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function safeError(error: unknown): string { if (error instanceof Error && error.name === "AbortError") return "TIMEOUT"; if (error instanceof Error && error.message === "STUDY_ABORTED") return "CANCELLED"; return "STUDY_ERROR"; }

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (parent?.aborted) throw new Error("STUDY_ABORTED");
    return await Promise.race([work(controller.signal), new Promise<T>((_, reject) => controller.signal.addEventListener("abort", () => reject(Object.assign(new Error("Study request timed out."), { name: "AbortError" })), { once: true }))]);
  } finally { clearTimeout(timer); parent?.removeEventListener("abort", abort); }
}

/** Runs a provider study with bounded concurrency, timeout, retry and cancellation. */
export async function runBoundedStudy<T, R>(items: readonly T[], worker: (item: T, signal: AbortSignal) => Promise<R>, options: BoundedStudyOptions = {}): Promise<{ results: readonly BoundedStudyResult<T, R>[]; values: readonly R[] }> {
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 1));
  const timeoutMs = Math.max(100, options.timeoutMs ?? 15_000);
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 1));
  const pacingMs = Math.max(0, options.pacingMs ?? 0);
  const results: BoundedStudyResult<T, R>[] = [];
  let cursor = 0;
  async function runOne(item: T): Promise<void> {
    const started = Date.now(); let attempts = 0; let errorCode: string | null = null;
    while (attempts < maxAttempts) {
      attempts += 1;
      try { const value = await withTimeout((signal) => worker(item, signal), timeoutMs, options.signal); results.push({ item, value, success: true, attempts, latencyMs: Date.now() - started, errorCode: null }); return; }
      catch (error) { errorCode = safeError(error); if (options.signal?.aborted) { errorCode = "CANCELLED"; break; } if (attempts < maxAttempts && pacingMs > 0) await sleep(pacingMs); }
    }
    results.push({ item, value: null, success: false, attempts, latencyMs: Date.now() - started, errorCode });
  }
  async function runner(): Promise<void> { while (cursor < items.length && !options.signal?.aborted) { const item = items[cursor++]; if (item !== undefined) await runOne(item); if (pacingMs > 0) await sleep(pacingMs); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => runner()));
  results.sort((left, right) => items.indexOf(left.item) - items.indexOf(right.item));
  return { results, values: results.flatMap((result) => result.value === null ? [] : [result.value]) };
}
