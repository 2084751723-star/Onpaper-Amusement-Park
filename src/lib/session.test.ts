// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Coord, PuzzleSession, Role } from "../game/types";
import {
  clearProgress, createSession, createRoleLink, createPrintLink,
  loadProgress, normalizeSession, parseSession, saveProgress,
} from "./session";

const session: PuzzleSession = { version: "1", seed: "A1B2C3" };

describe("session creation and routes", () => {
  it("rejects non-string route arguments instead of coercing them", () => {
    for (const input of [null, undefined, {}, [], new URLSearchParams(), 1]) {
      expect(() => parseSession(input as string)).toThrow(Error);
    }
    const base = { toString: () => "https://example.com/play" };
    expect(() => createRoleLink(base as unknown as string, session, "a")).toThrow(Error);
    expect(() => createPrintLink(base as unknown as string, session)).toThrow(Error);
  });

  it("uses exactly three cryptographic bytes, including leading zeroes", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.byteLength).toBe(3);
      bytes.set([0, 10, 255]);
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("not cryptographic"); });
    expect(createSession()).toEqual({ version: "1", seed: "000AFF" });
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
  });

  it("does not fall back to weak randomness if crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createSession()).toThrow(Error);
  });

  it.each(["", "?"])("leaves an empty URL in setup without choosing a puzzle: %s", (search) => {
    vi.stubGlobal("crypto", undefined);
    expect(parseSession(search)).toEqual({ mode: "setup", session: null });
  });

  it("accepts only a session, either role, and print, normalizing seed case", () => {
    expect(parseSession("v=1&seed=a1b2c3")).toEqual({ mode: "setup", session });
    for (const role of ["a", "b"] as const) {
      expect(parseSession(`?role=${role}&seed=a1b2c3&v=1`)).toEqual({ mode: "role", session, role });
    }
    expect(parseSession("?seed=a1b2c3&mode=print&v=1")).toEqual({ mode: "print", session });
    expect(parseSession("?v=%31&seed=%611b2c3&role=%61")).toEqual({ mode: "role", session, role: "a" });
  });

  it.each([
    "v=1", "seed=A1B2C3", "role=a", "mode=print", "v=&seed=A1B2C3", "v=1&seed=",
    "v=2&seed=A1B2C3", "v=01&seed=A1B2C3", "v=1&seed=12345", "v=1&seed=1234567",
    "v=1&seed=GG1234", "v=1&seed=A1B2C3%20", "v=1&seed=A1B2C3%0A", "v=1&seed=A1B2C%ZZ",
    "v=1&seed=A1B2C3&role=", "v=1&seed=A1B2C3&role=A", "v=1&seed=A1B2C3&role=c",
    "v=1&seed=A1B2C3&mode=", "v=1&seed=A1B2C3&mode=setup", "v=1&seed=A1B2C3&mode=PRINT",
    "v=1&seed=A1B2C3&role=a&mode=print", "v=1&seed=A1B2C3&answer=secret",
    "v=1&seed=A1B2C3&Role=a", "v=1&seed=A1B2C3&=x", "foo=bar",
    "v=1&v=1&seed=A1B2C3", "v=1&v=2&seed=A1B2C3", "v=1&seed=A1B2C3&seed=A1B2C3",
    "v=1&seed=A1B2C3&role=a&role=b", "v=1&seed=A1B2C3&role=a&role=a",
    "v=1&seed=A1B2C3&mode=print&mode=print", "v=1&seed=A1B2C3&%76=1",
  ])("rejects invalid route %s", (search) => {
    expect(() => parseSession(search)).toThrow(Error);
  });

  it.each(["https://example.com/play/forest", "http://localhost:5173/nested/index.html"])("cleans and round-trips links on %s", (base) => {
    const input = { ...session, seed: "a1b2c3", answer: "secret" };
    const dirty = `${base}?answer=secret&v=2&seed=FFFFFF&role=b&mode=print#answer`;
    for (const role of ["a", "b"] as const) {
      const link = createRoleLink(dirty, input, role);
      expect(link).toBe(`${base}?v=1&seed=A1B2C3&role=${role}`);
      expect(parseSession(new URL(link).search)).toEqual({ mode: "role", session, role });
    }
    const print = createPrintLink(dirty, input);
    expect(print).toBe(`${base}?v=1&seed=A1B2C3&mode=print`);
    expect(parseSession(new URL(print).search)).toEqual({ mode: "print", session });
  });

  it("retains only origin and pathname, not credentials", () => {
    expect(createPrintLink("https://user:password@example.com:8443/a%20b?q=1#x", session))
      .toBe("https://example.com:8443/a%20b?v=1&seed=A1B2C3&mode=print");
  });

  it.each(["/relative", "not a url", "//example.com", "file:///tmp/game", "javascript:alert(1)", "data:text/plain,hi", "ftp://example.com"])("rejects non-http(s) base %s", (base) => {
    expect(() => createRoleLink(base, session, "a")).toThrow(Error);
    expect(() => createPrintLink(base, session)).toThrow(Error);
  });

  it.each(["", "A", "c", null, undefined])("rejects runtime role %s", (role) => {
    expect(() => createRoleLink("https://example.com", session, role as Role)).toThrow(/role/i);
  });

  it("rejects invalid sessions when creating either link", () => {
    for (const invalid of [{ version: "2", seed: "A1B2C3" }, { version: "1", seed: "invalid" }]) {
      expect(() => createRoleLink("https://example.com", invalid as PuzzleSession, "a")).toThrow(Error);
      expect(() => createPrintLink("https://example.com", invalid as PuzzleSession)).toThrow(Error);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

const path: readonly Coord[] = [{ row: 2, col: 3 }, { row: 2, col: 4 }];

const nineSteps: readonly Coord[] = [
  { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
  { row: 0, col: 3 }, { row: 0, col: 4 }, { row: 1, col: 4 },
  { row: 1, col: 3 }, { row: 1, col: 2 }, { row: 1, col: 1 },
];
const invalidPaths: { name: string; value: unknown }[] = [
  { name: "null", value: null },
  { name: "non-array", value: {} },
  { name: "empty", value: [] },
  { name: "ten steps", value: [...nineSteps, { row: 1, col: 0 }] },
  { name: "sparse array", value: new Array(1) },
  { name: "null coordinate", value: [null] },
  { name: "tuple coordinate", value: [[0, 0]] },
  { name: "missing column", value: [{ row: 0 }] },
  { name: "extra coordinate field", value: [{ row: 0, col: 0, answer: true }] },
  { name: "negative row", value: [{ row: -1, col: 0 }] },
  { name: "row over bounds", value: [{ row: 5, col: 0 }] },
  { name: "negative column", value: [{ row: 0, col: -1 }] },
  { name: "column over bounds", value: [{ row: 0, col: 5 }] },
  { name: "fractional row", value: [{ row: 0.5, col: 0 }] },
  { name: "fractional column", value: [{ row: 0, col: 0.5 }] },
  { name: "numeric string", value: [{ row: "0", col: 0 }] },
  { name: "NaN", value: [{ row: NaN, col: 0 }] },
  { name: "infinity", value: [{ row: 0, col: Infinity }] },
  { name: "diagonal", value: [{ row: 0, col: 0 }, { row: 1, col: 1 }] },
  { name: "jump", value: [{ row: 0, col: 0 }, { row: 0, col: 2 }] },
  { name: "repeat", value: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 0 }] },
];

describe("progress persistence", () => {
  it("uses localStorage only when omitted and never when explicitly null", () => {
    const storage = memoryStorage();
    const getter = vi.fn(() => storage);
    vi.stubGlobal("window", { get localStorage() { return getter(); } });
    expect(saveProgress(session, "a", path)).toBe(true);
    expect(loadProgress(session, "a")).toEqual(path);
    expect(clearProgress(session, "a")).toBe(true);
    expect(getter).toHaveBeenCalledTimes(3);
    getter.mockClear();
    expect(saveProgress(session, "a", path, null)).toBe(false);
    expect(loadProgress(session, "a", null)).toBeNull();
    expect(clearProgress(session, "a", null)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(["missing window", "blocked getter"])("handles unavailable browser storage: %s", (failure) => {
    const getter = vi.fn(() => { throw new Error("SecurityError"); });
    vi.stubGlobal("window", failure === "missing window" ? undefined : {
      get localStorage() { return getter(); },
    });
    expect(saveProgress(session, "a", path)).toBe(false);
    expect(loadProgress(session, "a")).toBeNull();
    expect(clearProgress(session, "a")).toBe(false);
    const storage = memoryStorage();
    expect(saveProgress(session, "a", path, storage)).toBe(true);
    expect(loadProgress(session, "a", storage)).toEqual(path);
    expect(clearProgress(session, "a", storage)).toBe(true);
    expect(getter).toHaveBeenCalledTimes(failure === "missing window" ? 0 : 3);
  });

  it.each(["method", "getter"])("contains runtime storage %s failures", (failure) => {
    const storage = memoryStorage();
    for (const method of ["setItem", "getItem", "removeItem"] as const) {
      const fail = () => { throw new Error("QuotaExceededError or SecurityError"); };
      if (failure === "getter") Object.defineProperty(storage, method, { get: fail });
      else vi.spyOn(storage, method).mockImplementation(fail);
    }
    expect(saveProgress(session, "a", path, storage)).toBe(false);
    expect(loadProgress(session, "a", storage)).toBeNull();
    expect(clearProgress(session, "a", storage)).toBe(false);
  });

  it("throws for invalid session or role before accessing unavailable storage", () => {
    const getter = vi.fn(() => { throw new Error("must not access storage"); });
    vi.stubGlobal("window", { get localStorage() { return getter(); } });
    const invalidSessions = [null, {}, { version: "2", seed: "A1B2C3" }, { version: "1", seed: "bad" }];
    for (const input of invalidSessions) {
      expect(() => saveProgress(input as PuzzleSession, "a", path)).toThrow(Error);
      expect(() => loadProgress(input as PuzzleSession, "a")).toThrow(Error);
      expect(() => clearProgress(input as PuzzleSession, "a")).toThrow(Error);
    }
    for (const role of [undefined, null, "", "A", "c"]) {
      expect(() => saveProgress(session, role as Role, path)).toThrow(/role/i);
      expect(() => loadProgress(session, role as Role)).toThrow(/role/i);
      expect(() => clearProgress(session, role as Role)).toThrow(/role/i);
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(invalidPaths)("ignores stored invalid path without deleting data: $name", ({ value }) => {
    const storage = memoryStorage();
    saveProgress(session, "a", path, storage);
    const key = storage.key(0)!;
    const raw = JSON.stringify({ ...session, role: "a", path: value });
    storage.setItem(key, raw);
    expect(loadProgress(session, "a", storage)).toBeNull();
    expect(storage.getItem(key)).toBe(raw);
  });

  it("rejects mismatched, incomplete, extra-field and malformed envelopes", () => {
    const storage = memoryStorage();
    saveProgress(session, "a", path, storage);
    const key = storage.key(0)!;
    const envelope = { ...session, role: "a", path };
    const invalid = [
      { ...envelope, version: "2" }, { ...envelope, version: 1 },
      { ...envelope, seed: "FFFFFF" }, { ...envelope, seed: "a1b2c3" },
      { ...envelope, role: "b" }, { ...envelope, role: "c" },
      { seed: session.seed, role: "a", path }, { version: "1", role: "a", path },
      { ...session, path }, { ...session, role: "a" },
      { ...envelope, success: true }, { ...envelope, answer: path },
      { ...envelope, session }, null, [], path, true, "text", 123,
    ];
    for (const value of invalid) {
      const raw = JSON.stringify(value);
      storage.setItem(key, raw);
      expect(loadProgress(session, "a", storage)).toBeNull();
      expect(storage.getItem(key)).toBe(raw);
    }
    for (const raw of ["", "{", "undefined", '{"__proto__":{},"version":"1","seed":"A1B2C3","role":"a","path":[]}']) {
      storage.setItem(key, raw);
      expect(loadProgress(session, "a", storage)).toBeNull();
    }
  });

  it("caps raw storage at 4096 characters before parsing", () => {
    const storage = memoryStorage();
    saveProgress(session, "a", path, storage);
    const key = storage.key(0)!;
    const raw = storage.getItem(key)!;
    expect(raw.length).toBeLessThan(4096);
    storage.setItem(key, raw.padEnd(4096, " "));
    expect(loadProgress(session, "a", storage)).toEqual(path);
    storage.setItem(key, raw.padEnd(4097, " "));
    const parse = vi.spyOn(JSON, "parse");
    expect(loadProgress(session, "a", storage)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
  });

  it.each(invalidPaths)("rejects invalid caller path before storage access: $name", ({ value }) => {
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    expect(() => saveProgress(session, "a", value as readonly Coord[], storage)).toThrow(Error);
    expect(() => saveProgress(session, "a", value as readonly Coord[], null)).toThrow(Error);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("accepts one through nine steps and does not infer puzzle validity", () => {
    const storage = memoryStorage();
    for (let length = 1; length <= 9; length++) {
      const steps = nineSteps.slice(0, length);
      expect(saveProgress(session, "a", steps, storage)).toBe(true);
      expect(loadProgress(session, "a", storage)).toEqual(steps);
    }
    expect(saveProgress(session, "a", [{ row: 4, col: 4 }], storage)).toBe(true);
    expect(loadProgress(session, "a", storage)).toEqual([{ row: 4, col: 4 }]);
  });

  it("isolates seeds and roles and clears only the specified key", () => {
    const storage = memoryStorage();
    const other = { ...session, seed: "FFFFFF" };
    storage.setItem("unrelated", "keep");
    expect(loadProgress(session, "a", storage)).toBeNull();
    saveProgress(session, "a", path, storage);
    expect(loadProgress(session, "b", storage)).toBeNull();
    expect(loadProgress(other, "a", storage)).toBeNull();
    saveProgress(session, "b", [path[0]], storage);
    saveProgress(other, "a", [path[1]], storage);
    expect(storage.key(1)).toContain(":1:A1B2C3:a");
    expect(clearProgress({ ...session, seed: "a1b2c3" }, "a", storage)).toBe(true);
    expect(loadProgress(session, "a", storage)).toBeNull();
    expect(loadProgress(session, "b", storage)).toEqual([path[0]]);
    expect(loadProgress(other, "a", storage)).toEqual([path[1]]);
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(clearProgress(session, "a", storage)).toBe(true);
    expect(storage.length).toBe(3);
  });

  it("round-trips a path in a normalized session envelope without mutating input", () => {
    const storage = memoryStorage();
    const input = { ...session, seed: "a1b2c3" };
    expect(saveProgress(input, "a", path, storage)).toBe(true);
    expect(loadProgress(session, "a", storage)).toEqual(path);
    expect(loadProgress(session, "a", storage)).not.toBe(path);
    expect(input.seed).toBe("a1b2c3");
    expect(storage.length).toBe(1);
    expect(JSON.parse(storage.getItem(storage.key(0)!)!)).toEqual({
      version: "1", seed: "A1B2C3", role: "a", path,
    });
  });
});

describe("normalizeSession", () => {
  it("normalizes seed case without changing the caller's session", () => {
    const input = { version: "1", seed: "a1b2c3" };
    expect(normalizeSession(input)).toEqual(session);
    expect(input.seed).toBe("a1b2c3");
  });

  it.each(["", "0", "2", "01", " 1", 1, null])("rejects unsupported version %s", (version) => {
    expect(() => normalizeSession({ version, seed: "A1B2C3" } as { version: string; seed: string })).toThrow(/version/i);
  });

  it.each(["", "12345", "1234567", "GG1234", " A1B2C3", "A1B2C3\n", "Ａ1B2C3", 123456, null])("rejects invalid seed %s", (seed) => {
    expect(() => normalizeSession({ version: "1", seed } as { version: string; seed: string })).toThrow(/seed/i);
  });

  it.each([null, undefined, {}, []])("rejects malformed session %s", (input) => {
    expect(() => normalizeSession(input as PuzzleSession)).toThrow(Error);
  });
});
