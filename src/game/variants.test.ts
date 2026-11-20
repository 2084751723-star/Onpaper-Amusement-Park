import { describe, expect, it } from "vitest";
import type { Cell, Coord, Direction, Puzzle, SymbolId } from "./types";
import { GEOMETRIES, SYMBOL_PERMUTATIONS, transformCoord, transformTemplate } from "./variants";
import type { Geometry } from "./variants";

type Template = Omit<Puzzle, "version" | "seed">;
const SYMBOLS = ["leaf", "moon", "star", "mushroom"] as const;
const DIRECTIONS = ["north", "east", "south", "west"] as const;
const TOKENS: Record<string, Cell> = {
  L: { kind: "symbol", symbol: "leaf" },
  M: { kind: "symbol", symbol: "moon" },
  S: { kind: "symbol", symbol: "star" },
  U: { kind: "symbol", symbol: "mushroom" },
  X: { kind: "obstacle" },
};
function grid(rows: readonly string[]): Cell[][] {
  return rows.map((row) => [...row].map((token) => ({ ...TOKENS[token] })));
}
function fixture(): Template {
  return {
    grid: grid(["LMSUX", "XSLMU", "MXUSL", "SUMXL", "ULXMS"]),
    start: { row: 0, col: 1 },
    clues: [
      { symbol: "leaf", forbiddenDirection: "north" },
      { symbol: "moon", forbiddenDirection: "east" },
      { symbol: "star", forbiddenDirection: "south" },
      { symbol: "mushroom", forbiddenDirection: "west" },
      { symbol: "moon" },
    ],
  };
}

// Literal oracles: coordinates, N/E/S/W images, and complete board layouts.
const CASES: readonly {
  geometry: Geometry;
  coord: Coord;
  directions: readonly Direction[];
  rows: readonly string[];
}[] = [
  { geometry: "identity", coord: { row: 0, col: 1 },
    directions: ["north", "east", "south", "west"],
    rows: ["LMSUX", "XSLMU", "MXUSL", "SUMXL", "ULXMS"] },
  { geometry: "rotate90", coord: { row: 1, col: 4 },
    directions: ["east", "south", "west", "north"],
    rows: ["USMXL", "LUXSM", "XMULS", "MXSMU", "SLLUX"] },
  { geometry: "rotate180", coord: { row: 4, col: 3 },
    directions: ["south", "west", "north", "east"],
    rows: ["SMXLU", "LXMUS", "LSUXM", "UMLSX", "XUSML"] },
  { geometry: "rotate270", coord: { row: 3, col: 0 },
    directions: ["west", "north", "east", "south"],
    rows: ["XULLS", "UMSXM", "SLUMX", "MSXUL", "LXMSU"] },
  { geometry: "mirror", coord: { row: 0, col: 3 },
    directions: ["north", "west", "south", "east"],
    rows: ["XUSML", "UMLSX", "LSUXM", "LXMUS", "SMXLU"] },
  { geometry: "mirrorRotate90", coord: { row: 3, col: 4 },
    directions: ["east", "north", "west", "south"],
    rows: ["SLLUX", "MXSMU", "XMULS", "LUXSM", "USMXL"] },
  { geometry: "mirrorRotate180", coord: { row: 4, col: 1 },
    directions: ["south", "east", "north", "west"],
    rows: ["ULXMS", "SUMXL", "MXUSL", "XSLMU", "LMSUX"] },
  { geometry: "mirrorRotate270", coord: { row: 1, col: 0 },
    directions: ["west", "south", "east", "north"],
    rows: ["LXMSU", "MSXUL", "SLUMX", "UMSXM", "XULLS"] },
];

describe("geometry variants", () => {
  it("exports the eight geometries in the frozen order", () => {
    expect(GEOMETRIES).toEqual([
      "identity", "rotate90", "rotate180", "rotate270",
      "mirror", "mirrorRotate90", "mirrorRotate180", "mirrorRotate270",
    ]);
  });

  it.each(CASES)("$geometry maps an asymmetric coordinate", ({ geometry, coord }) => {
    const input = Object.freeze({ row: 0, col: 1 });
    const output = transformCoord(input, geometry);
    expect(output).toEqual(coord);
    expect(output).not.toBe(input);
    expect(input).toEqual({ row: 0, col: 1 });
  });

  for (const { geometry, directions } of CASES) {
    it.each(DIRECTIONS.map((direction, index) => ({ direction, expected: directions[index] })))(
      `${geometry} maps $direction to $expected`, ({ direction, expected }) => {
        const input = { ...fixture(), clues: [{ symbol: "leaf" as const, forbiddenDirection: direction }] };
        expect(transformTemplate(input, geometry, SYMBOLS).clues).toEqual([
          { symbol: "leaf", forbiddenDirection: expected },
        ]);
      },
    );
  }

  it.each(CASES)("$geometry moves every grid cell, obstacle and start together", ({ geometry, coord, rows }) => {
    const result = transformTemplate(fixture(), geometry, SYMBOLS);
    expect(result.grid).toEqual(grid(rows));
    expect(result.start).toEqual(coord);
    expect(result.grid[result.start.row][result.start.col]).toEqual({ kind: "symbol", symbol: "moon" });
    expect(result.clues.map((clue) => clue.symbol)).toEqual(["leaf", "moon", "star", "mushroom", "moon"]);
    expect(result.clues[4]).toEqual({ symbol: "moon" });
  });

  it("mirrors left/right before rotating, not after", () => {
    const input = { row: 0, col: 1 };
    expect(transformCoord(input, "mirror")).toEqual({ row: 0, col: 3 });
    const mirrorThenRotate = transformCoord(transformCoord(input, "mirror"), "rotate90");
    const rotateThenMirror = transformCoord(transformCoord(input, "rotate90"), "mirror");
    expect(mirrorThenRotate).toEqual({ row: 3, col: 4 });
    expect(rotateThenMirror).toEqual({ row: 1, col: 0 });
    expect(transformCoord(input, "mirrorRotate90")).toEqual(mirrorThenRotate);
  });

  it("four clockwise rotations restore the complete template", () => {
    const input = fixture();
    let result = input;
    for (let i = 0; i < 4; i++) result = transformTemplate(result, "rotate90", SYMBOLS);
    expect(result).toEqual(input);
  });

  it("two left/right mirrors restore the complete template", () => {
    const input = fixture();
    expect(transformTemplate(transformTemplate(input, "mirror", SYMBOLS), "mirror", SYMBOLS)).toEqual(input);
  });
});

describe("symbol permutations", () => {
  it("exports all 24 unique complete permutations with identity first", () => {
    expect(SYMBOL_PERMUTATIONS).toHaveLength(24);
    expect(SYMBOL_PERMUTATIONS[0]).toEqual(SYMBOLS);
    expect(new Set(SYMBOL_PERMUTATIONS.map((permutation) => permutation.join(","))).size).toBe(24);
    for (const permutation of SYMBOL_PERMUTATIONS) {
      expect([...permutation].sort()).toEqual([...SYMBOLS].sort());
    }
  });

  it("maps base-order symbols consistently in grid and clues for every permutation", () => {
    const input = fixture();
    for (const permutation of SYMBOL_PERMUTATIONS) {
      const result = transformTemplate(input, "identity", permutation);
      input.grid.forEach((row, r) => row.forEach((cell, c) => {
        expect(result.grid[r][c]).toEqual(cell.kind === "obstacle"
          ? { kind: "obstacle" }
          : { kind: "symbol", symbol: permutation[SYMBOLS.indexOf(cell.symbol)] });
      }));
      expect(result.clues.map((clue) => clue.symbol)).toEqual([
        permutation[0], permutation[1], permutation[2], permutation[3], permutation[1],
      ]);
      expect(result.clues.map((clue) => clue.forbiddenDirection)).toEqual([...DIRECTIONS, undefined]);
      expect(result.start).toEqual(input.start);
    }
  });

  it("combines geometry and a nontrivial symbol permutation", () => {
    const result = transformTemplate(fixture(), "mirrorRotate90", ["moon", "star", "mushroom", "leaf"]);
    expect(result.grid).toEqual(grid(["UMMLX", "SXUSL", "XSLMU", "MLXUS", "LUSXM"]));
    expect(result.start).toEqual({ row: 3, col: 4 });
    expect(result.clues).toEqual([
      { symbol: "moon", forbiddenDirection: "east" },
      { symbol: "star", forbiddenDirection: "north" },
      { symbol: "mushroom", forbiddenDirection: "west" },
      { symbol: "leaf", forbiddenDirection: "south" },
      { symbol: "star" },
    ]);
  });
});

describe("input immutability and reference isolation", () => {
  it.each(CASES)("$geometry clones every nested value without modifying frozen inputs", ({ geometry }) => {
    const input = fixture();
    const snapshot = structuredClone(input);
    input.grid.forEach((row) => { row.forEach(Object.freeze); Object.freeze(row); });
    input.clues.forEach(Object.freeze);
    Object.freeze(input.grid);
    Object.freeze(input.start);
    Object.freeze(input.clues);
    Object.freeze(input);
    const permutation: readonly SymbolId[] = Object.freeze(["moon", "star", "mushroom", "leaf"]);
    const result = transformTemplate(input, geometry, permutation);
    const second = transformTemplate(input, geometry, permutation);
    expect(input).toEqual(snapshot);
    expect(permutation).toEqual(["moon", "star", "mushroom", "leaf"]);
    expect(result).not.toBe(input);
    expect(result.grid).not.toBe(input.grid);
    expect(result.start).not.toBe(input.start);
    expect(result.clues).not.toBe(input.clues);
    expect(result.grid).not.toBe(second.grid);
    expect(result.start).not.toBe(second.start);
    expect(result.clues).not.toBe(second.clues);
    result.grid.forEach((row, r) => {
      expect(input.grid.includes(row)).toBe(false);
      expect(row).not.toBe(second.grid[r]);
      row.forEach((cell, c) => {
        expect(input.grid.flat().includes(cell)).toBe(false);
        expect(cell).not.toBe(second.grid[r][c]);
      });
    });
    result.clues.forEach((clue, index) => {
      expect(input.clues.includes(clue)).toBe(false);
      expect(clue).not.toBe(second.clues[index]);
    });
  });
});
