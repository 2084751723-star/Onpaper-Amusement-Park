import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameSetup } from "./components/GameSetup";
import { RolePanel } from "./components/RolePanel";
import { PrintPages } from "./components/PrintPages";
import { generatePuzzle, getRoleView, validatePath } from "./game/engine";
import { solvePuzzle } from "./game/solve";
import {
  createPrintLink,
  createRoleLink,
  createSession,
  loadProgress,
  parseSession,
  saveProgress,
} from "./lib/session";
import type { SessionRoute } from "./lib/session";
import type { ClueView, Coord, MapView, Puzzle, PuzzleSession, Role, SubmissionState } from "./game/types";

type Page = "setup" | Role | "print";
const DEFAULT_SESSION: PuzzleSession = { version: "1", seed: "000000" };
const idleSubmission: SubmissionState = { status: "idle", message: "" };

function routePage(route: SessionRoute): Page {
  if (route.mode === "print") return "print";
  return route.mode === "role" ? route.role : "setup";
}

function pageUrl(session: PuzzleSession, page: Page): string {
  if (page === "a" || page === "b") return createRoleLink(window.location.href, session, page);
  if (page === "print") return createPrintLink(window.location.href, session);
  const url = new URL(createPrintLink(window.location.href, session));
  url.searchParams.delete("mode");
  return url.href;
}

function restorePath(session: PuzzleSession, mapView: MapView): readonly Coord[] {
  const saved = loadProgress(session, "a");
  if (!saved) return [mapView.start];
  const usable = saved[0].row === mapView.start.row && saved[0].col === mapView.start.col
    && saved.length <= mapView.stepCount + 1
    && saved.every((coord) => mapView.grid[coord.row][coord.col].kind !== "obstacle");
  return usable ? saved : [mapView.start];
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
        <p>默认仅 A / B 两页；答案页由独立求解器验证的唯一解生成，勾选时才会挂载。已按 A4 纵向真实导出验证两页/三页分页与黑白可读（实体打印未验收）。</p>
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

function PuzzleSession({ session, page, navigate }: {
  session: PuzzleSession;
  page: Page;
  navigate: (target: PuzzleSession, page: Page) => void;
}) {
  const puzzle = useMemo(() => generatePuzzle(session), [session.seed]);
  const mapView = useMemo(() => getRoleView(puzzle, "a"), [puzzle]);
  const clueView = useMemo(() => getRoleView(puzzle, "b"), [puzzle]);
  const [path, setPath] = useState<readonly Coord[]>(() => restorePath(session, mapView));
  const [submission, setSubmission] = useState<SubmissionState>(idleSubmission);

  useEffect(() => { saveProgress(session, "a", path); }, [path, session.seed]);

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
      {page !== "setup" && (
        <nav className="screen-only flex flex-wrap gap-3" aria-label="页面导航">
          <Button variant="outline" onClick={() => navigate(session, "setup")}>返回角色入口</Button>
          {page !== "print" && <Button variant="outline" onClick={() => navigate(session, "print")}>打印预览</Button>}
        </nav>
      )}
      {page === "setup" && (
        <GameSetup
          puzzleId={mapView.puzzleId}
          roleLinks={{
            a: createRoleLink(window.location.href, session, "a"),
            b: createRoleLink(window.location.href, session, "b"),
          }}
          onNewGame={() => navigate(createSession(), "setup")}
          onSelectRole={(role) => navigate(session, role)}
          onPrint={() => navigate(session, "print")}
        />
      )}
      {page === "a" && (
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
      {page === "b" && <div className="screen-only"><RolePanel role="b" view={clueView} /></div>}
      {page === "print" && <PrintPreview puzzle={puzzle} mapView={mapView} clueView={clueView} />}
    </>
  );
}

export default function App() {
  const [search, setSearch] = useState(() => window.location.search);
  let route: SessionRoute | null = null;
  let routeError: string | null = null;
  try {
    route = parseSession(search);
  } catch (error) {
    routeError = error instanceof Error ? error.message : "链接无效。";
  }
  const session = route?.session ?? DEFAULT_SESSION;

  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!route) return;
    const rawSeed = new URLSearchParams(search).get("seed");
    if (rawSeed && rawSeed !== session.seed) {
      window.history.replaceState({}, "", pageUrl(session, routePage(route)));
    }
  }, [search]);

  function navigate(target: PuzzleSession, targetPage: Page) {
    const href = pageUrl(target, targetPage);
    window.history.pushState({}, "", href);
    setSearch(new URL(href).search);
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-6 p-4 text-base text-foreground sm:p-8 print:max-w-none print:p-0">
      <header className="screen-only space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">纸上游乐场 · 失落森林</h1>
        <p className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground">
          正式谜题已接入：A 探路员看地图、B 解读员看有序符号线索；打开同一题号的不同角色链接，通话协作找到宝藏。
        </p>
        <p className="text-sm text-muted-foreground">两人通过现有通话交流，本页没有实时房间或同步进度。不同题号对应确定性布局变体（均为已验证谜题）；A 端已走路径自动保存在本设备，刷新或重开同一题号可恢复。</p>
      </header>
      {routeError ? (
        <section className="screen-only space-y-4">
          <p role="alert">链接无效：{routeError}</p>
          <Button onClick={() => navigate(DEFAULT_SESSION, "setup")}>打开题目入口</Button>
        </section>
      ) : route && (
        <PuzzleSession key={session.seed} session={session} page={routePage(route)} navigate={navigate} />
      )}
    </main>
  );
}
