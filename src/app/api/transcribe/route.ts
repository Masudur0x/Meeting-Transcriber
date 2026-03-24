import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const apiKey = formData.get("apiKey") as string;
    const speaker = formData.get("speaker") as string;
    const provider = (formData.get("provider") as string) || "openai_whisper";

    if (!audioFile || !apiKey) {
      return NextResponse.json({ error: "Missing audio file or API key" }, { status: 400 });
    }

    switch (provider) {
      case "openai_whisper":
        return await transcribeWithOpenAI(audioFile, apiKey, speaker);
      case "groq_whisper":
        return await transcribeWithGroq(audioFile, apiKey, speaker);
      case "google_gemini":
        return await transcribeWithGemini(audioFile, apiKey, speaker);
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 500 });
  }
}

/* ── OpenAI Whisper ───────────────────────────────────── */

async function transcribeWithOpenAI(audioFile: File, apiKey: string, speaker: string) {
  const form = new FormData();
  form.append("file", audioFile, `${speaker}.webm`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `OpenAI Whisper error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ speaker, ...result });
}

/* ── Groq (Whisper) ───────────────────────────────────── */

async function transcribeWithGroq(audioFile: File, apiKey: string, speaker: string) {
  const form = new FormData();
  form.append("file", audioFile, `${speaker}.webm`);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Groq Whisper error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ speaker, ...result });
}

/* ── Google Gemini (multimodal transcription) ─────────── */

async function transcribeWithGemini(audioFile: File, apiKey: string, speaker: string) {
  // Convert audio to base64
  const buffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(buffer).toString("base64");

  const mimeType = audioFile.type || "audio/webm";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: `Transcribe this audio precisely. Return ONLY a JSON object (no markdown, no code fences) with this exact structure:
{"text": "full transcription text", "segments": [{"start": 0.0, "end": 1.5, "text": "segment text"}, ...]}

Each segment should be roughly a sentence. The start/end values are in seconds. Transcribe in the original language spoken. If no speech is detected, return {"text": "", "segments": []}.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Gemini error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parse the JSON from Gemini's response
  try {
    // Strip markdown code fences if present
    const cleaned = textContent.replace(/```json\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ speaker, text: parsed.text || "", segments: parsed.segments || [] });
  } catch {
    // If JSON parsing fails, treat the whole response as plain text
    return NextResponse.json({ speaker, text: textContent.trim(), segments: [] });
  }
}
