"use client";

import { useState } from "react";

interface HelpTooltipProps {
  title: string;
  steps: string[];
  exampleKey: string;
  linkText: string;
  linkUrl: string;
}

export default function HelpTooltip({ title, steps, exampleKey, linkText, linkUrl }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent-light)] border border-[var(--accent-border)] text-[var(--accent)] text-xs font-bold hover:bg-[var(--accent)] hover:text-white transition-all ml-1.5 cursor-pointer"
        aria-label={`Help for ${title}`}
      >
        ?
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Tooltip */}
          <div className="absolute left-0 top-7 z-50 w-80 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4 shadow-2xl fade-in">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">{title}</h4>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span className="text-[var(--text-secondary)] leading-5">{step}</span>
                </div>
              ))}
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-lg p-2.5 mb-3">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Example key format</div>
              <code className="text-xs text-[var(--warning)] break-all">{exampleKey}</code>
            </div>

            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
            >
              {linkText}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </>
      )}
    </span>
  );
}
