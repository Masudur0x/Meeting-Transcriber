import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const apiKey = formData.get("apiKey") as string;
    const speaker = formData.get("speaker") as string;
    const provider = (formData.get("provider") as string) || "openai_whisper";

    if (!audioFile || !apiKey) {
      return NextResponse.json(
        { error: "Missing audio file or API key" },
        { status: 400 }
      );
    }

    switch (provider) {
      case "openai_whisper":
        return await transcribeWithOpenAI(audioFile, apiKey, speaker);
      case "groq_whisper":
        return await transcribeWithGroq(audioFile, apiKey, speaker);
      case "google_gemini":
        return await transcribeWithGemini(audioFile, apiKey, speaker);
      default:
        return NextResponse.json(
          { error: `Unknown transcription provider: ${provider}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Transcription failed: ${message}` },
      { status: 500 }
    );
  }
}

/* ── OpenAI Whisper ──────────────────────────────────── */

async function transcribeWithOpenAI(
  audioFile: File,
  apiKey: string,
  speaker: string
) {
  const form = new FormData();
  form.append("file", audioFile);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `OpenAI Whisper error: ${error}` },
      { status: response.status }
    );
  }

  const result = await response.json();
  return NextResponse.json({
    speaker,
    text: result.text,
    segments: result.segments?.map(
      (s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })
    ),
  });
}

/* ── Groq Whisper ────────────────────────────────────── */

async function transcribeWithGroq(
  audioFile: File,
  apiKey: string,
  speaker: string
) {
  const form = new FormData();
  form.append("file", audioFile);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Groq Whisper error: ${error}` },
      { status: response.status }
    );
  }

  const result = await response.json();
  return NextResponse.json({
    speaker,
    text: result.text,
    segments: result.segments?.map(
      (s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })
    ),
  });
}

/* ── Google Gemini ────────────────────────────────────── */

async function transcribeWithGemini(
  audioFile: File,
  apiKey: string,
  speaker: string
) {
  // Convert audio file to base64
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  // Determine MIME type
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
                text: 'Transcribe this audio precisely. Return ONLY a JSON object with this format: {"text": "full transcription text", "segments": [{"start": 0.0, "end": 2.5, "text": "segment text"}]}. Do not include any markdown formatting or code blocks, just raw JSON.',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Gemini transcription error: ${error}` },
      { status: response.status }
    );
  }

  const result = await response.json();
  const rawText =
    result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Try to parse as JSON
  try {
    const cleaned = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      speaker,
      text: parsed.text,
      segments: parsed.segments,
    });
  } catch {
    // If JSON parsing fails, return raw text
    return NextResponse.json({
      speaker,
      text: rawText,
    });
  }
}
