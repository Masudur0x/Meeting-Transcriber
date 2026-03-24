"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AudioCapture, type CaptureMode } from "@/lib/audio-capture";
import { getApiKeys, getSettings, hasRequiredKeys } from "@/lib/storage";
import Settings from "@/components/Settings";
import MeetingResult from "@/components/MeetingResult";
import AudioSetup from "@/components/AudioSetup";

type AppState = "idle" | "recording" | "processing";
type ProcessingStep =
  | "saving"
  | "transcribing-you"
  | "transcribing-other"
  | "merging"
  | "summarizing"
  | "done";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  speaker: string;
  segments?: TranscriptSegment[];
  text?: string;
}

function mergeTranscripts(
  youResult: TranscriptionResult | null,
  otherResult: TranscriptionResult | null
): string {
  const segments: { start: number; text: string; speaker: string }[] = [];

  if (youResult?.segments) {
    for (const seg of youResult.segments) {
      segments.push({ start: seg.start, text: seg.text.trim(), speaker: "You" });
    }
  } else if (youResult?.text) {
    segments.push({ start: 0, text: youResult.text.trim(), speaker: "You" });
  }

  if (otherResult?.segments) {
    for (const seg of otherResult.segments) {
      segments.push({ start: seg.start, text: seg.text.trim(), speaker: "Other" });
    }
  } else if (otherResult?.text) {
    segments.push({ start: 0, text: otherResult.text.trim(), speaker: "Other" });
  }

  segments.sort((a, b) => a.start - b.start);

  return segments
    .map((seg) => {
      const min = Math.floor(seg.start / 60);
      const sec = Math.floor(seg.start % 60);
      return `[${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}] ${seg.speaker}: ${seg.text}`;
    })
    .join("\n");
}

function detectPlatform(): "mac" | "windows" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "other";
}

const STEPS = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
      </svg>
    ),
    title: "Click Start",
    description: "Hit the Start Recording button before your meeting",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25" />
      </svg>
    ),
    title: "Share Audio",
    description: "Select your meeting tab or use desktop app mode",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    title: "Have Your Meeting",
    description: "Your mic and other audio are captured separately",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: "Get AI Summary",
    description: "Click Stop to get transcript, key points, and action items",
  },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [showSettings, setShowSettings] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [showAudioSetup, setShowAudioSetup] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("saving");
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("tab");
  const [virtualDeviceId, setVirtualDeviceId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"mac" | "windows" | "other">("other");

  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState({
    transcript: "",
    summary: "",
    duration: "",
    youSpoke: "",
    otherSpoke: "",
    crmPlatform: "none" as import("@/lib/storage").CrmPlatform,
    crmCredentials: {
      googleSheetsId: "",
      googleGeminiKey: "",
      hubspotKey: "",
      salesforceToken: "",
      pipedriveKey: "",
      airtableKey: "",
      airtableBaseId: "",
    },
  });

  const captureRef = useRef<AudioCapture | null>(null);

  useEffect(() => {
    const s = getSettings();
    setKeysReady(hasRequiredKeys());
    setOnboarded(s.onboarded);
    setPlatform(detectPlatform());

    // Check for virtual audio device
    AudioCapture.detectVirtualAudioDevice().then((device) => {
      if (device) {
        setVirtualDeviceId(device.deviceId);
      }
    });
  }, []);

  const handleDurationUpdate = useCallback((seconds: number) => {
    setDuration(seconds);
  }, []);

  const openOnboarding = () => {
    setIsOnboarding(true);
    setShowSettings(true);
  };

  const openSettings = () => {
    setIsOnboarding(false);
    setShowSettings(true);
  };

  const handleSettingsSave = () => {
    setKeysReady(hasRequiredKeys());
    setOnboarded(true);
  };

  const startRecording = async (mode: CaptureMode) => {
    if (!keysReady) {
      openOnboarding();
      return;
    }

    // For system-audio mode on Mac, check if virtual driver is installed
    if (mode === "system-audio" && platform === "mac" && !virtualDeviceId) {
      setShowAudioSetup(true);
      return;
    }

    try {
      const capture = new AudioCapture();
      capture.setOnDurationUpdate(handleDurationUpdate);
      captureRef.current = capture;

      await capture.startCapture(
        mode,
        mode === "system-audio" ? virtualDeviceId || undefined : undefined
      );

      setHasSystemAudio(true);
      setCaptureMode(mode);
      setState("recording");
      setDuration(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!captureRef.current) return;

    setState("processing");
    setProcessingStep("saving");

    try {
      const result = await captureRef.current.stopCapture();
      const keys = getApiKeys();

      let youTranscript: TranscriptionResult | null = null;
      if (result.micBlob && result.micBlob.size > 0) {
        setProcessingStep("transcribing-you");
        const micForm = new FormData();
        micForm.append("audio", result.micBlob, "mic.webm");
        micForm.append("apiKey", keys.transcriptionKey);
        micForm.append("speaker", "You");
        micForm.append("provider", keys.transcriptionProvider);
        const micRes = await fetch("/api/transcribe", { method: "POST", body: micForm });
        if (micRes.ok) {
          youTranscript = await micRes.json();
        } else {
          const errData = await micRes.json().catch(() => ({ error: micRes.statusText }));
          throw new Error(`Mic transcription failed: ${errData.error || micRes.statusText}`);
        }
      } else {
        throw new Error(
          `Microphone audio is empty (${result.micBlob?.size || 0} bytes). ` +
          "Check that your browser has microphone permission in macOS: " +
          "System Preferences → Security & Privacy → Privacy → Microphone."
        );
      }

      let otherTranscript: TranscriptionResult | null = null;
      if (result.systemBlob && result.systemBlob.size > 0) {
        setProcessingStep("transcribing-other");
        const sysForm = new FormData();
        sysForm.append("audio", result.systemBlob, "system.webm");
        sysForm.append("apiKey", keys.transcriptionKey);
        sysForm.append("speaker", "Other");
        sysForm.append("provider", keys.transcriptionProvider);
        const sysRes = await fetch("/api/transcribe", { method: "POST", body: sysForm });
        if (sysRes.ok) {
          otherTranscript = await sysRes.json();
        } else {
          const errData = await sysRes.json().catch(() => ({ error: sysRes.statusText }));
          console.warn("Other audio transcription failed:", errData.error);
        }
      }

      setProcessingStep("merging");
      const fullTranscript = mergeTranscripts(youTranscript, otherTranscript);

      if (!fullTranscript.trim()) {
        alert("No speech detected in the recording. The audio was captured but the transcription API returned empty text. Try speaking louder or check your API key.");
        setState("idle");
        return;
      }

      setProcessingStep("summarizing");
      const youSpoke = formatMinutes(result.micDuration);
      const otherSpoke = result.systemBlob ? formatMinutes(result.systemDuration) : "0 min";

      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: fullTranscript,
          apiKey: keys.summarizationKey,
          provider: keys.summarizationProvider,
          youSpoke,
          otherSpoke,
        }),
      });

      let summary = "Summary generation failed.";
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        summary = sumData.summary;
      }

      setProcessingStep("done");
      const settings = getSettings();
      setResultData({
        transcript: fullTranscript,
        summary,
        duration: formatDuration(duration),
        youSpoke,
        otherSpoke,
        crmPlatform: settings.crmPlatform,
        crmCredentials: {
          googleSheetsId: settings.googleSheetsId,
          googleGeminiKey: settings.googleGeminiKey,
          hubspotKey: settings.hubspotKey,
          salesforceToken: settings.salesforceToken,
          pipedriveKey: settings.pipedriveKey,
          airtableKey: settings.airtableKey,
          airtableBaseId: settings.airtableBaseId,
        },
      });
      setShowResult(true);
      setState("idle");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Processing failed");
      setState("idle");
    }
  };

  const handleAudioSetupReady = () => {
    setShowAudioSetup(false);
    // Re-check for virtual device
    AudioCapture.detectVirtualAudioDevice().then((device) => {
      if (device) {
        setVirtualDeviceId(device.deviceId);
      }
    });
  };

  const processingMessages: Record<ProcessingStep, string> = {
    saving: "Saving audio...",
    "transcribing-you": "Transcribing your voice...",
    "transcribing-other": "Transcribing other voice...",
    merging: "Merging transcripts...",
    summarizing: "Generating AI summary...",
    done: "Complete!",
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      {/* Settings / Onboarding Modal */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
          isOnboarding={isOnboarding}
        />
      )}

      {/* Audio Setup Modal */}
      {showAudioSetup && (
        <AudioSetup
          onClose={() => setShowAudioSetup(false)}
          onReady={handleAudioSetupReady}
        />
      )}

      {/* Result Modal */}
      {showResult && (
        <MeetingResult {...resultData} onClose={() => setShowResult(false)} />
      )}

      {/* Hero Section */}
      <div className="w-full max-w-2xl mt-8 mb-10 text-center fade-in">
        <div className="inline-flex items-center gap-2 bg-[var(--accent-light)] border border-[var(--accent-border)] rounded-full px-4 py-1.5 mb-6">
          <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
          <span className="text-xs font-medium text-[var(--accent)]">
            Works with Google Meet, Zoom, Teams & desktop apps
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Meeting Transcriber
        </h1>
        <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">
          Record both sides of any meeting, get AI-powered summaries with key points and action items.
        </p>
      </div>

      {/* How It Works */}
      {state === "idle" && !showResult && (
        <div className="w-full max-w-2xl mb-10 fade-in">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider text-center mb-4">
            How it works
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--border-hover)] transition-colors shimmer"
              >
                <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center mx-auto mb-3 text-[var(--accent)]">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-[var(--text-muted)] mb-1">
                  Step {i + 1}
                </div>
                <div className="text-sm font-semibold mb-1">{step.title}</div>
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {step.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Recording Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-md text-center slide-up">
        {/* Recording State */}
        {state === "recording" && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-3 h-3 bg-[var(--danger)] rounded-full recording-pulse" />
              <span className="text-[var(--danger)] font-medium">Recording</span>
              <span className="text-xs text-[var(--text-muted)] ml-1">
                ({captureMode === "tab" ? "Browser tab" : "Desktop app"})
              </span>
            </div>
            <div className="text-5xl font-mono font-bold mb-6 tracking-wider">
              {formatDuration(duration)}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[var(--success-light)] border border-[rgba(34,197,94,0.2)] rounded-xl p-3">
                <div className="w-2 h-2 bg-[var(--success)] rounded-full mx-auto mb-1.5" />
                <div className="font-medium text-[var(--success)]">You (Mic)</div>
                <div className="text-xs text-[var(--text-secondary)]">Capturing</div>
              </div>
              <div className={`rounded-xl p-3 border ${
                hasSystemAudio
                  ? "bg-[var(--success-light)] border-[rgba(34,197,94,0.2)]"
                  : "bg-[var(--warning-light)] border-[rgba(245,158,11,0.2)]"
              }`}>
                <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${
                  hasSystemAudio ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                }`} />
                <div className={`font-medium ${
                  hasSystemAudio ? "text-[var(--success)]" : "text-[var(--warning)]"
                }`}>
                  Other ({captureMode === "tab" ? "Tab" : "App"})
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {hasSystemAudio ? "Capturing" : "Not shared"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing State */}
        {state === "processing" && (
          <div className="mb-6 py-4">
            <div className="w-12 h-12 border-[3px] border-[var(--accent)] border-t-transparent rounded-full spinner mx-auto mb-5" />
            <div className="text-sm font-medium mb-2">
              {processingMessages[processingStep]}
            </div>
            <div className="flex justify-center gap-1 mt-4">
              {(["saving", "transcribing-you", "transcribing-other", "merging", "summarizing"] as ProcessingStep[]).map((step) => (
                <div
                  key={step}
                  className={`h-1 w-8 rounded-full transition-colors ${
                    (["saving", "transcribing-you", "transcribing-other", "merging", "summarizing"] as ProcessingStep[]).indexOf(step) <=
                    (["saving", "transcribing-you", "transcribing-other", "merging", "summarizing"] as ProcessingStep[]).indexOf(processingStep)
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Idle State */}
        {state === "idle" && (
          <div className="mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--accent-border)]">
              <svg className="w-8 h-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </div>
            {!keysReady && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  Set up your API keys to get started
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Takes about 2 minutes
                </p>
              </div>
            )}
            {keysReady && (
              <p className="text-sm text-[var(--text-secondary)]">
                Ready to record your next meeting
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {state === "idle" && !keysReady && (
            <button
              onClick={openOnboarding}
              className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-[var(--accent)]/20"
            >
              Set Up API Keys
            </button>
          )}

          {state === "idle" && keysReady && (
            <>
              {/* Browser Meeting Button */}
              <button
                onClick={() => startRecording("tab")}
                className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-[var(--accent)]/20"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  Browser Meeting
                </div>
                <div className="text-xs opacity-70 mt-0.5">Google Meet, Zoom Web, Teams Web</div>
              </button>

              {/* Desktop App Button */}
              <button
                onClick={() => startRecording("system-audio")}
                className="w-full py-3 border border-[var(--border)] hover:border-[var(--border-hover)] rounded-xl font-medium transition-all hover:bg-[var(--bg-secondary)] relative"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Desktop App
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Zoom App, Teams App, any desktop app</div>
                {platform === "mac" && !virtualDeviceId && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-[var(--warning)] text-black font-bold px-1.5 py-0.5 rounded-full">
                    Setup
                  </span>
                )}
                {virtualDeviceId && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-[var(--success)] text-white font-bold px-1.5 py-0.5 rounded-full">
                    Ready
                  </span>
                )}
              </button>
            </>
          )}

          {state === "recording" && (
            <button
              onClick={stopRecording}
              className="w-full py-3.5 bg-[var(--danger)] hover:bg-[var(--danger-hover)] rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-[var(--danger)]/20"
            >
              Stop & Summarize
            </button>
          )}

          {state === "processing" && (
            <button
              disabled
              className="w-full py-3.5 bg-[var(--bg-secondary)] rounded-xl font-medium opacity-50 cursor-not-allowed"
            >
              Processing...
            </button>
          )}
        </div>

        {/* Settings link */}
        {keysReady && state === "idle" && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={openSettings}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
            {platform === "mac" && (
              <button
                onClick={() => setShowAudioSetup(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Audio Setup
              </button>
            )}
          </div>
        )}
      </div>

      {/* Features Section */}
      {state === "idle" && !showResult && (
        <div className="w-full max-w-2xl mt-10 grid grid-cols-3 gap-3 fade-in">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">99+</div>
            <div className="text-xs text-[var(--text-muted)]">Languages supported</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">~$0.01</div>
            <div className="text-xs text-[var(--text-muted)]">Per meeting (Gemini)</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">You / Other</div>
            <div className="text-xs text-[var(--text-muted)]">Speaker detection</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 text-center text-xs text-[var(--text-muted)]">
        <p>Your API keys never leave your browser. Audio is processed via your chosen AI providers.</p>
      </div>
    </main>
  );
}
