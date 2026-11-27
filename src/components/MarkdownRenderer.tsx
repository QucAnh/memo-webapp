import React, { useMemo, useRef } from "react";
import { renderSafeMarkdown } from "../utils/markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onToggleTask?: (taskIndex: number, completed: boolean) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
  onToggleTask,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { htmlContent, parseError } = useMemo(() => {
    if (!content || !content.trim()) {
      return { htmlContent: "", parseError: false };
    }

    try {
      const sanitized = renderSafeMarkdown(content, {
        interactiveTasks: Boolean(onToggleTask),
      });
      return { htmlContent: sanitized, parseError: false };
    } catch (e) {
      console.error("Markdown parse error:", e);
      return { htmlContent: "", parseError: true };
    }
  }, [content, onToggleTask]);

  const handleChange = (e: React.ChangeEvent<HTMLDivElement>) => {
    if (!onToggleTask || !containerRef.current) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    const checkboxes = Array.from(
      containerRef.current.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      ),
    );
    const index = checkboxes.indexOf(target);
    if (index !== -1) {
      onToggleTask(index, target.checked);
    }
  };

  if (parseError) {
    return (
      <pre className="text-red-500 font-mono text-sm whitespace-pre-wrap">
        {content}
      </pre>
    );
  }

  if (!htmlContent) {
    return (
      <div
        className={`markdown-preview prose prose-neutral max-w-none ${className}`}
      >
        <p className="text-neutral-400 italic">
          No content yet. Write something in the editor on the left.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onChange={handleChange}
      className={`markdown-preview prose prose-neutral max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
