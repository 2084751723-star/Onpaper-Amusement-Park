// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generatePuzzle, getRoleView, validatePath } from "./engine";
import { solvePuzzle } from "./solve";
import { BASE_TEMPLATES } from "./templates";
import { GEOMETRIES, SYMBOL_PERMUTATIONS, transformTemplate } from "./variants";
import type { Coord, Puzzle } from "./types";

function expectedCoord({ row: r, col: c }: Coord, geometryIndex: number): Coord {
  const images = [[r, c], [c, 4 - r], [4 - r, 4 - c], [4 - c, r],
    [r, 4 - c], [4 - c, 4 - r], [4 - r, c], [c, r]];
  const [row, col] = images[geometryIndex];
  return { row, col };
}

function mapWalks(puzzle: Puzzle): Coord[][] {
  const walks: Coord[][] = [];
  function visit(path: Coord[]) {
    if (path.length === puzzle.clues.length + 1) {
      walks.push(path);
      return;
    }
    const { row, col } = path[path.length - 1];
    for (const [r, c] of [[row - 1, col], [row, col + 1], [row + 1, col], [row, col - 1]]) {
      if (r < 0 || r > 4 || c < 0 || c > 4 || puzzle.grid[r][c].kind === "obstacle") continue;
      if (path.some((coord) => coord.row === r && coord.col === c)) continue;
      visit([...path, { row: r, col: c }]);
    }
  }
  visit([puzzle.start]);
  return walks;
}

const combinations = BASE_TEMPLATES.flatMap((template, templateIndex) =>
  GEOMETRIES.flatMap((geometry, geometryIndex) =>
    SYMBOL_PERMUTATIONS.map((permutation, permutationIndex) => ({
      template, templateIndex, geometry, geometryIndex, permutation, permutationIndex,
    })),
  ),
);

function content(puzzle: Puzzle): string {
  return JSON.stringify({ grid: puzzle.grid, start: puzzle.start, clues: puzzle.clues });
}

describe("two templates × eight geometries × 24 symbol permutations", () => {
  it("covers 384 distinct playable puzzle contents", () => {
    expect(BASE_TEMPLATES).toHaveLength(2);
    expect(combinations).toHaveLength(384);
    const contents = combinations.map(({ template, geometry, permutation }) =>
      JSON.stringify(transformTemplate(template, geometry, permutation)),
    );
    expect(new Set(contents).size).toBe(384);
  });

  it.each(combinations)(
    "template $templateIndex / $geometry / permutation $permutationIndex has exactly one full solution",
    ({ template, templateIndex, geometry, geometryIndex, permutation, permutationIndex }) => {
      const original: Puzzle = { ...template, version: "1", seed: "000000" };
      const baseSolutions = solvePuzzle(original);
      expect(baseSolutions).toHaveLength(1);
      const puzzle: Puzzle = { ...transformTemplate(template, geometry, permutation), version: "1", seed: "000000" };
      const expected = baseSolutions[0].map((coord) => expectedCoord(coord, geometryIndex));
      expect(solvePuzzle(puzzle)).toEqual([expected]);
      expect(validatePath(puzzle, expected)).toEqual({ valid: true });
      const walks = mapWalks(puzzle);
      expect(new Set(walks.map((path) => JSON.stringify(path[path.length - 1]))).size).toBeGreaterThanOrEqual(2);
      expect(walks.filter((path) => validatePath(puzzle, path).valid)).toEqual([expected]);
      const seed = (templateIndex + 2 * geometryIndex + 16 * permutationIndex).toString(16).padStart(6, "0").toUpperCase();
      expect(generatePuzzle({ version: "1", seed })).toEqual({ ...puzzle, seed });
    },
  );
});

describe("deterministic version-one seed selection", () => {
  it.each([
    { seed: "ABCDEF", rows: ["MULSU", "SL#ML", "#SMLM", "UMUUS", "L#SM#"], clues: "SLULSMUS" },
    { seed: "FFFFFF", rows: ["SLMUL", "UM#SM", "#USMS", "LSLLU", "M#US#"], clues: "UMLMUSLU" },
  ])("preserves the independently calculated version-one mapping for $seed", ({ seed, rows, clues }) => {
    const tokens = { leaf: "L", moon: "M", star: "S", mushroom: "U" };
    const puzzle = generatePuzzle({ version: "1", seed });
    expect(puzzle.start).toEqual({ row: 0, col: 4 });
    expect(puzzle.grid.map((row) => row.map((cell) => cell.kind === "obstacle" ? "#" : tokens[cell.symbol]).join(""))).toEqual(rows);
    expect(puzzle.clues.map((clue) => tokens[clue.symbol]).join("")).toBe(clues);
    expect(puzzle.clues.map((clue) => clue.forbiddenDirection)).toEqual([
      undefined, undefined, undefined, undefined, undefined, "south", undefined, undefined,
    ]);
  });

  it("reaches all 384 variants through seeds 000000 to 00017F", () => {
    const contents = new Set(Array.from({ length: 384 }, (_, index) =>
      content(generatePuzzle({ version: "1", seed: index.toString(16).padStart(6, "0") })),
    ));
    expect(contents.size).toBe(384);
  });

  it("reproduces unique solutions for 1000 distinct seeds spread across the six-digit range", () => {
    const seeds = Array.from({ length: 1000 }, (_, index) =>
      ((index * 104729) & 0xFFFFFF).toString(16).padStart(6, "0").toUpperCase(),
    );
    expect(new Set(seeds).size).toBe(1000);
    for (const seed of seeds) {
      const puzzle = generatePuzzle({ version: "1", seed });
      expect(generatePuzzle({ version: "1", seed: seed.toLowerCase() }), seed).toEqual(puzzle);
      const solutions = solvePuzzle(puzzle);
      expect(solutions, seed).toHaveLength(1);
      expect(validatePath(puzzle, solutions[0]), seed).toEqual({ valid: true });
      const map = getRoleView(puzzle, "a");
      const clues = getRoleView(puzzle, "b");
      expect(map.puzzleId).toBe(`1-${seed}`);
      expect(clues.puzzleId).toBe(map.puzzleId);
      expect(Object.keys(map).sort()).toEqual(["grid", "puzzleId", "start", "stepCount"]);
      expect(Object.keys(clues).sort()).toEqual(["clues", "puzzleId", "stepCount"]);
    }
  });

  it.each(["000000", "000001", "000002", "000010", "00017F", "000180", "ABCDEF", "FFFFFF"])(
    "round-trips boundary seed %s without leaking answers", (seed) => {
      const puzzle = generatePuzzle({ version: "1", seed });
      expect(puzzle.seed).toBe(seed);
      expect(Object.keys(puzzle).sort()).toEqual(["clues", "grid", "seed", "start", "version"]);
      expect(solvePuzzle(puzzle)).toHaveLength(1);
    },
  );

  it("has an explicitly bounded catalogue, while retaining different session identities", () => {
    const first = generatePuzzle({ version: "1", seed: "000000" });
    const repeatedContent = generatePuzzle({ version: "1", seed: "000180" });
    expect(content(repeatedContent)).toBe(content(first));
    expect(getRoleView(first, "a").puzzleId).not.toBe(getRoleView(repeatedContent, "a").puzzleId);
  });
});
