// Split a long string into overlapping chunks (~`size` chars, `overlap` shared
// with the previous chunk) for embedding. Breaks at a nearby whitespace when
// possible so chunks don't split mid-word.
export function chunkText(text: string, size = 1500, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const step = Math.max(1, size - overlap);
  const out: string[] = [];
  for (let start = 0; start < clean.length; start += step) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const sp = clean.lastIndexOf(" ", end);
      if (sp > start + size / 2) end = sp;
    }
    out.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
  }
  return out;
}

// Split an array into chunks of at most `size`.
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be > 0");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Map over items with a bounded number of concurrent workers, preserving order.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
