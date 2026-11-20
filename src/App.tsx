import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GameSetup } from "./components/GameSetup";
import { RolePanel } from "./components/RolePanel";
import { PrintPages } from "./components/PrintPages";
import { DEV_ANSWER, DEV_SEEDS, getDevSample, type DevSeed } from "./game/devSample";
import type { ClueView, Coord, MapView, Role, SubmissionState } from "./game/types";

type Page = "setup" | Role | "print";
type DevRoute = { seed: DevSeed; page: Page };
const idleSubmission: SubmissionState = { status: "idle", message: "" };

function readDevRoute(search: string): DevRoute | string {
  const params = new URLSearchParams(search);
  if (params.size === 0) return { seed: DEV_SEEDS[0], page: "setup" };
  const allowed = ["v", "seed", "role", "mode"];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) return "链接包含未知或重复参数。";
  }
  if (params.get("v") !== "1") return "不支持此版本，请检查链接。";
  const seed = params.get("seed")?.toUpperCase();
  if (!seed || !/^[0-9A-F]{6}$/.test(seed)) return "种子必须是六位十六进制。";
  if (seed !== "D00001" && seed !== "D00002") return "当前仅提供 D00001 / D00002 开发样例，正式出题尚未接入。";
  const role = params.get("role");
  const mode = params.get("mode");
  if (role !== null && role !== "a" && role !== "b") return "角色只能是 a 或 b。";
  if (mode !== null && mode !== "print") return "不支持此页面模式。";
  if (mode && role) return "打印模式不能同时指定角色。";
  return { seed, page: mode === "print" ? "print" : role ?? "setup" };
}

function devUrl(seed: DevSeed, page: Page): URL {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("v", "1");
  url.searchParams.set("seed", seed);
  if (page === "a" || page === "b") url.searchParams.set("role", page);
  if (page === "print") url.searchParams.set("mode", "print");
  return url;
}

function PrintPreview({ mapView, clueView }: { mapView: MapView; clueView: ClueView }) {
  const [includeAnswer, setIncludeAnswer] = useState(false);
  return (
    <section className="space-y-6" aria-label="打印预览">
      <div className="screen-only space-y-4">
        <h2 className="text-xl font-semibold">开发样例 · 打印预览</h2>
        <p>默认仅 A / B 两页。答案只供排版，A4 / PDF 正式验收由后续打印任务完成。</p>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={includeAnswer} onChange={(event) => setIncludeAnswer(event.target.checked)} />
          附上开发样例答案
        </label>
        <Button type="button" onClick={() => window.print()}>打印 / 保存 PDF</Button>
      </div>
      <PrintPages mapView={mapView} clueView={clueView} answer={includeAnswer ? DEV_ANSWER : undefined} />
    </section>
  );
}

function DevSession({ route, navigate }: {
  route: DevRoute;
  navigate: (seed: DevSeed, page: Page) => void;
}) {
  const { mapView, clueView } = getDevSample(route.seed);
  const [path, setPath] = useState<readonly Coord[]>([mapView.start]);
  const [submission, setSubmission] = useState<SubmissionState>(idleSubmission);

  function selectCell(coord: Coord) {
    const cell = mapView.grid[coord.row][coord.col];
    const last = path[path.length - 1];
    let message = "";
    if (cell.kind === "obstacle") message = "不能穿过障碍。";
    else if (path.some((step) => step.row === coord.row && step.col === coord.col)) message = "不能重复经过同一格。";
    else if (Math.abs(last.row - coord.row) + Math.abs(last.col - coord.col) !== 1) message = "请选择与路径末格正交相邻的格子。";
    else if (path.length >= mapView.stepCount + 1) message = "已达到样例步数，请撤销或清空后调整。";
    if (message) {
      setSubmission({ status: "error", message });
      return;
    }
    setPath([...path, coord]);
    setSubmission(idleSubmission);
  }

  return (
    <>
      {route.page !== "setup" && (
        <nav className="screen-only flex flex-wrap gap-3" aria-label="开发样例导航">
          <Button variant="outline" onClick={() => navigate(route.seed, "setup")}>返回角色入口</Button>
          {route.page !== "print" && <Button variant="outline" onClick={() => navigate(route.seed, "print")}>打印预览</Button>}
        </nav>
      )}
      {route.page === "setup" && (
        <GameSetup
          puzzleId={mapView.puzzleId}
          roleLinks={{ a: devUrl(route.seed, "a").href, b: devUrl(route.seed, "b").href }}
          onNewGame={() => navigate(route.seed === "D00001" ? "D00002" : "D00001", "setup")}
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
            onSubmit={() => setSubmission({ status: "demo", message: "正式验题待接入；此开发样例不判定解题成功。" })}
            submission={submission}
          />
        </div>
      )}
      {route.page === "b" && <div className="screen-only"><RolePanel role="b" view={clueView} /></div>}
      {route.page === "print" && <PrintPreview mapView={mapView} clueView={clueView} />}
    </>
  );
}

export default function App() {
  const [search, setSearch] = useState(() => window.location.search);
  const route = readDevRoute(search);

  useEffect(() => {
    const onPopState = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const parsed = readDevRoute(search);
    const seed = new URLSearchParams(search).get("seed");
    if (typeof parsed !== "string" && seed && seed !== parsed.seed) {
      window.history.replaceState({}, "", devUrl(parsed.seed, parsed.page));
    }
  }, [search]);

  function navigate(seed: DevSeed, page: Page) {
    const url = devUrl(seed, page);
    window.history.pushState({}, "", url);
    setSearch(url.search);
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-6 p-4 text-base text-foreground sm:p-8 print:max-w-none print:p-0">
      <header className="screen-only space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">纸上游乐场 · 失落森林</h1>
        <p className="rounded-lg border border-border bg-secondary p-4 text-secondary-foreground">
          甲-0 开发样例：仅用于角色交互和打印排版，尚未验证唯一解。正式谜题与验题待后续接入。
        </p>
        <p className="text-sm text-muted-foreground">两人通过现有通话交流，本页没有实时房间或同步进度。样例编号切换复用同一布局，刷新会重置本端路径。</p>
      </header>
      {typeof route === "string" ? (
        <section className="screen-only space-y-4">
          <p role="alert">链接无效：{route}</p>
          <Button onClick={() => navigate(DEV_SEEDS[0], "setup")}>打开开发样例入口</Button>
        </section>
      ) : (
        <DevSession key={route.seed} route={route} navigate={navigate} />
      )}
    </main>
  );
}
