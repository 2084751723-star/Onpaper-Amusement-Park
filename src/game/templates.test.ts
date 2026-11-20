import { describe, expect, it } from "vitest";
import { BASE_TEMPLATES } from "./templates";
import { generatePuzzle, validatePath } from "./engine";
import { solvePuzzle } from "./solve";
import type { Coord, Puzzle, PuzzleEngine } from "./types";

function mapOnlyWalks(puzzle: Puzzle): Coord[][] {
  const walks: Coord[][] = [];
  function visit(path: Coord[]) {
    if (path.length === puzzle.clues.length + 1) {
      walks.push(path);
      return;
    }
    const last = path[path.length - 1];
    for (const [rowDelta, colDelta] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
      const next = { row: last.row + rowDelta, col: last.col + colDelta };
      if (next.row < 0 || next.row > 4 || next.col < 0 || next.col > 4) continue;
      if (puzzle.grid[next.row][next.col].kind === "obstacle") continue;
      if (path.some((coord) => coord.row === next.row && coord.col === next.col)) continue;
      visit([...path, next]);
    }
  }
  visit([puzzle.start]);
  return walks;
}

describe("validated base templates", () => {
  it.each(BASE_TEMPLATES.map((template, index) => ({ template, index })))(
    "template $index has one full solution, but A alone has multiple possible endpoints", ({ template }) => {
      const puzzle: Puzzle = { ...template, version: "1", seed: "000000" };
      const solve: PuzzleEngine["solvePuzzle"] = solvePuzzle;
      const solutions = solve(puzzle);
      expect(solutions).toHaveLength(1);
      expect(validatePath(puzzle, solutions[0])).toEqual({ valid: true });
      expect(template.grid.flat().filter((cell) => cell.kind === "symbol").map((cell) => cell.symbol).sort())
        .toEqual(expect.arrayContaining(["leaf", "moon", "star", "mushroom"]));
      expect(template.clues.length).toBeGreaterThanOrEqual(6);
      expect(template.clues.length).toBeLessThanOrEqual(8);
      expect(template.clues.filter((clue) => clue.forbiddenDirection).length).toBeLessThanOrEqual(2);
      const walks = mapOnlyWalks(puzzle);
      const endpoints = new Set(walks.map((path) => JSON.stringify(path[path.length - 1])));
      expect(endpoints.size).toBeGreaterThanOrEqual(2);
      const accepted = walks.filter((path) => validatePath(puzzle, path).valid);
      expect(accepted).toEqual(solutions);
    },
  );

  it("the first template's direction clue resolves otherwise ambiguous full paths", () => {
    const first: Puzzle = { ...BASE_TEMPLATES[0], version: "1", seed: "000000" };
    expect(solvePuzzle(first, 100)).toHaveLength(1);
    const unrestricted = { ...first, clues: first.clues.map(({ symbol }) => ({ symbol })) };
    expect(solvePuzzle(unrestricted, 100)).toHaveLength(3);
    const impossible = { ...first, clues: [{ symbol: "moon" as const }, ...first.clues.slice(1)] };
    expect(solvePuzzle(impossible)).toEqual([]);
  });

  it("the generated first puzzle can be solved independently and every alternative full walk fails", () => {
    const puzzle = generatePuzzle({ version: "1", seed: "000000" });
    const solutions = solvePuzzle(puzzle);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual([
      { row: 2, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 0 },
      { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 1 },
    ]);
    const alternatives = mapOnlyWalks(puzzle).filter((path) => !validatePath(puzzle, path).valid);
    expect(alternatives).toHaveLength(55);
  });
});
