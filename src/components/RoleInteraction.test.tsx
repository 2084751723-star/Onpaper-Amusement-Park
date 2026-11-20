// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameSetup } from "./GameSetup";
import { PuzzleMap } from "./PuzzleMap";
import { RolePanel } from "./RolePanel";
import { PrintPages } from "./PrintPages";
import { getDevSample, DEV_ANSWER } from "../game/devSample";
import { generatePuzzle, getRoleView } from "../game/engine";
import { solvePuzzle } from "../game/solve";
import type { GameSetupProps, RolePanelProps } from "../game/types";

const { mapView, clueView } = getDevSample("D00001");
const setupProps: GameSetupProps = {
  puzzleId: mapView.puzzleId,
  roleLinks: {
    a: "http://localhost/?v=1&seed=D00001&role=a",
    b: "http://localhost/?v=1&seed=D00001&role=b",
  },
  onNewGame: vi.fn(),
  onSelectRole: vi.fn(),
  onPrint: vi.fn(),
};

function cell(row: number, col: number) {
  return screen.getByRole("button", { name: new RegExp(`第 ${row} 行，第 ${col} 列`) });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("乙-1：角色入口与分享", () => {
  it.each(["a", "b"] as const)("复制 %s 的完整链接后才报告成功", async (role) => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<GameSetup {...setupProps} />);

    await user.click(screen.getByRole("button", { name: `复制 ${role.toUpperCase()} 链接` }));

    expect(write).toHaveBeenCalledWith(setupProps.roleLinks[role]);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(`${role.toUpperCase()} 链接已复制`));
  });

  it("复制被拒绝时选择相应只读链接，给出手动复制提示", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<GameSetup {...setupProps} />);

    await user.click(screen.getByRole("button", { name: "复制 B 链接" }));

    const input = screen.getByRole("textbox", { name: "B 解读员 URL" }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    expect(screen.getByRole("status").textContent).toContain("请手动复制");
    expect(screen.getByRole("status").textContent).not.toContain("已复制");
  });

  it("浏览器不提供剪贴板时仍可手动复制", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue(undefined as unknown as Clipboard);
    render(<GameSetup {...setupProps} />);
    await user.click(screen.getByRole("button", { name: "复制 A 链接" }));
    expect(screen.getByRole("status").textContent).toContain("请手动复制");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "A 探路员 URL" }));
  });

  it("复制未完成时不假报成功，也不重复发起复制", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    render(<GameSetup {...setupProps} />);
    await user.click(screen.getByRole("button", { name: "复制 A 链接" }));
    expect(screen.getByRole("status").textContent).toContain("正在复制");
    await user.click(screen.getByRole("button", { name: "复制 B 链接" }));
    expect(write).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("A 链接已复制"));
  });

  it("链接变更后不保留旧题复制成功提示", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const { rerender } = render(<GameSetup {...setupProps} />);
    await user.click(screen.getByRole("button", { name: "复制 A 链接" }));
    const next = { ...setupProps, roleLinks: { a: setupProps.roleLinks.a.replace("D00001", "D00002"), b: setupProps.roleLinks.b.replace("D00001", "D00002") } };
    rerender(<GameSetup {...next} />);
    expect(screen.queryByText(/链接已复制/)).toBeNull();
  });

  it("角色、切换题目和打印操作只调用冻结的回调", async () => {
    const user = userEvent.setup();
    render(<GameSetup {...setupProps} />);
    await user.click(screen.getByRole("button", { name: "我是 A 探路员" }));
    await user.click(screen.getByRole("button", { name: "我是 B 解读员" }));
    await user.click(screen.getByRole("button", { name: "切换题目" }));
    await user.click(screen.getByRole("button", { name: "打印预览" }));
    expect(setupProps.onSelectRole).toHaveBeenNthCalledWith(1, "a");
    expect(setupProps.onSelectRole).toHaveBeenNthCalledWith(2, "b");
    expect(setupProps.onNewGame).toHaveBeenCalledTimes(1);
    expect(setupProps.onPrint).toHaveBeenCalledTimes(1);
  });
});

describe("乙-2：符号和正式文案", () => {
  it("四个符号保留文字，装饰图形不增加辅助技术噪音", () => {
    const { container } = render(<PuzzleMap view={mapView} path={[]} onSelectCell={vi.fn()} />);
    for (const symbol of ["树叶", "月亮", "星星", "蘑菇"]) {
      expect(screen.getAllByRole("button", { name: new RegExp(symbol) }).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    for (const icon of container.querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("focusable")).toBe("false");
    }
  });

  it("打印文案不再声称样例，答案仍须明确传入才挂载", () => {
    const { container, rerender } = render(<PrintPages mapView={mapView} clueView={clueView} />);
    expect(container.textContent).not.toMatch(/开发样例|仅供排版|未通过正式求解验证/);
    expect(container.querySelectorAll("[data-print-role]")).toHaveLength(2);
    expect(container.querySelector('[data-print-role="answer"]')).toBeNull();
    rerender(<PrintPages mapView={mapView} clueView={clueView} answer={DEV_ANSWER} />);
    expect(screen.getByRole("heading", { name: "本题答案" })).toBeDefined();
    expect(container.querySelectorAll("[data-print-role]")).toHaveLength(3);
    expect(container.querySelector('[data-print-role="answer"]')?.textContent).toContain("完成挑战后核对");
  });
});

describe("乙-3：独立纸面角色与答案", () => {
  it.each(["000000", "ABCDEF"])("%s 默认仅有完整 A/B 纸面信息，不泄露答案", (seed) => {
    const puzzle = generatePuzzle({ version: "1", seed });
    const map = getRoleView(puzzle, "a");
    const clues = getRoleView(puzzle, "b");
    const { container } = render(<PrintPages mapView={map} clueView={clues} />);
    const a = screen.getByRole("article", { name: "A 探路员打印页" });
    const b = screen.getByRole("article", { name: "B 解读员打印页" });
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(a.textContent).toContain("不能穿越障碍，也不能重复经过格子");
    expect(a.textContent).toContain(map.puzzleId);
    expect(a.querySelectorAll("td")).toHaveLength(25);
    expect(a.querySelectorAll("ol, .map-cell-selected")).toHaveLength(0);
    expect(b.textContent).toContain(clues.puzzleId);
    expect(within(b).getAllByRole("listitem")).toHaveLength(clues.stepCount);
    expect(b.querySelectorAll("table, [aria-pressed], [role=status]")).toHaveLength(0);
    expect(container.querySelectorAll("button, input")).toHaveLength(0);
    expect(screen.getByText(/打印设置：A4/).classList.contains("screen-only")).toBe(true);
    expect(container.querySelectorAll(".print-footer")).toHaveLength(2);
  });

  it.each(["000000", "ABCDEF"])("%s 显式答案保留完整坐标顺序，移除后不残留答案", (seed) => {
    const puzzle = generatePuzzle({ version: "1", seed });
    const map = getRoleView(puzzle, "a");
    const clues = getRoleView(puzzle, "b");
    const answer = solvePuzzle(puzzle, 2)[0];
    const { container, rerender } = render(<PrintPages mapView={map} clueView={clues} answer={answer} />);
    const page = screen.getByRole("article", { name: "本题答案打印页" });
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(page.querySelectorAll(".map-cell-selected")).toHaveLength(map.stepCount + 1);
    expect(within(page).getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      answer.map((coord) => `第 ${coord.row + 1} 行，第 ${coord.col + 1} 列`),
    );
    expect(page.textContent).toContain("双线框标出完整路径，起点为序号 1");
    rerender(<PrintPages mapView={map} clueView={clues} />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(container.querySelectorAll(".print-coordinates, .map-cell-selected")).toHaveLength(0);
    expect(screen.queryByRole("article", { name: "本题答案打印页" })).toBeNull();
  });
});

describe("乙-1：地图键盘与投影", () => {
  it("方向键只移动焦点，Enter/空格提交零基坐标", async () => {
    const user = userEvent.setup();
    const onSelectCell = vi.fn();
    render(<PuzzleMap view={mapView} path={[mapView.start]} onSelectCell={onSelectCell} />);
    cell(3, 1).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(cell(3, 2));
    expect(onSelectCell).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSelectCell).toHaveBeenLastCalledWith({ row: 2, col: 1 });
    await user.keyboard("{ArrowUp} ");
    expect(document.activeElement).toBe(cell(2, 2));
    expect(onSelectCell).toHaveBeenLastCalledWith({ row: 1, col: 1 });
  });

  it("键盘跳过障碍且地图边缘不环绕，不会自动添加路径", async () => {
    const user = userEvent.setup();
    const onSelectCell = vi.fn();
    render(<PuzzleMap view={mapView} path={[mapView.start]} onSelectCell={onSelectCell} />);
    cell(3, 2).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(cell(3, 4));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(cell(3, 5));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(cell(3, 4));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell(4, 4));
    expect(onSelectCell).not.toHaveBeenCalled();
  });

  it("障碍不可选，起点、当前落点和步序不只用颜色表达", async () => {
    const user = userEvent.setup();
    const onSelectCell = vi.fn();
    render(<PuzzleMap view={mapView} path={DEV_ANSWER.slice(0, 3)} onSelectCell={onSelectCell} />);
    expect((cell(3, 3) as HTMLButtonElement).disabled).toBe(true);
    await user.click(cell(3, 3));
    expect(onSelectCell).not.toHaveBeenCalled();
    expect(cell(3, 1).getAttribute("aria-label")).toContain("起点");
    expect(cell(2, 2).getAttribute("aria-current")).toBe("step");
    expect(cell(2, 2).textContent).toContain("当前");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(3);
    expect(screen.queryByText(/宝藏|终点/)).toBeNull();
  });

  it("打印与只读地图无按钮和键盘操作提示", () => {
    const { container, rerender } = render(<PuzzleMap view={mapView} path={[]} printMode onSelectCell={vi.fn()} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/方向键移动焦点/)).toBeNull();
    expect(container.querySelectorAll("td")).toHaveLength(25);
    expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
    rerender(<PuzzleMap view={mapView} path={[]} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("乙-1：角色信息与提交状态", () => {
  it("B 只按原顺序显示符号和方向，不挂载 A 地图、状态或路径", () => {
    const { container } = render(<RolePanel role="b" view={clueView} />);
    const clues = screen.getAllByRole("listitem");
    expect(clues.map((item) => item.textContent)).toEqual([
      expect.stringContaining("树叶"), expect.stringContaining("月亮"),
      expect.stringContaining("星星"), expect.stringContaining("蘑菇"),
      expect.stringContaining("树叶"), expect.stringContaining("月亮"),
    ]);
    expect(clues[0].textContent).toContain("禁止向南（下）");
    expect(clues[5].textContent).toContain("禁止向东（右）");
    expect(container.querySelectorAll("table, button, [role='status'], [aria-pressed], [data-print-role='answer']")).toHaveLength(0);
  });

  it.each(["idle", "demo", "error", "success"] as const)("A 的 %s 状态忠实显示父组件结果，不自行验题", (status) => {
    const props: RolePanelProps = {
      role: "a", view: mapView, path: DEV_ANSWER,
      onSelectCell: vi.fn(), onUndo: vi.fn(), onClear: vi.fn(), onSubmit: vi.fn(),
      submission: { status, message: status === "idle" ? "" : `上层给出的${status}结果` },
    };
    const { container } = render(<RolePanel {...props} />);
    expect(screen.getByRole("status").textContent).toBe(props.submission.message);
    expect(container.querySelector("ol")).toBeNull();
    expect(screen.queryByRole("heading", { name: /线索/ })).toBeNull();
    expect(screen.getByText(/已走 6 步/)).toBeDefined();
  });
});
