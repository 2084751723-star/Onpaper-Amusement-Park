import type { PrintPagesProps } from "../game/types";
import { PuzzleMap } from "./PuzzleMap";
import { RolePanel } from "./RolePanel";
import "../print.css";

export function PrintPages({ mapView, clueView, answer }: PrintPagesProps) {
  return (
    <div className="print-pages">
      <p className="screen-only print-settings">打印设置：A4、纵向、单面、缩放 100%，关闭页眉和页脚；无需开启背景图形。默认两页，附上答案时三页。</p>
      <article className="print-page" data-print-role="a" aria-label="A 探路员打印页">
        <h2 className="text-xl font-semibold">A 探路员 · 地图</h2>
        <p>失落森林 · 双人协作解谜，请只查看自己的角色页</p>
        <p>题号：{mapView.puzzleId} · 共 {mapView.stepCount} 步（不含起点）</p>
        <p className="print-instructions">从“起点”出发，听 B 逐条读线索，用铅笔连出完整路径。每步只走上、下、左、右相邻一格；不能穿越障碍，也不能重复经过格子。走满指定步数后核对答案。</p>
        <PuzzleMap view={mapView} path={[]} printMode />
        <footer className="print-footer">纸上游乐场 · A 地图页 · 请交给探路员，不要展示给 B</footer>
      </article>
      <article className="print-page" data-print-role="b" aria-label="B 解读员打印页">
        <p>失落森林 · 双人协作解谜，请只查看自己的角色页</p>
        <RolePanel role="b" view={clueView} />
        <footer className="print-footer">纸上游乐场 · B 线索页 · 请交给解读员，不要展示给 A</footer>
      </article>
      {answer !== undefined && (
        <article className="print-page" data-print-role="answer" aria-label="本题答案打印页">
          <h2 className="text-xl font-semibold">本题答案</h2>
          <p>请在完成挑战后核对；路径序号含起点。双线框标出完整路径，起点为序号 1。</p>
          <p>题号：{mapView.puzzleId}</p>
          <PuzzleMap view={mapView} path={answer} printMode />
          <h3 className="text-lg font-medium">路径坐标（含起点，行、列从 1 开始）</h3>
          <ol className="print-coordinates list-decimal pl-6">
            {answer.map((coord, index) => (
              <li key={index}>第 {coord.row + 1} 行，第 {coord.col + 1} 列</li>
            ))}
          </ol>
          <footer className="print-footer">纸上游乐场 · 答案页 · 完成挑战后再打开</footer>
        </article>
      )}
    </div>
  );
}
