import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, date, duration, youSpoke, otherSpoke, transcript, summary } = body;

    if (!platform || platform === "none") {
      return NextResponse.json({ error: "No CRM platform selected" }, { status: 400 });
    }

    switch (platform) {
      case "google_sheets":
        return await saveToGoogleSheets(body);
      case "hubspot":
        return await saveToHubspot(body);
      case "salesforce":
        return await saveToSalesforce(body);
      case "pipedrive":
        return await saveToPipedrive(body);
      case "airtable":
        return await saveToAirtable(body);
      default:
        return NextResponse.json({ error: `Unknown CRM platform: ${platform}` }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `CRM save failed: ${message}` }, { status: 500 });
  }
}

/* ── Google Sheets ───────────────────────────────────── */

async function saveToGoogleSheets(body: Record<string, string>) {
  const { googleSheetsId, googleGeminiKey, date, duration, youSpoke, otherSpoke, transcript, summary } = body;

  if (!googleSheetsId || !googleGeminiKey) {
    return NextResponse.json({ error: "Missing Google Sheets ID or API key" }, { status: 400 });
  }

  // Use Google Sheets API v4 with API key
  // Append a row to the first sheet
  const values = [[date, duration, youSpoke, otherSpoke, summary, transcript]];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetsId}/values/A1:append?valueInputOption=USER_ENTERED&key=${googleGeminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Google Sheets error: ${error}` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── HubSpot ─────────────────────────────────────────── */

async function saveToHubspot(body: Record<string, string>) {
  const { hubspotKey, date, duration, youSpoke, otherSpoke, summary } = body;

  if (!hubspotKey) {
    return NextResponse.json({ error: "Missing HubSpot API key" }, { status: 400 });
  }

  const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hubspotKey}`,
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: `Meeting Notes (${date})\nDuration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
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

async function saveToSalesforce(body: Record<string, string>) {
  const { salesforceToken, date, duration, youSpoke, otherSpoke, summary } = body;

  if (!salesforceToken) {
    return NextResponse.json({ error: "Missing Salesforce token" }, { status: 400 });
  }

  // Salesforce REST API - create a Task record
  const instanceUrl = salesforceToken.split("!")[0] || "https://login.salesforce.com";

  const response = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Task/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${salesforceToken}`,
    },
    body: JSON.stringify({
      Subject: `Meeting Notes - ${date}`,
      Description: `Duration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
      Status: "Completed",
      ActivityDate: date,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Salesforce error: ${error}` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}

/* ── Pipedrive ───────────────────────────────────────── */

async function saveToPipedrive(body: Record<string, string>) {
  const { pipedriveKey, date, duration, youSpoke, otherSpoke, summary } = body;

  if (!pipedriveKey) {
    return NextResponse.json({ error: "Missing Pipedrive API key" }, { status: 400 });
  }

  const response = await fetch(
    `https://api.pipedrive.com/v1/notes?api_token=${pipedriveKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `Meeting Notes (${date})\nDuration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
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

async function saveToAirtable(body: Record<string, string>) {
  const { airtableKey, airtableBaseId, date, duration, youSpoke, otherSpoke, transcript, summary } = body;

  if (!airtableKey || !airtableBaseId) {
    return NextResponse.json({ error: "Missing Airtable API key or Base ID" }, { status: 400 });
  }

  // Airtable expects a table name — default to "Meetings"
  const response = await fetch(
    `https://api.airtable.com/v0/${airtableBaseId}/Meetings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${airtableKey}`,
      },
      body: JSON.stringify({
        fields: {
          Date: date,
          Duration: duration,
          "You Spoke": youSpoke,
          "Other Spoke": otherSpoke,
          Summary: summary,
          Transcript: transcript.substring(0, 100000), // Airtable has field size limits
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json(
      { error: `Airtable error: ${error}` },
      { status: response.status }
    );
  }

  return NextResponse.json({ success: true });
}
