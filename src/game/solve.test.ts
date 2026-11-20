import { describe, expect, it } from "vitest";
import type { Cell, Clue, Coord, Direction, Puzzle, SymbolId } from "./types";
import { solvePuzzle } from "./solve";

function fixture(
  start: Coord,
  symbols: readonly (readonly [number, number, SymbolId])[],
  clues: readonly Clue[],
): Puzzle {
  const grid: Cell[][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, (): Cell => ({ kind: "obstacle" })),
  );
  for (const [row, col, symbol] of symbols) {
    grid[row][col] = { kind: "symbol", symbol };
  }
  return { version: "1", seed: "hand-built", grid, start, clues };
}

function corridor(): Puzzle {
  return fixture(
    { row: 0, col: 0 },
    [
      [0, 0, "moon"],
      [0, 1, "leaf"],
      [0, 2, "leaf"],
      [1, 2, "leaf"],
      [2, 2, "leaf"],
      [2, 3, "leaf"],
      [2, 4, "leaf"],
      [3, 4, "leaf"], // A seventh move exists but must not be included.
    ],
    Array.from({ length: 6 }, () => ({ symbol: "leaf" })),
  );
}

const corridorPath: readonly Coord[] = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 0, col: 2 },
  { row: 1, col: 2 },
  { row: 2, col: 2 },
  { row: 2, col: 3 },
  { row: 2, col: 4 },
];

function crossroads(forbiddenDirection?: Direction): Puzzle {
  return fixture(
    { row: 2, col: 2 },
    [
      [2, 2, "moon"],
      [1, 2, "leaf"],
      [2, 3, "leaf"],
      [3, 2, "leaf"],
      [2, 1, "leaf"],
    ],
    [{ symbol: "leaf", forbiddenDirection }],
  );
}

const crossroadsPaths: readonly (readonly Coord[])[] = [
  [{ row: 2, col: 2 }, { row: 1, col: 2 }],
  [{ row: 2, col: 2 }, { row: 2, col: 3 }],
  [{ row: 2, col: 2 }, { row: 3, col: 2 }],
  [{ row: 2, col: 2 }, { row: 2, col: 1 }],
];

describe("solvePuzzle", () => {
  it.each<{ direction: Direction; expected: readonly (readonly Coord[])[] }>([
    { direction: "north", expected: [crossroadsPaths[1], crossroadsPaths[2], crossroadsPaths[3]] },
    { direction: "east", expected: [crossroadsPaths[0], crossroadsPaths[2], crossroadsPaths[3]] },
    { direction: "south", expected: [crossroadsPaths[0], crossroadsPaths[1], crossroadsPaths[3]] },
    { direction: "west", expected: [crossroadsPaths[0], crossroadsPaths[1], crossroadsPaths[2]] },
  ])("excludes the forbidden $direction move, preserving the other choices", ({ direction, expected }) => {
    expect(solvePuzzle(crossroads(direction), 4)).toEqual(expected);
  });

  it("returns the unique six-move corridor, including start and no extra move", () => {
    expect(solvePuzzle(corridor())).toEqual([corridorPath]);
  });

  it("keeps distinct paths to the same endpoint and backtracks visited cells", () => {
    const puzzle = fixture(
      { row: 2, col: 2 },
      [
        [2, 2, "moon"],
        [1, 2, "leaf"],
        [2, 3, "leaf"],
        [1, 3, "star"],
        [0, 3, "mushroom"],
      ],
      [{ symbol: "leaf" }, { symbol: "star" }, { symbol: "mushroom" }],
    );
    const paths = [
      [{ row: 2, col: 2 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 0, col: 3 }],
      [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 1, col: 3 }, { row: 0, col: 3 }],
    ];
    expect(solvePuzzle(puzzle, 10)).toEqual(paths);
    expect(solvePuzzle(puzzle, 1)).toEqual([paths[0]]);
    expect(solvePuzzle(puzzle)).toEqual(paths);
  });

  it("defaults to two solutions in north/east/south/west order", () => {
    expect(solvePuzzle(crossroads())).toEqual([crossroadsPaths[0], crossroadsPaths[1]]);
  });

  it.each([
    { limit: 1, expected: [crossroadsPaths[0]] },
    { limit: 3, expected: [crossroadsPaths[0], crossroadsPaths[1], crossroadsPaths[2]] },
    { limit: 4, expected: crossroadsPaths },
    { limit: Number.MAX_SAFE_INTEGER, expected: crossroadsPaths },
  ])("returns at most $limit solutions in deterministic order", ({ limit, expected }) => {
    expect(solvePuzzle(crossroads(), limit)).toEqual(expected);
  });

  it.each([1, 2])("does not explore a later branch after finding %s solutions", (limit) => {
    const puzzle = crossroads();
    const grid = puzzle.grid.map((row) => [...row]);
    const later = limit === 1 ? { row: 2, col: 3 } : { row: 3, col: 2 };
    grid[later.row][later.col] = {
      kind: "symbol",
      get symbol(): SymbolId {
        throw new Error("Search continued after reaching limit");
      },
    };
    expect(solvePuzzle({ ...puzzle, grid }, limit)).toEqual(
      limit === 1 ? [crossroadsPaths[0]] : [crossroadsPaths[0], crossroadsPaths[1]],
    );
  });

  it("returns no solution when the next symbol does not match", () => {
    const puzzle = fixture(
      { row: 0, col: 0 },
      [[0, 0, "moon"], [0, 1, "star"]],
      [{ symbol: "leaf" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it("does not return partial paths when a later clue has no match", () => {
    const puzzle = fixture(
      { row: 0, col: 0 },
      [[0, 0, "moon"], [0, 1, "leaf"]],
      [{ symbol: "leaf" }, { symbol: "star" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it("cannot cross an obstacle to reach a matching symbol", () => {
    const puzzle = fixture(
      { row: 2, col: 2 },
      [[2, 2, "moon"], [2, 4, "leaf"]],
      [{ symbol: "leaf" }, { symbol: "leaf" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it("does not move diagonally", () => {
    const puzzle = fixture(
      { row: 1, col: 1 },
      [[1, 1, "moon"], [0, 0, "leaf"], [0, 2, "leaf"], [2, 0, "leaf"], [2, 2, "leaf"]],
      [{ symbol: "leaf" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it("cannot revisit the start even when its symbol matches", () => {
    const puzzle = fixture(
      { row: 0, col: 0 },
      [[0, 0, "moon"], [0, 1, "leaf"]],
      [{ symbol: "leaf" }, { symbol: "moon" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it("cannot revisit another cell in the current path", () => {
    const puzzle = fixture(
      { row: 0, col: 0 },
      [[0, 0, "moon"], [0, 1, "leaf"], [0, 2, "star"]],
      [{ symbol: "leaf" }, { symbol: "star" }, { symbol: "leaf" }],
    );
    expect(solvePuzzle(puzzle)).toEqual([]);
  });

  it.each([
    { start: { row: 0, col: 0 }, target: { row: 0, col: 1 }, acrossRow: 4, acrossCol: 4 },
    { start: { row: 0, col: 4 }, target: { row: 0, col: 3 }, acrossRow: 4, acrossCol: 0 },
    { start: { row: 4, col: 0 }, target: { row: 4, col: 1 }, acrossRow: 0, acrossCol: 4 },
    { start: { row: 4, col: 4 }, target: { row: 4, col: 3 }, acrossRow: 0, acrossCol: 0 },
  ])("stays in bounds without wrapping from $start", ({ start, target, acrossRow, acrossCol }) => {
    const puzzle = fixture(
      start,
      [
        [start.row, start.col, "moon"],
        [target.row, target.col, "leaf"],
        [acrossRow, start.col, "leaf"],
        [start.row, acrossCol, "leaf"],
      ],
      [{ symbol: "leaf" }],
    );
    expect(solvePuzzle(puzzle, 4)).toEqual([[start, target]]);
  });

  it.each<{ direction: Direction; expected: readonly (readonly Coord[])[] }>([
    { direction: "north", expected: [] },
    { direction: "east", expected: [[{ row: 1, col: 1 }, { row: 1, col: 2 }, { row: 0, col: 2 }]] },
  ])("applies only the current clue's forbidden $direction direction", ({ direction, expected }) => {
    const puzzle = fixture(
      { row: 1, col: 1 },
      [[1, 1, "moon"], [1, 2, "leaf"], [0, 2, "star"]],
      [{ symbol: "leaf", forbiddenDirection: "north" }, { symbol: "star", forbiddenDirection: direction }],
    );
    expect(solvePuzzle(puzzle)).toEqual(expected);
  });

  it("returns only the start for a zero-move fixture", () => {
    const puzzle = fixture({ row: 2, col: 2 }, [[2, 2, "moon"]], []);
    expect(solvePuzzle(puzzle)).toEqual([[{ row: 2, col: 2 }]]);
  });

  it("supports an eight-move puzzle without a hardcoded six-move cutoff", () => {
    const puzzle = corridor();
    const grid = puzzle.grid.map((row) => [...row]);
    grid[4][4] = { kind: "symbol", symbol: "leaf" };
    expect(solvePuzzle({
      ...puzzle,
      grid,
      clues: Array.from({ length: 8 }, () => ({ symbol: "leaf" })),
    })).toEqual([[...corridorPath, { row: 3, col: 4 }, { row: 4, col: 4 }]]);
  });

  it("solves deeply frozen input without changing any puzzle data", () => {
    const puzzle = crossroads("west");
    const before = structuredClone(puzzle);
    for (const row of puzzle.grid) {
      for (const cell of row) Object.freeze(cell);
      Object.freeze(row);
    }
    Object.freeze(puzzle.grid);
    Object.freeze(puzzle.start);
    for (const clue of puzzle.clues) Object.freeze(clue);
    Object.freeze(puzzle.clues);
    Object.freeze(puzzle);

    expect(solvePuzzle(puzzle, 3)).toEqual([
      crossroadsPaths[0], crossroadsPaths[1], crossroadsPaths[2],
    ]);
    expect(puzzle).toEqual(before);
  });

  it("copies solution paths and coordinates independently of input and other calls", () => {
    const puzzle = crossroads();
    const solutions = solvePuzzle(puzzle, 4);
    const laterSolutions = solvePuzzle(puzzle, 1);
    expect(solutions).toEqual(crossroadsPaths);
    expect(laterSolutions).toEqual([crossroadsPaths[0]]);
    expect(solutions[0]).not.toBe(laterSolutions[0]);
    expect(solutions[0][1]).not.toBe(laterSolutions[0][1]);
    for (const path of solutions) {
      expect(path[0]).not.toBe(puzzle.start);
    }
    for (const path of solutions.slice(1)) {
      expect(path).not.toBe(solutions[0]);
      expect(path[0]).not.toBe(solutions[0][0]);
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid limit %s with RangeError",
    (limit) => {
      expect(() => solvePuzzle(corridor(), limit)).toThrow(RangeError);
    },
  );
});
