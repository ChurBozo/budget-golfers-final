// Session cache of the last response for each request key (A2 section 5.7):
// returning to a view shows the previous data at once while a fresh copy loads.
// Deleting or editing a round clears the affected entries.
const cache = new Map();

export function getCached(key) {
  return cache.get(key);
}

export function setCached(key, value) {
  cache.set(key, value);
}

/** Removes every entry whose key starts with one of the prefixes. */
export function invalidate(...prefixes) {
  for (const key of [...cache.keys()]) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
}
