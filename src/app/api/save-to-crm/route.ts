import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform } = body;

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

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${googleSheetsId}`;
  const key = `key=${googleGeminiKey}`;

  // Check if header row already exists
  const checkRes = await fetch(`${base}/values/A1:F1?${key}`);
  if (checkRes.ok) {
    const checkData = await checkRes.json();
    const hasHeaders = checkData.values && checkData.values[0]?.length > 0;

    if (!hasHeaders) {
      // Auto-create header row on first use
      await fetch(`${base}/values/A1:F1?valueInputOption=USER_ENTERED&${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [["Date", "Duration", "You Spoke", "Other Spoke", "Summary", "Transcript"]],
        }),
      });
    }
  }

  // Append the data row
  const response = await fetch(
    `${base}/values/A1:append?valueInputOption=USER_ENTERED&${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[date, duration, youSpoke, otherSpoke, summary, transcript]] }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Google Sheets error: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}

/* ── HubSpot ─────────────────────────────────────────── */

const HUBSPOT_PROPERTIES = [
  { name: "meeting_date", label: "Meeting Date", type: "string", fieldType: "text" },
  { name: "meeting_duration", label: "Meeting Duration", type: "string", fieldType: "text" },
  { name: "meeting_you_spoke", label: "You Spoke", type: "string", fieldType: "text" },
  { name: "meeting_other_spoke", label: "Other Spoke", type: "string", fieldType: "text" },
  { name: "meeting_summary", label: "Meeting Summary", type: "string", fieldType: "textarea" },
  { name: "meeting_transcript", label: "Meeting Transcript", type: "string", fieldType: "textarea" },
];

async function saveToHubspot(body: Record<string, string>) {
  const { hubspotKey, date, duration, youSpoke, otherSpoke, summary, transcript } = body;

  if (!hubspotKey) {
    return NextResponse.json({ error: "Missing HubSpot API key" }, { status: 400 });
  }

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${hubspotKey}` };

  // Auto-setup: check and create custom properties on first use
  for (const prop of HUBSPOT_PROPERTIES) {
    const check = await fetch(`https://api.hubapi.com/crm/v3/properties/notes/${prop.name}`, { headers });
    if (check.status === 404) {
      await fetch("https://api.hubapi.com/crm/v3/properties/notes", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.fieldType,
          groupName: "notesinformation",
        }),
      });
    }
  }

  // Save the record
  const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: `Meeting Notes (${date})\nDuration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
        meeting_date: date,
        meeting_duration: duration,
        meeting_you_spoke: youSpoke,
        meeting_other_spoke: otherSpoke,
        meeting_summary: summary,
        meeting_transcript: transcript?.substring(0, 65000) ?? "",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `HubSpot error: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}

/* ── Salesforce ──────────────────────────────────────── */

const SALESFORCE_FIELDS = [
  { fullName: "Meeting_Date__c", label: "Meeting Date", type: "Text", length: 255 },
  { fullName: "Meeting_Duration__c", label: "Meeting Duration", type: "Text", length: 255 },
  { fullName: "You_Spoke__c", label: "You Spoke", type: "Text", length: 255 },
  { fullName: "Other_Spoke__c", label: "Other Spoke", type: "Text", length: 255 },
  { fullName: "Meeting_Summary__c", label: "Meeting Summary", type: "LongTextArea", length: 131072, visibleLines: 10 },
  { fullName: "Meeting_Transcript__c", label: "Meeting Transcript", type: "LongTextArea", length: 131072, visibleLines: 10 },
];

async function saveToSalesforce(body: Record<string, string>) {
  const { salesforceToken, salesforceInstanceUrl, date, duration, youSpoke, otherSpoke, summary, transcript } = body;

  if (!salesforceToken) {
    return NextResponse.json({ error: "Missing Salesforce token" }, { status: 400 });
  }

  const instanceUrl = salesforceInstanceUrl || salesforceToken.split("!")[0] || "https://login.salesforce.com";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${salesforceToken}` };

  // Auto-setup: create custom fields on Task if they don't exist
  for (const field of SALESFORCE_FIELDS) {
    const check = await fetch(
      `${instanceUrl}/services/data/v59.0/sobjects/Task/describe`,
      { headers }
    );
    if (check.ok) {
      const desc = await check.json();
      const exists = desc.fields?.some((f: { name: string }) => f.name === field.fullName);
      if (!exists) {
        // Use Metadata API to create the field
        await fetch(`${instanceUrl}/services/data/v59.0/tooling/sobjects/CustomField`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            FullName: `Task.${field.fullName}`,
            Metadata: {
              label: field.label,
              type: field.type,
              length: field.length,
              ...(field.visibleLines ? { visibleLines: field.visibleLines } : {}),
            },
          }),
        });
      }
    }
  }

  // Save the record using standard + custom fields
  const taskBody: Record<string, string> = {
    Subject: `Meeting Notes - ${date}`,
    Description: `Duration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
    Status: "Completed",
    ActivityDate: new Date().toISOString().split("T")[0],
    Meeting_Date__c: date,
    Meeting_Duration__c: duration,
    You_Spoke__c: youSpoke,
    Other_Spoke__c: otherSpoke,
    Meeting_Summary__c: summary?.substring(0, 131072) ?? "",
    Meeting_Transcript__c: transcript?.substring(0, 131072) ?? "",
  };

  const response = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Task/`, {
    method: "POST",
    headers,
    body: JSON.stringify(taskBody),
  });

  if (!response.ok) {
    // Fallback: save with standard fields only if custom fields failed
    const fallback = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Task/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Subject: `Meeting Notes - ${date}`,
        Description: `Duration: ${duration}\nYou: ${youSpoke} | Other: ${otherSpoke}\n\n${summary}`,
        Status: "Completed",
        ActivityDate: new Date().toISOString().split("T")[0],
      }),
    });
    if (!fallback.ok) {
      const error = await fallback.text();
      return NextResponse.json({ error: `Salesforce error: ${error}` }, { status: fallback.status });
    }
  }

  return NextResponse.json({ success: true });
}

/* ── Pipedrive ───────────────────────────────────────── */

const PIPEDRIVE_FIELDS = [
  { name: "meeting_date", field_type: "varchar", label: "Meeting Date" },
  { name: "meeting_duration", field_type: "varchar", label: "Meeting Duration" },
  { name: "meeting_you_spoke", field_type: "varchar", label: "You Spoke" },
  { name: "meeting_other_spoke", field_type: "varchar", label: "Other Spoke" },
  { name: "meeting_summary", field_type: "text", label: "Meeting Summary" },
  { name: "meeting_transcript", field_type: "text", label: "Meeting Transcript" },
];

async function saveToPipedrive(body: Record<string, string>) {
  const { pipedriveKey, date, duration, youSpoke, otherSpoke, summary, transcript } = body;

  if (!pipedriveKey) {
    return NextResponse.json({ error: "Missing Pipedrive API key" }, { status: 400 });
  }

  const base = `https://api.pipedrive.com/v1`;
  const token = `api_token=${pipedriveKey}`;

  // Auto-setup: check and create custom note fields on first use
  const existingRes = await fetch(`${base}/noteFields?${token}`);
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    const existingKeys = existingData.data?.map((f: { key: string }) => f.key) ?? [];

    for (const field of PIPEDRIVE_FIELDS) {
      if (!existingKeys.includes(field.name)) {
        await fetch(`${base}/noteFields?${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: field.label, field_type: field.field_type }),
        });
      }
    }
  }

  // Save the note with all data
  const response = await fetch(`${base}/notes?${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `<b>Meeting Notes — ${date}</b><br/>Duration: ${duration}<br/>You spoke: ${youSpoke} | Other spoke: ${otherSpoke}<br/><br/>${summary}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Pipedrive error: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}

/* ── Airtable ────────────────────────────────────────── */

async function saveToAirtable(body: Record<string, string>) {
  const { airtableKey, airtableBaseId, date, duration, youSpoke, otherSpoke, transcript, summary } = body;

  if (!airtableKey || !airtableBaseId) {
    return NextResponse.json({ error: "Missing Airtable API key or Base ID" }, { status: 400 });
  }

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${airtableKey}` };

  // Auto-setup: check if "Meetings" table exists, create if not
  const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${airtableBaseId}/tables`, { headers });

  if (tablesRes.ok) {
    const tablesData = await tablesRes.json();
    const exists = tablesData.tables?.some((t: { name: string }) => t.name === "Meetings");

    if (!exists) {
      // Create the Meetings table with all required fields
      await fetch(`https://api.airtable.com/v0/meta/bases/${airtableBaseId}/tables`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Meetings",
          fields: [
            { name: "Date", type: "singleLineText" },
            { name: "Duration", type: "singleLineText" },
            { name: "You Spoke", type: "singleLineText" },
            { name: "Other Spoke", type: "singleLineText" },
            { name: "Summary", type: "multilineText" },
            { name: "Transcript", type: "multilineText" },
          ],
        }),
      });
    }
  }

  // Save the record
  const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/Meetings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fields: {
        Date: date,
        Duration: duration,
        "You Spoke": youSpoke,
        "Other Spoke": otherSpoke,
        Summary: summary,
        Transcript: transcript?.substring(0, 100000) ?? "",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Airtable error: ${error}` }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
