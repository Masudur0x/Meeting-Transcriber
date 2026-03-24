"use client";

import { useState } from "react";
import type { CrmPlatform } from "@/lib/storage";

interface CrmCredentials {
  googleSheetsId: string;
  googleGeminiKey: string;
  hubspotKey: string;
  salesforceToken: string;
  pipedriveKey: string;
  airtableKey: string;
  airtableBaseId: string;
}

interface MeetingResultProps {
  transcript: string;
  summary: string;
  duration: string;
  youSpoke: string;
  otherSpoke: string;
  crmPlatform: CrmPlatform;
  crmCredentials: CrmCredentials;
  onClose: () => void;
}

const CRM_NAMES: Record<CrmPlatform, string> = {
  google_sheets: "Google Sheets",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  pipedrive: "Pipedrive",
  airtable: "Airtable",
  none: "",
};

export default function MeetingResult({
  transcript,
  summary,
  duration,
  youSpoke,
  otherSpoke,
  crmPlatform,
  crmCredentials,
  onClose,
}: MeetingResultProps) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadAsText = () => {
    const content = `Meeting Date: ${new Date().toLocaleDateString()}
Duration: ${duration}
You Spoke: ${youSpoke}
Other Spoke: ${otherSpoke}

${"=".repeat(60)}
SUMMARY
${"=".repeat(60)}

${summary}

${"=".repeat(60)}
FULL TRANSCRIPT
${"=".repeat(60)}

${transcript}`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToCrm = async () => {
    if (crmPlatform === "none") return;

    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");

    try {
      const res = await fetch("/api/save-to-crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: crmPlatform,
          date: new Date().toISOString().split("T")[0],
          duration,
          youSpoke,
          otherSpoke,
          transcript,
          summary,
          ...crmCredentials,
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
      } else {
        const data = await res.json();
        setSaveStatus("error");
        setSaveError(data.error || "Failed to save");
      }
    } catch {
      setSaveStatus("error");
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-6 pb-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--success-light)] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Meeting Complete</h2>
                <p className="text-xs text-[var(--text-muted)]">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white text-2xl">&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{duration}</div>
              <div className="text-xs text-[var(--text-secondary)]">Duration</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{youSpoke}</div>
              <div className="text-xs text-[var(--text-secondary)]">You spoke</div>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{otherSpoke}</div>
              <div className="text-xs text-[var(--text-secondary)]">Other spoke</div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">AI Summary</h3>
              <button
                onClick={() => copyToClipboard(summary, "summary")}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {copied === "summary" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {summary}
            </div>
          </div>

          {/* Transcript */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Full Transcript</h3>
              <button
                onClick={() => copyToClipboard(transcript, "transcript")}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {copied === "transcript" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono text-xs">
              {transcript}
            </div>
          </div>

          {/* Save Status */}
          {saveStatus === "success" && (
            <div className="bg-[var(--success-light)] border border-[rgba(34,197,94,0.3)] rounded-xl p-3 text-center fade-in">
              <span className="text-sm text-[var(--success)] font-medium">
                Saved to {CRM_NAMES[crmPlatform]} successfully!
              </span>
            </div>
          )}
          {saveStatus === "error" && (
            <div className="bg-[var(--danger-light)] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 fade-in">
              <span className="text-sm text-[var(--danger)] font-medium">Save failed: </span>
              <span className="text-xs text-[var(--text-secondary)]">{saveError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[var(--bg-card)] border-t border-[var(--border)] p-6 pt-4 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={downloadAsText}
              className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>

            {crmPlatform !== "none" && (
              <button
                onClick={saveToCrm}
                disabled={saving || saveStatus === "success"}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  saveStatus === "success"
                    ? "bg-[var(--success)] text-white"
                    : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />
                )}
                {saveStatus === "success" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </>
                ) : saving ? (
                  `Saving to ${CRM_NAMES[crmPlatform]}...`
                ) : (
                  `Save to ${CRM_NAMES[crmPlatform]}`
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
