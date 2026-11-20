import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameSetup } from "./components/GameSetup";
import { RolePanel } from "./components/RolePanel";
import { PrintPages } from "./components/PrintPages";
import { generatePuzzle, getRoleView, validatePath } from "./game/engine";
import { solvePuzzle } from "./game/solve";
import type { ClueView, Coord, MapView, Puzzle, Role, SubmissionState } from "./game/types";

type Page = "setup" | Role | "print";
type Route = { seed: string; page: Page };
const DEFAULT_SEED = "000000";
const ALTERNATE_SEED = "ABCDEF";
const idleSubmission: SubmissionState = { status: "idle", message: "" };

function readRoute(search: string): Route | string {
  const params = new URLSearchParams(search);
  if (params.size === 0) return { seed: DEFAULT_SEED, page: "setup" };
  const allowed = ["v", "seed", "role", "mode"];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) return "链接包含未知或重复参数。";
  }
  if (params.get("v") !== "1") return "不支持此版本，请检查链接。";
  const seed = params.get("seed")?.toUpperCase();
  if (!seed || !/^[0-9A-F]{6}$/.test(seed)) return "种子必须是六位十六进制。";
  const role = params.get("role");
  const mode = params.get("mode");
  if (role !== null && role !== "a" && role !== "b") return "角色只能是 a 或 b。";
  if (mode !== null && mode !== "print") return "不支持此页面模式。";
  if (mode && role) return "打印模式不能同时指定角色。";
  return { seed, page: mode === "print" ? "print" : role ?? "setup" };
}

function pageUrl(seed: string, page: Page): URL {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("v", "1");
  url.searchParams.set("seed", seed);
  if (page === "a" || page === "b") url.searchParams.set("role", page);
  if (page === "print") url.searchParams.set("mode", "print");
  return url;
}

function PrintPreview({ puzzle, mapView, clueView }: {
  puzzle: Puzzle;
  mapView: MapView;
  clueView: ClueView;
}) {
  const [includeAnswer, setIncludeAnswer] = useState(false);
  const answer = useMemo(
    () => (includeAnswer ? solvePuzzle(puzzle, 2)[0] : undefined),
    [includeAnswer, puzzle],
  );
  return (
    <section className="space-y-6" aria-label="打印预览">
      <div className="screen-only space-y-4">
        <h2 className="text-xl font-semibold">打印预览</h2>
        <p>默认仅 A / B 两页；答案页由独立求解器验证的唯一解生成，勾选时才会挂载。A4 / PDF 正式验收由后续打印任务完成。</p>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={includeAnswer} onChange={(event) => setIncludeAnswer(event.target.checked)} />
          附上本题答案
        </label>
        <Button type="button" onClick={() => window.print()}>打印 / 保存 PDF</Button>
      </div>
      <PrintPages mapView={mapView} clueView={clueView} answer={answer} />
    </section>
  );
}

function PuzzleSession({ route, navigate }: {
  route: Route;
  navigate: (seed: string, page: Page) => void;
}) {
  const puzzle = useMemo(() => generatePuzzle({ version: "1", seed: route.seed }), [route.seed]);
  const mapView = useMemo(() => getRoleView(puzzle, "a"), [puzzle]);
  const clueView = useMemo(() => getRoleView(puzzle, "b"), [puzzle]);
  const [path, setPath] = useState<readonly Coord[]>([mapView.start]);
  const [submission, setSubmission] = useState<SubmissionState>(idleSubmission);

  function selectCell(coord: Coord) {
    const cell = mapView.grid[coord.row][coord.col];
    const last = path[path.length - 1];
    let message = "";
    if (cell.kind === "obstacle") message = "不能穿过障碍。";
    else if (path.some((step) => step.row === coord.row && step.col === coord.col)) message = "不能重复经过同一格。";
    else if (Math.abs(last.row - coord.row) + Math.abs(last.col - coord.col) !== 1) message = "请选择与路径末格正交相邻的格子。";
    else if (path.length >= mapView.stepCount + 1) message = "已达到本题步数，请撤销或清空后调整。";
    if (message) {
      setSubmission({ status: "error", message });
      return;
    }
    setPath([...path, coord]);
    setSubmission(idleSubmission);
  }

  function submit() {
    const result = validatePath(puzzle, path);
    setSubmission(result.valid
      ? { status: "success", message: "验题通过：完整路径正确，宝藏已找到！" }
      : { status: "error", message: result.message });
  }

  return (
    <>
      {route.page !== "setup" && (
        <nav className="screen-only flex flex-wrap gap-3" aria-label="页面导航">
          <Button variant="outline" onClick={() => navigate(route.seed, "setup")}>返回角色入口</Button>
          {route.page !== "print" && <Button variant="outline" onClick={() => navigate(route.seed, "print")}>打印预览</Button>}
        </nav>
      )}
      {route.page === "setup" && (
        <GameSetup
          puzzleId={mapView.puzzleId}
          roleLinks={{ a: pageUrl(route.seed, "a").href, b: pageUrl(route.seed, "b").href }}
          onNewGame={() => navigate(route.seed === DEFAULT_SEED ? ALTERNATE_SEED : DEFAULT_SEED, "setup")}
          onSelectRole={(role) => navigate(route.seed, role)}
          onPrint={() => navigate(route.seed, "print")}
        />
      )}
      {route.page === "a" && (
        <div className="screen-only">
          <RolePanel
            role="a"
            view={mapView}
            path={path}
            onSelectCell={selectCell}
            onUndo={() => { setPath(path.slice(0, Math.max(1, path.length - 1))); setSubmission(idleSubmission); }}
            onClear={() => { setPath([mapView.start]); setSubmission(idleSubmission); }}
            onSubmit={submit}
            submission={submission}
          />
        </div>
      )}
      {route.page === "b" && <div className="screen-only"><RolePanel role="b" view={clueView} /></div>}
      {route.page === "print" && <PrintPreview puzzle={puzzle} mapView={mapView} clueView={clueView} />}
    </>
  );
}

export default function App() {
  const [search, setSearch] = useState(() => window.location.search);
  const route = readRoute(search);

  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const parsed = readRoute(search);
    const seed = new URLSearchParams(search).get("seed");
    if (typeof parsed !== "string" && seed && seed !== parsed.seed) {
      window.history.replaceState({}, "", pageUrl(parsed.seed, parsed.page));
    }
  }, [search]);

  function navigate(seed: string, page: Page) {
    const url = pageUrl(seed, page);
    window.history.pushState({}, "", url);
    setSearch(url.search);
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-6 p-4 text-base text-foreground sm:p-8 print:max-w-none print:p-0">
      <header className="screen-only space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">纸上游乐场 · 失落森林</h1>
        <p className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground">
          正式谜题已接入：A 探路员看地图、B 解读员看有序符号线索；打开同一题号的不同角色链接，通话协作找到宝藏。
        </p>
        <p className="text-sm text-muted-foreground">两人通过现有通话交流，本页没有实时房间或同步进度。当前版本各题号复用同一道已验证谜题，布局变体随后续版本接入；刷新会重置本端路径。</p>
      </header>
      {typeof route === "string" ? (
        <section className="screen-only space-y-4">
          <p role="alert">链接无效：{route}</p>
          <Button onClick={() => navigate(DEFAULT_SEED, "setup")}>打开题目入口</Button>
        </section>
      ) : (
        <PuzzleSession key={route.seed} route={route} navigate={navigate} />
      )}
    </main>
  );
}
