export type Coord = Readonly<{ row: number; col: number }>;
export type Role = "a" | "b";
export type SymbolId = "leaf" | "moon" | "star" | "mushroom";
export type Direction = "north" | "east" | "south" | "west";
export type PuzzleVersion = "1";

export type Cell =
  | Readonly<{ kind: "obstacle" }>
  | Readonly<{ kind: "symbol"; symbol: SymbolId }>;
export type Grid = readonly (readonly Cell[])[];
export type Clue = Readonly<{ symbol: SymbolId; forbiddenDirection?: Direction }>;
export type PuzzleSession = Readonly<{ version: PuzzleVersion; seed: string }>;

export type Puzzle = PuzzleSession & Readonly<{
  grid: Grid;
  start: Coord;
  clues: readonly Clue[];
}>;

export type MapView = Readonly<{
  puzzleId: string;
  grid: Grid;
  start: Coord;
  stepCount: number;
}>;

export type ClueView = Readonly<{
  puzzleId: string;
  clues: readonly Clue[];
  stepCount: number;
}>;

export type PathValidation =
  | Readonly<{ valid: true }>
  | Readonly<{
      valid: false;
      code: "length" | "start" | "bounds" | "obstacle" | "revisit" | "adjacency" | "symbol" | "direction";
      message: string;
    }>;

export interface PuzzleEngine {
  generatePuzzle(session: PuzzleSession): Puzzle;
  getRoleView(puzzle: Puzzle, role: "a"): MapView;
  getRoleView(puzzle: Puzzle, role: "b"): ClueView;
  getRoleView(puzzle: Puzzle, role: Role): MapView | ClueView;
  validatePath(puzzle: Puzzle, path: readonly Coord[]): PathValidation;
  solvePuzzle(puzzle: Puzzle, limit?: number): readonly (readonly Coord[])[];
}

export type SubmissionState = Readonly<{
  status: "idle" | "demo" | "success" | "error";
  message: string;
}>;

export interface GameSetupProps {
  puzzleId: string;
  roleLinks: Readonly<Record<Role, string>>;
  onNewGame: () => void;
  onSelectRole: (role: Role) => void;
  onPrint: () => void;
}

export type RolePanelProps =
  | {
      role: "a";
      view: MapView;
      path: readonly Coord[];
      onSelectCell: (coord: Coord) => void;
      onUndo: () => void;
      onClear: () => void;
      onSubmit: () => void;
      submission: SubmissionState;
    }
  | { role: "b"; view: ClueView };

export interface PuzzleMapProps {
  view: MapView;
  path: readonly Coord[];
  onSelectCell?: (coord: Coord) => void;
  printMode?: boolean;
}

export interface PrintPagesProps {
  mapView: MapView;
  clueView: ClueView;
  answer?: readonly Coord[];
}
