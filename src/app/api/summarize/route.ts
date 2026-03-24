import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

const SUMMARY_PROMPT = (youSpoke: string, otherSpoke: string, transcript: string) =>
  `You are a meeting notes assistant. Analyze this meeting transcript and provide a structured summary.

The transcript has two speakers labeled "You" and "Other".
- You spoke for approximately ${youSpoke} minutes
- Other spoke for approximately ${otherSpoke} minutes

Transcript:
${transcript}

Please provide:
1. **Meeting Summary** (2-3 sentences)
2. **Key Points** (bullet points of important topics discussed)
3. **Decisions Made** (if any)
4. **Action Items** (tasks mentioned with who is responsible)
5. **Follow-ups Needed** (anything that needs future attention)

Keep it concise and professional. If the meeting was in a non-English language, provide the summary in BOTH the original language AND English.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, apiKey, youSpoke, otherSpoke, provider = "anthropic" } = body;

    if (!transcript || !apiKey) {
      return NextResponse.json({ error: "Missing transcript or API key" }, { status: 400 });
    }

    const prompt = SUMMARY_PROMPT(youSpoke, otherSpoke, transcript);

    switch (provider) {
      case "anthropic":
        return await summarizeWithAnthropic(prompt, apiKey);
      case "openai":
        return await summarizeWithOpenAI(prompt, apiKey);
      case "google_gemini":
        return await summarizeWithGemini(prompt, apiKey);
      case "deepseek":
        return await summarizeWithDeepseek(prompt, apiKey);
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Summarization failed: ${message}` }, { status: 500 });
  }
}

/* ── Anthropic Claude ─────────────────────────────────── */

async function summarizeWithAnthropic(prompt: string, apiKey: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Claude error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ summary: result.content[0].text });
}

/* ── OpenAI GPT-4o ────────────────────────────────────── */

async function summarizeWithOpenAI(prompt: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `OpenAI error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ summary: result.choices[0].message.content });
}

/* ── Google Gemini ────────────────────────────────────── */

async function summarizeWithGemini(prompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Gemini error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";
  return NextResponse.json({ summary: text });
}

/* ── Deepseek ─────────────────────────────────────────── */

async function summarizeWithDeepseek(prompt: string, apiKey: string) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Deepseek error: ${error}` }, { status: response.status });
  }

  const result = await response.json();
  return NextResponse.json({ summary: result.choices[0].message.content });
}
