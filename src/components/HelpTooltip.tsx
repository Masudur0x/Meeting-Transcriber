"use client";

import { useState, useRef, useEffect } from "react";

interface HelpTooltipProps {
  title: string;
  steps: string[];
  exampleKey: string;
  linkText: string;
  linkUrl: string;
}

export default function HelpTooltip({ title, steps, exampleKey, linkText, linkUrl }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block ml-1.5" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-4 h-4 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--accent)] flex items-center justify-center text-[10px] font-bold transition-colors"
      >
        ?
      </button>

      {open && (
        <div className="absolute z-50 left-6 top-0 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-xl">
          <h4 className="font-semibold text-sm mb-2">{title}</h4>
          <ol className="text-xs text-[var(--text-secondary)] space-y-1.5 list-decimal list-inside mb-3">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className="text-xs text-[var(--text-muted)] mb-3">
            <span className="font-medium">Example:</span>{" "}
            <code className="bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[10px]">
              {exampleKey}
            </code>
          </div>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline font-medium"
          >
            {linkText} &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
