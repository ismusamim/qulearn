/**
 * Ids of the old app. Cloud-era data already uses UUIDs, which are kept;
 * older local data used short random strings, which are replaced by a UUID
 * derived from the old id. The derivation is deterministic, so importing the
 * same file twice produces the same ids and «دمج» recognises what it already has.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

/** Deterministic UUID (version-5 layout) from any string; a 128-bit non-cryptographic hash. */
export function stableUuid(source: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  const str = "qulearn:" + source;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const x = [h1, h2, h3, h4].map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  const variant = (8 | (parseInt(x[16], 16) & 3)).toString(16);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-5${x.slice(13, 16)}-${variant}${x.slice(17, 20)}-${x.slice(20, 32)}`;
}

/**
 * Old id → new UUID, per collection ("scope"). The same old id may appear in
 * two collections (a teacher and a student), so lookups always name the scope
 * of the thing being referenced.
 */
export class IdMapper {
  private readonly used = new Set<string>();
  private readonly scopes = new Map<string, Map<string, string>>();

  /** Registers a row and returns its new id. `fallback` identifies rows that have no id at all. */
  assign(scope: string, oldId: unknown, fallback: string): string {
    const old = oldId == null ? "" : String(oldId);
    let map = this.scopes.get(scope);
    if (!map) this.scopes.set(scope, (map = new Map()));
    const known = old ? map.get(old) : undefined;
    if (known) return known;

    let id = isUuid(old) ? old.toLowerCase() : stableUuid(`${scope}:${old || fallback}`);
    // A UUID already taken by a row of another collection cannot be reused as a primary key.
    if (this.used.has(id)) id = stableUuid(`${scope}:${old || fallback}`);
    this.used.add(id);
    if (old) map.set(old, id);
    return id;
  }

  get(scope: string, oldId: unknown): string | null {
    if (oldId == null || oldId === "") return null;
    return this.scopes.get(scope)?.get(String(oldId)) ?? null;
  }

  /** First scope that knows this id — for references that may point at any kind of account. */
  find(scopes: readonly string[], oldId: unknown): string | null {
    for (const scope of scopes) {
      const id = this.get(scope, oldId);
      if (id) return id;
    }
    return null;
  }
}
