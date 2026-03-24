import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface SavePayload {
  platform: string;
  date: string;
  duration: string;
  youSpoke: string;
  otherSpoke: string;
  transcript: string;
  summary: string;
  // Platform-specific credentials
  googleSheetsId?: string;
  googleGeminiKey?: string;
  hubspotKey?: string;
  salesforceToken?: string;
  pipedriveKey?: string;
  airtableKey?: string;
  airtableBaseId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SavePayload = await request.json();
    const { platform } = body;

    switch (platform) {
      case "google_sheets":
        return await saveToGoogleSheets(body);
      case "hubspot":
        return await saveToHubSpot(body);
      case "salesforce":
        return await saveToSalesforce(body);
      case "pipedrive":
        return await saveToPipedrive(body);
      case "airtable":
        return await saveToAirtable(body);
      default:
        return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
}

/* ── Google Sheets ────────────────────────────────────── */

async function saveToGoogleSheets(body: SavePayload) {
  const { googleSheetsId, googleGeminiKey } = body;

  if (!googleSheetsId) {
    return NextResponse.json({ error: "Google Sheets ID is required" }, { status: 400 });
  }

  // Use Google Sheets API with the Gemini/Google API key
  // The sheet needs to be shared with "Anyone with the link" as Editor
  const apiKey = googleGeminiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google API key required. Your Gemini API key works for Sheets too." },
      { status: 400 }
    );
  }

  const truncatedTranscript = body.transcript.length > 50000
    ? body.transcript.substring(0, 50000) + "..."
    : body.transcript;

  const values = [[body.date, body.duration, body.youSpoke, body.otherSpoke, body.summary, truncatedTranscript]];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetsId}/values/Sheet1!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Google Sheets error: ${error}. Make sure the sheet is shared as "Anyone with the link can edit".` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── HubSpot ─────────────────────────────────────────── */

async function saveToHubSpot(body: SavePayload) {
  const { hubspotKey } = body;

  if (!hubspotKey) {
    return NextResponse.json({ error: "HubSpot API key is required" }, { status: 400 });
  }

  // Create a note/engagement in HubSpot
  const noteBody = `Meeting Date: ${body.date}\nDuration: ${body.duration}\nYou Spoke: ${body.youSpoke}\nOther Spoke: ${body.otherSpoke}\n\n--- SUMMARY ---\n${body.summary}\n\n--- TRANSCRIPT ---\n${body.transcript.substring(0, 65000)}`;

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hubspotKey}`,
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: noteBody,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `HubSpot error: ${error}` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── Salesforce ──────────────────────────────────────── */

async function saveToSalesforce(body: SavePayload) {
  const { salesforceToken } = body;

  if (!salesforceToken) {
    return NextResponse.json({ error: "Salesforce access token is required" }, { status: 400 });
  }

  // Create a Task record in Salesforce
  const description = `Meeting Summary:\n${body.summary}\n\nTranscript:\n${body.transcript.substring(0, 32000)}`;

  const response = await fetch(
    "https://login.salesforce.com/services/data/v59.0/sobjects/Task/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${salesforceToken}`,
      },
      body: JSON.stringify({
        Subject: `Meeting Notes - ${body.date}`,
        Description: description,
        Status: "Completed",
        Priority: "Normal",
        ActivityDate: body.date,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Salesforce error: ${error}. If using a sandbox, the URL may differ.` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── Pipedrive ───────────────────────────────────────── */

async function saveToPipedrive(body: SavePayload) {
  const { pipedriveKey } = body;

  if (!pipedriveKey) {
    return NextResponse.json({ error: "Pipedrive API token is required" }, { status: 400 });
  }

  // Create a note in Pipedrive
  const content = `<h3>Meeting Notes - ${body.date}</h3>
<p><strong>Duration:</strong> ${body.duration} | <strong>You:</strong> ${body.youSpoke} | <strong>Other:</strong> ${body.otherSpoke}</p>
<h4>Summary</h4>
<p>${body.summary.replace(/\n/g, "<br>")}</p>
<h4>Transcript</h4>
<p>${body.transcript.substring(0, 50000).replace(/\n/g, "<br>")}</p>`;

  const response = await fetch(
    `https://api.pipedrive.com/v1/notes?api_token=${pipedriveKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        pinned_to_lead_flag: false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Pipedrive error: ${error}` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── Airtable ────────────────────────────────────────── */

async function saveToAirtable(body: SavePayload) {
  const { airtableKey, airtableBaseId } = body;

  if (!airtableKey || !airtableBaseId) {
    return NextResponse.json({ error: "Airtable API key and Base ID are required" }, { status: 400 });
  }

  // Create a record in the first table of the base
  // Expects a table called "Meeting Notes" with columns: Date, Duration, You Spoke, Other Spoke, Summary, Transcript
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBaseId}/Meeting%20Notes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${airtableKey}`,
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Date: body.date,
              Duration: body.duration,
              "You Spoke": body.youSpoke,
              "Other Spoke": body.otherSpoke,
              Summary: body.summary,
              Transcript: body.transcript.substring(0, 100000),
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Airtable error: ${error}. Make sure you have a table called "Meeting Notes" with fields: Date, Duration, You Spoke, Other Spoke, Summary, Transcript.` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}
