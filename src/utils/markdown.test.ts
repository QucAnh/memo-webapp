// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderSafeMarkdown, toggleTaskAtIndex } from "./markdown";

describe("renderSafeMarkdown", () => {
  it("returns empty string for blank input", () => {
    expect(renderSafeMarkdown("")).toBe("");
    expect(renderSafeMarkdown("   \n\t  ")).toBe("");
  });

  it("renders standard GFM headings, emphasis, code, and tables", () => {
    const html = renderSafeMarkdown("# Heading\n\n**bold** and `code`");
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
  });

  it("strips script tags and inline event handlers (XSS protection)", () => {
    const payload =
      'Hello <script>alert("xss")</script><img src="x" onerror="alert(1)" />';
    const html = renderSafeMarkdown(payload);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(");
    expect(html).toContain("Hello");
  });

  it("neutralizes javascript: URIs in Markdown links", () => {
    const html = renderSafeMarkdown("[click me](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("click me");
  });

  it("keeps task checkboxes disabled by default and enables them when interactiveTasks is true", () => {
    const md = "- [ ] First\n- [x] Second";

    const readOnly = renderSafeMarkdown(md);
    expect(readOnly).toContain('type="checkbox"');
    expect(readOnly).toContain("disabled");

    const interactive = renderSafeMarkdown(md, { interactiveTasks: true });
    expect(interactive).toContain('type="checkbox"');
    expect(interactive).not.toContain("disabled");
  });
});

describe("toggleTaskAtIndex", () => {
  it("toggles unchecked to checked and checked to unchecked by 0-based index", () => {
    const md = "- [ ] Task A\n- [x] Task B\n- [ ] Task C";

    expect(toggleTaskAtIndex(md, 0, true)).toBe(
      "- [x] Task A\n- [x] Task B\n- [ ] Task C",
    );
    expect(toggleTaskAtIndex(md, 1, false)).toBe(
      "- [ ] Task A\n- [ ] Task B\n- [ ] Task C",
    );
  });

  it("skips task-like lines inside fenced code blocks", () => {
    const md = [
      "- [ ] Real task 0",
      "```markdown",
      "- [ ] Fake task inside code block",
      "```",
      "- [ ] Real task 1",
    ].join("\n");

    const updated = toggleTaskAtIndex(md, 1, true);
    expect(updated).toBe(
      [
        "- [ ] Real task 0",
        "```markdown",
        "- [ ] Fake task inside code block",
        "```",
        "- [x] Real task 1",
      ].join("\n"),
    );
  });

  it("returns original markdown when index is out of range", () => {
    const md = "- [ ] Only task";
    expect(toggleTaskAtIndex(md, -1, true)).toBe(md);
    expect(toggleTaskAtIndex(md, 5, true)).toBe(md);
  });
});
