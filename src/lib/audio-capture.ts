export interface AudioCaptureResult {
  micBlob: Blob | null;
  systemBlob: Blob | null;
  micDuration: number;
  systemDuration: number;
}

export type CaptureMode = "tab" | "system-audio";

export class AudioCapture {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private micRecorder: MediaRecorder | null = null;
  private systemRecorder: MediaRecorder | null = null;
  private micChunks: Blob[] = [];
  private systemChunks: Blob[] = [];
  private startTime: number = 0;
  private onDurationUpdate: ((seconds: number) => void) | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;

  setOnDurationUpdate(callback: (seconds: number) => void) {
    this.onDurationUpdate = callback;
  }

  /**
   * Detect if a virtual audio driver (BlackHole, VB-Cable, etc.) is available
   */
  static async detectVirtualAudioDevice(): Promise<MediaDeviceInfo | null> {
    try {
      // Need mic permission first to see device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const virtualDriverNames = ["blackhole", "loopback", "soundflower", "vb-cable", "voicemeeter"];

      return (
        devices.find(
          (d) =>
            d.kind === "audioinput" &&
            virtualDriverNames.some((name) => d.label.toLowerCase().includes(name))
        ) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Start capturing audio
   * @param mode "tab" = browser tab sharing, "system-audio" = virtual audio device
   * @param virtualDeviceId optional device ID for virtual audio driver
   */
  async startCapture(mode: CaptureMode = "tab", virtualDeviceId?: string): Promise<void> {
    this.micChunks = [];
    this.systemChunks = [];

    // 1. Get microphone access (your voice)
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
    } catch (err) {
      throw new Error(
        "Microphone access denied. Please allow microphone access and try again."
      );
    }

    // 2. Get other person's audio
    if (mode === "system-audio" && virtualDeviceId) {
      // Use virtual audio device (BlackHole, VB-Cable, etc.)
      try {
        this.systemStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: virtualDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        throw new Error(
          "Could not access virtual audio device. Make sure it is set as your system output in Sound settings."
        );
      }
    } else {
      // Use tab/screen sharing
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required by API but we only use audio
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        // Check if audio track was shared
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          // User didn't check "Share audio" — stop video and continue without
          displayStream.getVideoTracks().forEach((t) => t.stop());
          this.systemStream = null;
        } else {
          // We only need audio, stop video track to save resources
          displayStream.getVideoTracks().forEach((t) => t.stop());
          this.systemStream = new MediaStream(audioTracks);
        }
      } catch {
        // User cancelled screen share — continue with mic only
        this.systemStream = null;
      }
    }

    // 3. Set up MediaRecorders
    const mimeType = this.getSupportedMimeType();

    this.micRecorder = new MediaRecorder(this.micStream, { mimeType });
    this.micRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.micChunks.push(e.data);
    };

    if (this.systemStream) {
      this.systemRecorder = new MediaRecorder(this.systemStream, { mimeType });
      this.systemRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.systemChunks.push(e.data);
      };
    }

    // 4. Start recording
    this.startTime = Date.now();
    this.micRecorder.start(1000); // Collect data every second
    this.systemRecorder?.start(1000);

    // 5. Duration timer
    this.durationInterval = setInterval(() => {
      const seconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.onDurationUpdate?.(seconds);
    }, 1000);

    // Handle system stream ending (user stops sharing)
    this.systemStream?.getAudioTracks().forEach((track) => {
      track.onended = () => {
        this.systemRecorder?.stop();
      };
    });
  }

  async stopCapture(): Promise<AudioCaptureResult> {
    const duration = (Date.now() - this.startTime) / 1000;

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    // Stop recorders and collect final data
    const micPromise = new Promise<void>((resolve) => {
      if (this.micRecorder && this.micRecorder.state !== "inactive") {
        this.micRecorder.onstop = () => resolve();
        this.micRecorder.stop();
      } else {
        resolve();
      }
    });

    const systemPromise = new Promise<void>((resolve) => {
      if (this.systemRecorder && this.systemRecorder.state !== "inactive") {
        this.systemRecorder.onstop = () => resolve();
        this.systemRecorder.stop();
      } else {
        resolve();
      }
    });

    await Promise.all([micPromise, systemPromise]);

    // Stop all tracks
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.systemStream?.getTracks().forEach((t) => t.stop());

    const mimeType = this.getSupportedMimeType();
    const micBlob =
      this.micChunks.length > 0
        ? new Blob(this.micChunks, { type: mimeType })
        : null;
    const systemBlob =
      this.systemChunks.length > 0
        ? new Blob(this.systemChunks, { type: mimeType })
        : null;

    return {
      micBlob,
      systemBlob,
      micDuration: duration,
      systemDuration: duration,
    };
  }

  isRecording(): boolean {
    return this.micRecorder?.state === "recording";
  }

  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "audio/webm";
  }
}
