"use client";

import { useState, useEffect, useCallback } from "react";

interface AudioSetupProps {
  onClose: () => void;
  onReady: () => void;
}

type SetupState = "checking" | "not-needed" | "needed" | "installed" | "error";
type Platform = "mac" | "windows" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "other";
}

export default function AudioSetup({ onClose, onReady }: AudioSetupProps) {
  const [platform] = useState<Platform>(detectPlatform);
  const [setupState, setSetupState] = useState<SetupState>("checking");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [downloaded, setDownloaded] = useState(false);

  const checkForVirtualAudio = useCallback(async () => {
    try {
      // Request mic permission first (needed to see device labels)
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(audioInputs);

      // Check for known virtual audio devices
      const virtualDriverNames = ["blackhole", "loopback", "soundflower", "vb-cable", "voicemeeter", "virtual"];
      const hasVirtualDriver = audioInputs.some((d) =>
        virtualDriverNames.some((name) => d.label.toLowerCase().includes(name))
      );

      if (platform === "windows") {
        // Windows can capture system audio via screen share without extra drivers
        setSetupState("not-needed");
      } else if (platform === "mac" && hasVirtualDriver) {
        setSetupState("installed");
      } else if (platform === "mac") {
        setSetupState("needed");
      } else {
        setSetupState("not-needed");
      }
    } catch {
      setSetupState("error");
    }
  }, [platform]);

  useEffect(() => {
    checkForVirtualAudio();
  }, [checkForVirtualAudio]);

  const downloadInstaller = () => {
    const script = `#!/bin/bash

# ============================================
# Meeting Transcriber - Audio Driver Installer
# This installs BlackHole (free, open source)
# so the app can capture desktop app audio.
# ============================================

clear
echo ""
echo "  =================================="
echo "  Meeting Transcriber - Audio Setup"
echo "  =================================="
echo ""
echo "  This will install BlackHole, a free"
echo "  audio driver for capturing app audio."
echo ""

# Check if BlackHole is already installed
if [ -d "/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver" ] || [ -d "/Library/Audio/Plug-Ins/HAL/BlackHole16ch.driver" ]; then
    echo "  BlackHole is already installed!"
    echo "  You're all set. You can close this window."
    echo ""
    read -p "  Press Enter to close..."
    exit 0
fi

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "  Installing Homebrew first (Apple's package manager)..."
    echo "  You may need to enter your Mac password."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon Macs
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    if ! command -v brew &> /dev/null; then
        echo ""
        echo "  Homebrew installation had an issue."
        echo "  Please try running this file again."
        echo ""
        read -p "  Press Enter to close..."
        exit 1
    fi
    echo ""
    echo "  Homebrew installed successfully!"
    echo ""
fi

echo "  Installing BlackHole audio driver..."
echo "  You may need to enter your Mac password."
echo ""

brew install blackhole-2ch

if [ $? -eq 0 ]; then
    echo ""
    echo "  =================================="
    echo "  Installation complete!"
    echo "  =================================="
    echo ""
    echo "  BlackHole is now installed."
    echo ""
    echo "  Next steps:"
    echo "  1. Go back to Meeting Transcriber"
    echo "  2. Click 'Check Again' button"
    echo "  3. Start recording your meetings!"
    echo ""
    echo "  You can close this window now."
    echo ""
else
    echo ""
    echo "  Installation failed."
    echo "  Please try again or visit:"
    echo "  https://github.com/ExistentialAudio/BlackHole"
    echo ""
fi

read -p "  Press Enter to close..."
`;

    const blob = new Blob([script], { type: "application/x-sh" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Install-Meeting-Audio-Driver.command";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  // Windows or no setup needed
  if (setupState === "checking") {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 w-full max-w-md text-center slide-up">
          <div className="w-12 h-12 border-[3px] border-[var(--accent)] border-t-transparent rounded-full spinner mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">Checking audio setup...</p>
        </div>
      </div>
    );
  }

  if (setupState === "not-needed") {
    // Auto-close, no setup required (Windows or other)
    onReady();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-md slide-up">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">
              {setupState === "installed" ? "You&apos;re All Set!" : "Quick One-Time Setup"}
            </h2>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white text-2xl">&times;</button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {setupState === "installed"
              ? "BlackHole is installed. You can record any desktop meeting — no further setup needed."
              : "To record desktop meetings (Zoom, Teams, Google Meet), we need a quick one-time setup."}
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">

          {/* Already Installed */}
          {setupState === "installed" && (
            <>
              <div className="bg-[var(--success-light)] border border-[rgba(34,197,94,0.3)] rounded-xl p-4 text-center">
                <div className="w-12 h-12 bg-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--success)]">Audio driver detected</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {audioDevices.find((d) => d.label.toLowerCase().includes("blackhole"))?.label ||
                    audioDevices.find((d) => d.label.toLowerCase().includes("loopback"))?.label ||
                    "Virtual audio device found"}
                </p>
              </div>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3">
                <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-2">How to use with desktop apps</p>
                <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">1</span>
                    <span>Open <strong>System Settings → Sound → Output</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">2</span>
                    <span>Set output to <strong>BlackHole 2ch</strong></span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">3</span>
                    <span>Click <strong>Start Recording</strong> in our app</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold">4</span>
                    <span>After the meeting, switch output back to your speakers</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onReady}
                className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium transition-all"
              >
                Got it, let&apos;s go!
              </button>
            </>
          )}

          {/* Needs Installation */}
          {setupState === "needed" && (
            <>
              {/* Friendly welcome message for Mac users */}
              <div className="bg-[var(--accent-light)] border border-[rgba(99,102,241,0.2)] rounded-xl p-4">
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  We detected you&apos;re on a <strong>Mac</strong>. To record audio from desktop apps like Zoom, Teams, or Google Meet, you&apos;ll need a small free audio driver called <strong>BlackHole</strong>.
                </p>
                <div className="mt-3 flex items-center gap-2 bg-[var(--bg-card)] rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-[var(--success)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs text-[var(--text-secondary)]">
                    <strong>One-time install</strong> — do it once, use it forever. No need to repeat this again.
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[var(--accent-light)] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1">Safe & Trusted</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      BlackHole is free, open-source, and used by thousands of Mac users worldwide. It simply routes audio between apps — nothing else.
                    </p>
                  </div>
                </div>
              </div>

              {!downloaded ? (
                <>
                  <p className="text-xs text-[var(--text-muted)] text-center font-medium">Just two quick steps and you&apos;re all set:</p>

                  <div className="space-y-3">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                      <div>
                        <p className="text-sm font-medium">Click the button below</p>
                        <p className="text-xs text-[var(--text-muted)]">Downloads a small setup file to your Mac</p>
                      </div>
                    </div>

                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                      <div>
                        <p className="text-sm font-medium">Double-click the downloaded file</p>
                        <p className="text-xs text-[var(--text-muted)]">It installs everything automatically — just click OK when prompted</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={downloadInstaller}
                    className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-[var(--accent)]/20 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Setup File
                  </button>

                  <p className="text-xs text-[var(--text-muted)] text-center">
                    Takes less than a minute. After this, your app is ready to record any meeting.
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-[var(--warning-light)] border border-[rgba(245,158,11,0.3)] rounded-xl p-4 text-center">
                    <svg className="w-8 h-8 text-[var(--warning)] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <p className="text-sm font-medium text-[var(--warning)]">File downloaded!</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Find <strong>Install-Meeting-Audio-Driver.command</strong> in your Downloads folder and <strong>double-click</strong> it.
                    </p>
                  </div>

                  <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      <strong>If Mac blocks it:</strong> Right-click the file &rarr; Open &rarr; Click &quot;Open&quot; again
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      <strong>It may ask for your Mac password</strong> — this is normal for installing audio drivers.
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      <strong>Remember:</strong> This is a one-time setup. You won&apos;t need to do this again.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={checkForVirtualAudio}
                      className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium transition-all"
                    >
                      I&apos;ve Installed It — Check Now
                    </button>
                    <button
                      onClick={downloadInstaller}
                      className="px-4 py-3 border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      Re-download
                    </button>
                  </div>
                </>
              )}

              <div className="text-center">
                <button
                  onClick={onClose}
                  className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  Skip — I&apos;ll only record my microphone for now
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {setupState === "error" && (
            <>
              <div className="bg-[var(--danger-light)] border border-[rgba(239,68,68,0.3)] rounded-xl p-4 text-center">
                <p className="text-sm text-[var(--danger)]">Couldn&apos;t check audio devices.</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Please allow microphone access when prompted.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={checkForVirtualAudio} className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium transition-all">
                  Try Again
                </button>
                <button onClick={onClose} className="flex-1 py-3 border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--bg-secondary)] transition-colors">
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
