// Requests to Supabase, shared by sync (remote.ts) and Storage (fileStorage.ts).

/**
 * Whether an error's message means the request didn't get through, as browsers
 * ("Failed to fetch", Safari's "Load failed") and React Native ("Network request
 * failed") word a failed fetch.
 */
export function didNotGetThrough(message: string): boolean {
  return /fetch|network|load failed/i.test(message);
}

/**
 * Waits for a supabase-js request, returning a thrown error (a failed fetch) the way
 * supabase-js returns its own, so callers handle both in one place.
 */
export function settled<T>(request: PromiseLike<T>): Promise<T | { data: null; error: unknown }> {
  return Promise.resolve(request).then(
    (answer) => answer,
    (thrown: unknown) => ({ data: null, error: thrown }),
  );
}
