import { describe, expect, it } from "vitest";
import { generatePuzzle, getRoleView, validatePath } from "./engine";
import { BASE_TEMPLATES } from "./templates";
import type { Coord, Puzzle, PuzzleEngine, PuzzleSession } from "./types";

const solution: readonly Coord[] = [
  { row: 2, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 0 },
  { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 1 },
];
const session: PuzzleSession = { version: "1", seed: "ABCDEF" };

function puzzle(): Puzzle {
  return { ...structuredClone(BASE_TEMPLATES[0]), ...session };
}

function rejection(path: readonly Coord[], code: string, input = puzzle()) {
  expect(validatePath(input, path)).toMatchObject({ valid: false, code });
}

describe("generatePuzzle", () => {
  it("implements the frozen generation contract with an independent puzzle value", () => {
    const generate: PuzzleEngine["generatePuzzle"] = generatePuzzle;
    const first = generate(session);
    const second = generate(session);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.grid).not.toBe(second.grid);
    expect(first.grid).toHaveLength(5);
    expect(first.grid.every((row) => row.length === 5)).toBe(true);
    expect(first.clues.length).toBeGreaterThanOrEqual(6);
    expect(first.clues.length).toBeLessThanOrEqual(8);
    expect(first.clues.filter((clue) => clue.forbiddenDirection).length).toBeLessThanOrEqual(2);
    expect(Object.keys(first).sort()).toEqual(["clues", "grid", "seed", "start", "version"]);
  });

  it("normalizes lowercase hexadecimal seeds without changing the puzzle", () => {
    expect(generatePuzzle({ version: "1", seed: "abcdef" })).toEqual(generatePuzzle(session));
  });

  it.each(["", "12345", "1234567", "GG0000", " ABCDEF", "ABCDEF\n"])("rejects seed %j", (seed) => {
    expect(() => generatePuzzle({ version: "1", seed })).toThrow();
  });

  it("rejects an unsupported runtime version rather than silently replacing it", () => {
    expect(() => generatePuzzle({ version: "2", seed: "ABCDEF" } as unknown as PuzzleSession)).toThrow();
  });

  it("retains every valid session identity, including zero and maximum seeds", () => {
    for (const seed of ["000000", "FFFFFF", "D00001"]) {
      expect(generatePuzzle({ version: "1", seed })).toMatchObject({ version: "1", seed });
    }
  });
});

describe("role projections", () => {
  it("gives A only map, start, step count and puzzle identity", () => {
    const view = getRoleView(puzzle(), "a");
    expect(Object.keys(view).sort()).toEqual(["grid", "puzzleId", "start", "stepCount"]);
    expect(view).toMatchObject({ puzzleId: "1-ABCDEF", start: solution[0], stepCount: 6 });
    expect(view.grid).toEqual(puzzle().grid);
  });

  it("gives B only ordered clues, step count and the same puzzle identity", () => {
    const view = getRoleView(puzzle(), "b");
    expect(Object.keys(view).sort()).toEqual(["clues", "puzzleId", "stepCount"]);
    expect(view).toEqual({ puzzleId: "1-ABCDEF", clues: puzzle().clues, stepCount: 6 });
  });

  it("does not expose mutable references back into the puzzle", () => {
    const input = puzzle();
    const map = getRoleView(input, "a");
    const clues = getRoleView(input, "b");
    expect(map.grid).not.toBe(input.grid);
    expect(map.start).not.toBe(input.start);
    expect(clues.clues).not.toBe(input.clues);
    expect(clues.clues[0]).not.toBe(input.clues[0]);
  });
});

describe("validatePath", () => {
  it("accepts exactly the full six-step path including its starting square", () => {
    expect(validatePath(puzzle(), solution)).toEqual({ valid: true });
  });

  it.each([[], solution.slice(1), solution.slice(0, -1), [...solution, { row: 3, col: 2 }]].map((path) => ({ path })))(
    "rejects incomplete or oversized paths", ({ path }) => rejection(path, "length"),
  );

  it("does not accept a correct treasure endpoint with a different starting square", () => {
    rejection([{ row: 4, col: 4 }, ...solution.slice(1)], "start");
  });

  it.each([
    { row: -1, col: 0 }, { row: 5, col: 0 }, { row: 0, col: -1 },
    { row: 0, col: 5 }, { row: 1.5, col: 0 }, { row: NaN, col: 0 }, { row: 0, col: Infinity },
  ])("rejects non-grid coordinate %j", (coord) => {
    rejection([solution[0], coord, ...solution.slice(2)], "bounds");
  });

  it.each([null, NaN, {}, "2,0", undefined])("rejects non-array submitted path %j", (path) => {
    rejection(path as unknown as Coord[], "length");
  });

  it("rejects a sparse submitted path", () => {
    rejection(new Array<Coord>(7), "bounds");
  });

  it("rejects malformed path coordinates at the submission boundary", () => {
    rejection([solution[0], null, ...solution.slice(2)] as unknown as Coord[], "bounds");
  });

  it("rejects a blocked square even when the final destination is right", () => {
    rejection([solution[0], { row: 2, col: 1 }, { row: 2, col: 2 }, ...solution.slice(3)], "obstacle");
    const input = puzzle();
    const grid = input.grid.map((row) => row.map((cell) => ({ ...cell })));
    grid[1][0] = { kind: "obstacle" };
    rejection(solution, "obstacle", { ...input, grid });
  });

  it("rejects returning to the start", () => {
    rejection([...solution.slice(0, 2), solution[0], ...solution.slice(3)], "revisit");
  });

  it("rejects diagonal movement and row-edge wrapping", () => {
    rejection([solution[0], { row: 1, col: 1 }, ...solution.slice(2)], "adjacency");
    rejection([solution[0], { row: 1, col: 4 }, ...solution.slice(2)], "adjacency");
  });

  it("checks each ordered symbol", () => {
    const input = puzzle();
    rejection(solution, "symbol", { ...input, clues: [{ symbol: "star" }, ...input.clues.slice(1)] });
  });

  it("rejects a forbidden direction at the exact clue step", () => {
    const input = puzzle();
    const clues = input.clues.map((clue, index) => index === 4 ? { ...clue, forbiddenDirection: "south" as const } : clue);
    rejection(solution, "direction", { ...input, clues });
  });

  it("does not mutate the submitted path or puzzle", () => {
    const input = puzzle();
    const before = JSON.stringify({ input, solution });
    validatePath(input, solution);
    expect(JSON.stringify({ input, solution })).toBe(before);
  });
});
