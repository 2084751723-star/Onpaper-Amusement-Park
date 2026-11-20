import type { Coord, PuzzleSession, Role } from "../game/types";

export type SessionRoute =
  | { mode: "setup"; session: PuzzleSession | null }
  | { mode: "role"; session: PuzzleSession; role: Role }
  | { mode: "print"; session: PuzzleSession };

function assertRole(role: unknown): asserts role is Role {
  if (role !== "a" && role !== "b") {
    throw new Error("Invalid role: expected 'a' or 'b'.");
  }
}

export function createSession(): PuzzleSession {
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  const seed = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { version: "1", seed };
}

export function parseSession(search: string): SessionRoute {
  if (typeof search !== "string") throw new Error("Invalid search: expected a string.");
  const params = new URLSearchParams(search);
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!["v", "seed", "role", "mode"].includes(key)) {
      throw new Error(`Unknown session parameter: ${key}.`);
    }
    if (seen.has(key)) throw new Error(`Duplicate session parameter: ${key}.`);
    seen.add(key);
  }
  if (seen.size === 0) return { mode: "setup", session: null };
  const version = params.get("v");
  const seed = params.get("seed");
  if (version === null || seed === null) throw new Error("Session requires both v and seed.");
  const session = normalizeSession({ version, seed });
  if (params.has("role") && params.has("mode")) throw new Error("Session role and mode cannot coexist.");
  if (params.has("role")) {
    const role = params.get("role");
    assertRole(role);
    return { mode: "role", session, role };
  }
  if (params.has("mode")) {
    if (params.get("mode") !== "print") throw new Error("Invalid mode: expected 'print'.");
    return { mode: "print", session };
  }
  return { mode: "setup", session };
}

function sessionUrl(baseUrl: string, session: PuzzleSession): URL {
  if (typeof baseUrl !== "string") throw new Error("Invalid base URL: expected a string.");
  const normalized = normalizeSession(session);
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("Invalid base URL: expected http or https.");
  }
  const url = new URL(base.origin + base.pathname);
  url.searchParams.set("v", normalized.version);
  url.searchParams.set("seed", normalized.seed);
  return url;
}

export function createRoleLink(baseUrl: string, session: PuzzleSession, role: Role): string {
  assertRole(role);
  const url = sessionUrl(baseUrl, session);
  url.searchParams.set("role", role);
  return url.href;
}

export function createPrintLink(baseUrl: string, session: PuzzleSession): string {
  const url = sessionUrl(baseUrl, session);
  url.searchParams.set("mode", "print");
  return url.href;
}

function hasExactFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function validatedPath(value: unknown): readonly Coord[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 9) {
    throw new Error("Invalid path: expected 1 through 9 coordinates.");
  }
  const path: Coord[] = [];
  const seen = new Set<string>();
  for (const coord of value) {
    if (!hasExactFields(coord, ["row", "col"])) throw new Error("Invalid path coordinate fields.");
    const { row, col } = coord;
    if (typeof row !== "number" || typeof col !== "number" ||
        !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 4 || col < 0 || col > 4) {
      throw new Error("Invalid path coordinate: expected integers from 0 through 4.");
    }
    const key = `${row},${col}`;
    if (seen.has(key)) throw new Error("Invalid path: repeated coordinate.");
    const previous = path[path.length - 1];
    if (previous && Math.abs(previous.row - row) + Math.abs(previous.col - col) !== 1) {
      throw new Error("Invalid path: coordinates must be orthogonally adjacent.");
    }
    seen.add(key);
    path.push({ row, col });
  }
  // Why: session data lacks the Puzzle; callers must revalidate its start, obstacles and clues.
  return path;
}

function progressKey(session: PuzzleSession, role: Role): string {
  return `onpaper:progress:${session.version}:${session.seed}:${role}`;
}

export function saveProgress(
  session: PuzzleSession, role: Role, path: readonly Coord[], storage?: Storage | null,
): boolean {
  const normalized = normalizeSession(session);
  assertRole(role);
  const validated = validatedPath(path);
  try {
    const target = storage === undefined ? window.localStorage : storage;
    if (!target) return false;
    target.setItem(progressKey(normalized, role), JSON.stringify({ ...normalized, role, path: validated }));
    return true;
  } catch {
    return false;
  }
}

export function loadProgress(
  session: PuzzleSession, role: Role, storage?: Storage | null,
): readonly Coord[] | null {
  const normalized = normalizeSession(session);
  assertRole(role);
  try {
    const target = storage === undefined ? window.localStorage : storage;
    const raw = target?.getItem(progressKey(normalized, role));
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 4096) return null;
    const envelope: unknown = JSON.parse(raw);
    if (!hasExactFields(envelope, ["version", "seed", "role", "path"]) ||
        envelope.version !== normalized.version || envelope.seed !== normalized.seed || envelope.role !== role) {
      return null;
    }
    return validatedPath(envelope.path);
  } catch {
    return null;
  }
}

export function clearProgress(
  session: PuzzleSession, role: Role, storage?: Storage | null,
): boolean {
  const normalized = normalizeSession(session);
  assertRole(role);
  try {
    const target = storage === undefined ? window.localStorage : storage;
    if (!target) return false;
    target.removeItem(progressKey(normalized, role));
    return true;
  } catch {
    return false;
  }
}

export function normalizeSession(session: { version: string; seed: string }): PuzzleSession {
  if (!session || session.version !== "1") {
    throw new Error("Unsupported puzzle version: expected version '1'.");
  }
  if (typeof session.seed !== "string" || !/^[0-9a-fA-F]{6}$/.test(session.seed)) {
    throw new Error("Invalid puzzle seed: expected exactly 6 hexadecimal characters.");
  }
  return { version: "1", seed: session.seed.toUpperCase() };
}
