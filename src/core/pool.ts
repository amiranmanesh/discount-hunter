/** Runs `items` through `worker` with a bounded number of concurrent calls. */
export async function pooled<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<(R | { error: string })[]> {
  const results = new Array<R | { error: string }>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export function isPoolError<R>(value: R | { error: string }): value is { error: string } {
  return Boolean(value) && typeof value === 'object' && 'error' in (value as object);
}
