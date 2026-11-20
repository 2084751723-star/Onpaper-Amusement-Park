// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

afterEach(cleanup);

const cellName = /第\s*\d+\s*行\s*[，,]\s*第\s*\d+\s*列/;
const samplePath = [
  [2, 0], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3],
] as const;

function cell(row: number, col: number) {
  return screen.getByRole("button", {
    name: new RegExp(`第\\s*${row + 1}\\s*行\\s*[，,]\\s*第\\s*${col + 1}\\s*列`),
  });
}

function selectedCells() {
  return screen.queryAllByRole("button", { name: cellName, pressed: true });
}

function roleLink(role: "a" | "b") {
  const input = screen.getByRole("textbox", {
    name: role === "a" ? /A/ : /B/,
  }) as HTMLInputElement;
  expect(input.readOnly).toBe(true);
  return new URL(input.value, window.location.href);
}

function expectRoleLink(url: URL, role: "a" | "b", seed = "D00001") {
  // 检查完整参数集合，不能把答案、路径或额外状态塞进分享链接。
  expect([...url.searchParams.keys()].sort()).toEqual(["role", "seed", "v"]);
  expect(url.searchParams.get("v")).toBe("1");
  expect(url.searchParams.get("seed")).toBe(seed);
  expect(url.searchParams.get("role")).toBe(role);
  expect(url.hash).toBe("");
}

function expectSampleNotice() {
  // “切换开发样例”按钮和答案勾选框本身不能代替样例说明。
  const notices = screen.queryAllByText(/开发样例/).filter(
    (element) => !element.closest("button, label, [hidden], [aria-hidden='true']"),
  );
  expect(notices.length).toBeGreaterThan(0);
}

function expectNoAnswerContent(container: HTMLElement) {
  // 包括隐藏的打印答案：未授权显示时应完全不挂载，而不只是 CSS 隐藏。
  expect(container.querySelector('[data-print-role="answer"]')).toBeNull();
  expect(screen.queryByRole("heading", { name: /答案/, hidden: true })).toBeNull();
  expect(screen.queryByText(/^\s*(?:参考答案|标准答案|答案路径)/)).toBeNull();
}

async function choosePath(
  user: ReturnType<typeof userEvent.setup>,
  path: readonly (readonly [number, number])[],
) {
  for (const [row, col] of path) {
    const target = cell(row, col);
    // 兼容起点预选和手动点选；其余路径格都必须由交互选中。
    if (row === 2 && col === 0 && target.getAttribute("aria-pressed") === "true") continue;
    await user.click(target);
  }
}

function expectInvalidLink(container: HTMLElement) {
  expect(screen.getByRole("alert").textContent?.trim()).toBeTruthy();
  expect(screen.queryAllByRole("button", { name: cellName })).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "我是 A 探路员" })).toBeNull();
  expect(screen.queryByRole("button", { name: "我是 B 解读员" })).toBeNull();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  expect(container.querySelectorAll("article[data-print-role]")).toHaveLength(0);
}

describe("甲-0 App：开发样例与角色隔离", () => {
  it("无 query 是入口，A/B 只读链接仅包含版本、种子和角色，并能进入对应角色", async () => {
    const user = userEvent.setup();

    for (const role of ["a", "b"] as const) {
      window.history.replaceState({}, "", "/");
      render(<App />);

      expectSampleNotice();
      expectRoleLink(roleLink("a"), "a");
      expectRoleLink(roleLink("b"), "b");
      expect(screen.queryAllByRole("button", { name: cellName })).toHaveLength(0);
      expect(screen.getByRole("button", { name: "切换开发样例" })).toBeDefined();
      expect(screen.getByRole("button", { name: "打印预览" })).toBeDefined();

      await user.click(screen.getByRole("button", {
        name: role === "a" ? "我是 A 探路员" : "我是 B 解读员",
      }));

      expectRoleLink(new URL(window.location.href), role);
      if (role === "a") {
        expect(screen.getAllByRole("button", { name: cellName }).length).toBeGreaterThan(0);
      } else {
        expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
        expect(screen.queryAllByRole("button", { name: cellName })).toHaveLength(0);
      }
      cleanup();
    }
  });

  it("A 角色直达只展示地图，不挂载有序线索或答案", () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const { container } = render(<App />);

    expectSampleNotice();
    expect(screen.getAllByRole("button", { name: cellName }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /起点/ })).toBe(cell(2, 0));
    expect(screen.getAllByRole("button", { name: /障碍/ })).toContain(cell(2, 2));
    expect(screen.queryByRole("list", { name: /线索/, hidden: true })).toBeNull();
    expect(screen.queryByRole("heading", { name: /有序线索|线索顺序|线索卡/, hidden: true })).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
    expectNoAnswerContent(container);
  });

  it("B 角色直达展示线索，没有地图格按钮、提交操作或共享路径进度", () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=b");
    const { container } = render(<App />);

    expectSampleNotice();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: cellName })).toHaveLength(0);
    for (const name of ["提交路径", "撤销", "清空"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/(?:已选|已走|当前路径)\s*[:：]?\s*\d+/)).toBeNull();
    expectNoAnswerContent(container);
  });

  it("相邻点选更新 aria-pressed，撤销末格，清空移除所有已走路径格", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    render(<App />);

    await choosePath(user, samplePath.slice(0, 3));
    expect(selectedCells()).toHaveLength(3);
    expect(cell(2, 1).getAttribute("aria-pressed")).toBe("true");
    expect(cell(1, 1).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(selectedCells()).toHaveLength(2);
    expect(cell(1, 1).getAttribute("aria-pressed")).toBe("false");
    expect(cell(2, 1).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "清空" }));
    expect(cell(2, 1).getAttribute("aria-pressed")).toBe("false");
    // 起点可以保持预选，但清空后不能保留任何已走格。
    expect(selectedCells().filter((element) => element !== cell(2, 0))).toHaveLength(0);
  });

  it("非相邻、障碍及重访点击不能增加或破坏已有选择", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    render(<App />);

    await choosePath(user, samplePath.slice(0, 1));
    expect(selectedCells()).toHaveLength(1);
    await user.click(cell(3, 3));
    expect(selectedCells()).toHaveLength(1);
    expect(cell(3, 3).getAttribute("aria-pressed")).toBe("false");

    await user.click(cell(2, 1));
    expect(selectedCells()).toHaveLength(2);
    await user.click(cell(2, 2));
    expect(selectedCells()).toHaveLength(2);
    expect(cell(2, 2).getAttribute("aria-pressed")).not.toBe("true");

    await user.click(cell(2, 0));
    expect(selectedCells()).toHaveLength(2);
    expect(cell(2, 0).getAttribute("aria-pressed")).toBe("true");
    expect(cell(2, 1).getAttribute("aria-pressed")).toBe("true");
  });

  it.each([
    { name: "未延伸路径", path: [] },
    { name: "不足六步的路径", path: samplePath.slice(0, 2) },
    { name: "完整六步开发样例路径", path: samplePath },
  ])("提交 $name 也只能提示正式验题待接入，不能报成功", async ({ path }) => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    const { container } = render(<App />);

    await choosePath(user, path);
    if (path.length > 0) expect(selectedCells()).toHaveLength(path.length);
    await user.click(screen.getByRole("button", { name: "提交路径" }));

    expect(screen.getByRole("status").textContent).toContain("正式验题待接入");
    expect(container.textContent).not.toMatch(/success|验题成功|验证成功|恭喜|已通关/i);
    expectNoAnswerContent(container);
  });

  it("打印默认只挂载 A/B 两页，答案勾选才挂载第三页，取消后卸载并能返回入口", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&mode=print");
    const user = userEvent.setup();
    const { container } = render(<App />);
    const checkbox = screen.getByRole("checkbox", { name: "附上开发样例答案" }) as HTMLInputElement;
    const printRoles = () => Array.from(container.querySelectorAll("article"),
      (article) => article.getAttribute("data-print-role"));

    expectSampleNotice();
    expect(checkbox.checked).toBe(false);
    expect(printRoles()).toEqual(["a", "b"]);
    expectNoAnswerContent(container);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(printRoles()).toEqual(["a", "b", "answer"]);
    expect(container.querySelector('article[data-print-role="answer"]')?.textContent?.trim()).toBeTruthy();

    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(printRoles()).toEqual(["a", "b"]);
    expectNoAnswerContent(container);

    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    expect(screen.getByRole("button", { name: "我是 A 探路员" })).toBeDefined();
    expectRoleLink(roleLink("a"), "a");
    expectRoleLink(roleLink("b"), "b");
    expect(container.querySelectorAll("article[data-print-role]")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "打印预览" }));
    expect(new URL(window.location.href).searchParams.get("mode")).toBe("print");
    expect(new URL(window.location.href).searchParams.get("seed")).toBe("D00001");
    expect(printRoles()).toEqual(["a", "b"]);
  });

  it("勾选打印答案后直接退出，再进打印预览默认不勾选且不挂载答案", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&mode=print");
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("checkbox", { name: "附上开发样例答案" }));
    expect(container.querySelector('article[data-print-role="answer"]')).not.toBeNull();

    // 不先取消勾选，验证退出本身会重置答案授权。
    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    expectNoAnswerContent(container);
    await user.click(screen.getByRole("button", { name: "打印预览" }));

    const checkbox = screen.getByRole("checkbox", { name: "附上开发样例答案" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(Array.from(container.querySelectorAll("article[data-print-role]"),
      (article) => article.getAttribute("data-print-role"))).toEqual(["a", "b"]);
    expectNoAnswerContent(container);
  });

  it("A 选路后打印往返仍保留本端路径", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    const { container } = render(<App />);

    await choosePath(user, samplePath.slice(0, 3));
    expect(selectedCells()).toHaveLength(3);
    const selectedBefore = selectedCells().map((element) => element.getAttribute("aria-label"));
    await user.click(screen.getByRole("button", { name: "打印预览" }));
    expect(container.querySelectorAll("article[data-print-role]")).toHaveLength(2);
    expectNoAnswerContent(container);

    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    await user.click(screen.getByRole("button", { name: "我是 A 探路员" }));

    expectRoleLink(new URL(window.location.href), "a");
    expect(selectedCells().map((element) => element.getAttribute("aria-label"))).toEqual(selectedBefore);
    expect(container.querySelectorAll("article[data-print-role]")).toHaveLength(0);
    expectNoAnswerContent(container);
  });

  it("A 提交后切到 B 不挂载地图、路径或提交状态，返回 A 保留本端路径", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    const { container } = render(<App />);

    await choosePath(user, samplePath.slice(0, 3));
    expect(selectedCells()).toHaveLength(3);
    const selectedBefore = selectedCells().map((element) => element.getAttribute("aria-label"));
    await user.click(screen.getByRole("button", { name: "提交路径" }));
    expect(screen.getByRole("status").textContent).toContain("正式验题待接入");
    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    await user.click(screen.getByRole("button", { name: "我是 B 解读员" }));

    expectRoleLink(new URL(window.location.href), "b");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("table, [aria-pressed]")).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: cellName, hidden: true })).toHaveLength(0);
    for (const name of ["提交路径", "撤销", "清空"]) {
      expect(screen.queryByRole("button", { name, hidden: true })).toBeNull();
    }
    expect(screen.queryByRole("status", { hidden: true })).toBeNull();
    expect(screen.queryByRole("progressbar", { hidden: true })).toBeNull();
    expect(screen.queryByText(/(?:已选|已走|当前路径)\s*[:：]?\s*\d+/)).toBeNull();
    expect(screen.queryByText(/路径\s*\d+/)).toBeNull();
    expect(screen.queryByText(/正式验题待接入/)).toBeNull();
    expectNoAnswerContent(container);

    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    await user.click(screen.getByRole("button", { name: "我是 A 探路员" }));
    expectRoleLink(new URL(window.location.href), "a");
    expect(selectedCells().map((element) => element.getAttribute("aria-label"))).toEqual(selectedBefore);
    expect(container.querySelector("ol")).toBeNull();
    expectNoAnswerContent(container);
  });

  it("popstate 后退和前进会切换入口与 A/B 页面，同一样例的 A 路径仍保留", async () => {
    window.history.replaceState({}, "", "/?v=1&seed=D00001&role=a");
    const user = userEvent.setup();
    const { container } = render(<App />);
    const aUrl = window.location.href;

    await choosePath(user, samplePath.slice(0, 3));
    expect(selectedCells()).toHaveLength(3);
    const selectedBefore = selectedCells().map((element) => element.getAttribute("aria-label"));
    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    const setupUrl = window.location.href;
    await user.click(screen.getByRole("button", { name: "我是 B 解读员" }));
    const bUrl = window.location.href;

    // 同步重放浏览器历史落点，不依赖 jsdom 异步 history.back/forward。
    function popTo(url: string) {
      act(() => {
        window.history.replaceState({}, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    }

    popTo(setupUrl);
    expect(screen.getByRole("button", { name: "我是 A 探路员" })).toBeDefined();
    expect(container.querySelectorAll("table, ol, [role='status']")).toHaveLength(0);
    popTo(aUrl);
    expect(screen.getByRole("heading", { name: "A 探路员" })).toBeDefined();
    expect(selectedCells().map((element) => element.getAttribute("aria-label"))).toEqual(selectedBefore);
    expect(container.querySelector("ol")).toBeNull();

    popTo(setupUrl);
    expectRoleLink(roleLink("a"), "a");
    expectRoleLink(roleLink("b"), "b");
    expect(container.querySelectorAll("table, ol, [role='status']")).toHaveLength(0);
    popTo(bUrl);
    expect(screen.getByRole("heading", { name: "B 解读员" })).toBeDefined();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("table, [aria-pressed], [role='status']")).toHaveLength(0);
    expect(screen.queryByText(/(?:已选|已走|当前路径)\s*[:：]?\s*\d+/)).toBeNull();
    expectNoAnswerContent(container);
  });

  it.each([
    { name: "未知版本", query: "v=99&seed=D00001&role=a" },
    { name: "非法种子", query: "v=1&seed=not-a-seed&role=a" },
    { name: "非法角色", query: "v=1&seed=D00001&role=c" },
    { name: "重复 seed", query: "v=1&seed=D00001&seed=D00001&role=a" },
    { name: "未知 query", query: "v=1&seed=D00001&role=a&unknown=1" },
    { name: "role 与 mode 冲突", query: "v=1&seed=D00001&role=a&mode=print" },
    { name: "缺少 v", query: "seed=D00001&role=a" },
    { name: "缺少 seed", query: "v=1&role=a" },
    { name: "六位合法但非开发样例的种子", query: "v=1&seed=ABCDEF&role=a" },
  ])("$name 显示 alert，不静默替换为默认开发样例", ({ query }) => {
    window.history.replaceState({}, "", `/?${query}`);
    const { container } = render(<App />);
    expectInvalidLink(container);
  });

  it("小写种子正常加载，并将显示题号规范化为 D00001", () => {
    window.history.replaceState({}, "", "/?v=1&seed=d00001&role=a");
    render(<App />);

    expect(screen.queryByRole("alert")).toBeNull();
    expectSampleNotice();
    expect(screen.getAllByText(/D00001/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/d00001/)).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: cellName }).length).toBeGreaterThan(0);
  });

  it("A 选路并提交后换 D00002 更新题号及链接，路径重置为起点且状态清空", async () => {
    window.history.replaceState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    expectRoleLink(roleLink("a"), "a", "D00001");
    expect(screen.getAllByText(/D00001/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "我是 A 探路员" }));
    await choosePath(user, samplePath.slice(0, 3));
    expect(selectedCells()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "提交路径" }));
    expect(screen.getByRole("status").textContent).toContain("正式验题待接入");
    await user.click(screen.getByRole("button", { name: "返回角色入口" }));
    await user.click(screen.getByRole("button", { name: "切换开发样例" }));

    expectRoleLink(roleLink("a"), "a", "D00002");
    expectRoleLink(roleLink("b"), "b", "D00002");
    expect(screen.getAllByText(/D00002/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/D00001/)).toHaveLength(0);
    expectSampleNotice();
    expect(screen.queryByText(/已生成正式题|正式题目生成成功/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "我是 A 探路员" }));
    expectRoleLink(new URL(window.location.href), "a", "D00002");
    expect(selectedCells()).toEqual([cell(2, 0)]);
    expect(screen.getByRole("status").textContent?.trim()).toBe("");
    expect(screen.queryByText(/正式验题待接入/)).toBeNull();
  });
});
