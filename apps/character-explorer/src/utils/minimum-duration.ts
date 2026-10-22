export const SEARCH_DELAY_MS = 4000;

export function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// Start the request and the timer together. Fast errors also respect the delay.
export async function withMinimumDuration<T>(
  operation: () => Promise<T>,
  milliseconds: number,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  const [result, timer] = await Promise.allSettled([operation(), wait(milliseconds, signal)]);
  signal.throwIfAborted();
  if (timer.status === 'rejected') throw timer.reason;
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}
