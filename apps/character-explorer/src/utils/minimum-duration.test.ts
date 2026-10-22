import { describe, expect, it, vi } from 'vitest';
import { SEARCH_DELAY_MS, wait, withMinimumDuration } from './minimum-duration';

describe('four-second search contract', () => {
  it('does not reveal a fast response at 3999ms and reveals it at 4000ms', async () => {
    vi.useFakeTimers();
    const resolve = vi.fn();
    const promise = withMinimumDuration(
      async () => 'Rick',
      SEARCH_DELAY_MS,
      new AbortController().signal,
    ).then(resolve);
    await vi.advanceTimersByTimeAsync(3999);
    expect(resolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolve).toHaveBeenCalledWith('Rick');
  });

  it('waits for a slow request instead of pretending it completed at four seconds', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const resolve = vi.fn();
    const promise = withMinimumDuration(
      async () => {
        await wait(6000, controller.signal);
        return 'Morty';
      },
      SEARCH_DELAY_MS,
      controller.signal,
    ).then(resolve);
    await vi.advanceTimersByTimeAsync(4000);
    expect(resolve).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    await promise;
    expect(resolve).toHaveBeenCalledWith('Morty');
  });

  it('also delays fast failures and cleans up cancellation timers', async () => {
    vi.useFakeTimers();
    const reject = vi.fn();
    const controller = new AbortController();
    const promise = withMinimumDuration(
      async () => {
        throw new Error('Offline');
      },
      SEARCH_DELAY_MS,
      controller.signal,
    ).catch(reject);
    await vi.advanceTimersByTimeAsync(3999);
    expect(reject).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: 'Offline' }));
    const cancelled = withMinimumDuration(async () => 'Rick', SEARCH_DELAY_MS, controller.signal);
    const assertion = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
