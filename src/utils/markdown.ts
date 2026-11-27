import { Marked } from "marked";
import DOMPurify from "dompurify";

const markedInstance = new Marked({
  gfm: true,
  breaks: true,
});

export interface RenderMarkdownOptions {
  /** When true, task list checkboxes are enabled so users can toggle them in preview. */
  interactiveTasks?: boolean;
}

/**
 * Parse GitHub-Flavored Markdown and sanitize the resulting HTML with DOMPurify
 * so untrusted HTML, scripts, event handlers, and javascript: URIs cannot execute.
 */
export function renderSafeMarkdown(
  content: string,
  options: RenderMarkdownOptions = {},
): string {
  if (!content || !content.trim()) {
    return "";
  }

  const parsed = markedInstance.parse(content);
  const rawHtml = typeof parsed === "string" ? parsed : "";

  const sanitized = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
  });

  if (!options.interactiveTasks) {
    return sanitized;
  }

  // marked renders GFM task checkboxes with the `disabled` attribute.
  // Enable them only when the caller wires up an onToggleTask handler.
  return sanitized.replace(/<input\b[^>]*>/gi, (tag) => {
    if (!/\btype=["']checkbox["']/i.test(tag)) {
      return tag;
    }
    return tag.replace(/\s+\bdisabled(?:=(?:""|''|"disabled"|'disabled'))?/gi, "");
  });
}

const TASK_ITEM_REGEX = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](\s.*)$/;
const FENCE_REGEX = /^\s*(`{3,}|~{3,})/;

/**
 * Toggle the Nth (0-based) GFM task list checkbox in raw Markdown source,
 * skipping any checkbox-like lines inside fenced code blocks.
 */
export function toggleTaskAtIndex(
  markdown: string,
  taskIndex: number,
  completed: boolean,
): string {
  if (taskIndex < 0) return markdown;

  const lines = markdown.split("\n");
  let currentTaskIndex = 0;
  let activeFence: { char: string; length: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(FENCE_REGEX);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      const char = marker[0];
      if (!activeFence) {
        activeFence = { char, length: marker.length };
      } else if (
        activeFence.char === char &&
        marker.length >= activeFence.length &&
        line.trim() === marker
      ) {
        activeFence = null;
      }
      continue;
    }

    if (activeFence) {
      continue;
    }

    const taskMatch = line.match(TASK_ITEM_REGEX);
    if (taskMatch) {
      if (currentTaskIndex === taskIndex) {
        const mark = completed ? "x" : " ";
        lines[i] = `${taskMatch[1]}[${mark}]${taskMatch[3]}`;
        return lines.join("\n");
      }
      currentTaskIndex += 1;
    }
  }

  return markdown;
}
