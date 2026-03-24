const KEYS = {
  OPENAI_API_KEY: "mt_openai_key",
  ANTHROPIC_API_KEY: "mt_anthropic_key",
  GOOGLE_GEMINI_API_KEY: "mt_gemini_key",
  GROQ_API_KEY: "mt_groq_key",
  DEEPSEEK_API_KEY: "mt_deepseek_key",
  TRANSCRIPTION_PROVIDER: "mt_transcription_provider",
  SUMMARIZATION_PROVIDER: "mt_summarization_provider",
  CRM_PLATFORM: "mt_crm_platform",
  GOOGLE_SHEETS_ID: "mt_sheets_id",
  HUBSPOT_API_KEY: "mt_hubspot_key",
  SALESFORCE_TOKEN: "mt_salesforce_token",
  PIPEDRIVE_API_KEY: "mt_pipedrive_key",
  AIRTABLE_API_KEY: "mt_airtable_key",
  AIRTABLE_BASE_ID: "mt_airtable_base_id",
  EMAIL_ENABLED: "mt_email_enabled",
  EMAIL_RECIPIENTS: "mt_email_recipients",
  RESEND_API_KEY: "mt_resend_key",
  ONBOARDED: "mt_onboarded",
} as const;

export type TranscriptionProvider = "openai_whisper" | "groq_whisper" | "google_gemini";
export type SummarizationProvider = "anthropic" | "openai" | "google_gemini" | "deepseek";
export type CrmPlatform = "google_sheets" | "hubspot" | "salesforce" | "pipedrive" | "airtable" | "none";

export interface AppSettings {
  transcriptionProvider: TranscriptionProvider;
  summarizationProvider: SummarizationProvider;
  openaiKey: string;
  anthropicKey: string;
  googleGeminiKey: string;
  groqKey: string;
  deepseekKey: string;
  crmPlatform: CrmPlatform;
  googleSheetsId: string;
  hubspotKey: string;
  salesforceToken: string;
  pipedriveKey: string;
  airtableKey: string;
  airtableBaseId: string;
  emailEnabled: boolean;
  emailRecipients: string;
  resendApiKey: string;
  onboarded: boolean;
}

const DEFAULTS: AppSettings = {
  transcriptionProvider: "openai_whisper",
  summarizationProvider: "anthropic",
  openaiKey: "",
  anthropicKey: "",
  googleGeminiKey: "",
  groqKey: "",
  deepseekKey: "",
  crmPlatform: "none",
  googleSheetsId: "",
  hubspotKey: "",
  salesforceToken: "",
  pipedriveKey: "",
  airtableKey: "",
  airtableBaseId: "",
  emailEnabled: false,
  emailRecipients: "",
  resendApiKey: "",
  onboarded: false,
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };

  return {
    transcriptionProvider: (localStorage.getItem(KEYS.TRANSCRIPTION_PROVIDER) as TranscriptionProvider) || "openai_whisper",
    summarizationProvider: (localStorage.getItem(KEYS.SUMMARIZATION_PROVIDER) as SummarizationProvider) || "anthropic",
    openaiKey: localStorage.getItem(KEYS.OPENAI_API_KEY) || "",
    anthropicKey: localStorage.getItem(KEYS.ANTHROPIC_API_KEY) || "",
    googleGeminiKey: localStorage.getItem(KEYS.GOOGLE_GEMINI_API_KEY) || "",
    groqKey: localStorage.getItem(KEYS.GROQ_API_KEY) || "",
    deepseekKey: localStorage.getItem(KEYS.DEEPSEEK_API_KEY) || "",
    crmPlatform: (localStorage.getItem(KEYS.CRM_PLATFORM) as CrmPlatform) || "none",
    googleSheetsId: localStorage.getItem(KEYS.GOOGLE_SHEETS_ID) || "",
    hubspotKey: localStorage.getItem(KEYS.HUBSPOT_API_KEY) || "",
    salesforceToken: localStorage.getItem(KEYS.SALESFORCE_TOKEN) || "",
    pipedriveKey: localStorage.getItem(KEYS.PIPEDRIVE_API_KEY) || "",
    airtableKey: localStorage.getItem(KEYS.AIRTABLE_API_KEY) || "",
    airtableBaseId: localStorage.getItem(KEYS.AIRTABLE_BASE_ID) || "",
    emailEnabled: localStorage.getItem(KEYS.EMAIL_ENABLED) === "true",
    emailRecipients: localStorage.getItem(KEYS.EMAIL_RECIPIENTS) || "",
    resendApiKey: localStorage.getItem(KEYS.RESEND_API_KEY) || "",
    onboarded: localStorage.getItem(KEYS.ONBOARDED) === "true",
  };
}

export function saveSettings(settings: Partial<AppSettings>) {
  const map: Record<string, string | undefined> = {
    [KEYS.OPENAI_API_KEY]: settings.openaiKey,
    [KEYS.ANTHROPIC_API_KEY]: settings.anthropicKey,
    [KEYS.GOOGLE_GEMINI_API_KEY]: settings.googleGeminiKey,
    [KEYS.GROQ_API_KEY]: settings.groqKey,
    [KEYS.DEEPSEEK_API_KEY]: settings.deepseekKey,
    [KEYS.TRANSCRIPTION_PROVIDER]: settings.transcriptionProvider,
    [KEYS.SUMMARIZATION_PROVIDER]: settings.summarizationProvider,
    [KEYS.CRM_PLATFORM]: settings.crmPlatform,
    [KEYS.GOOGLE_SHEETS_ID]: settings.googleSheetsId,
    [KEYS.HUBSPOT_API_KEY]: settings.hubspotKey,
    [KEYS.SALESFORCE_TOKEN]: settings.salesforceToken,
    [KEYS.PIPEDRIVE_API_KEY]: settings.pipedriveKey,
    [KEYS.AIRTABLE_API_KEY]: settings.airtableKey,
    [KEYS.AIRTABLE_BASE_ID]: settings.airtableBaseId,
    [KEYS.EMAIL_RECIPIENTS]: settings.emailRecipients,
    [KEYS.RESEND_API_KEY]: settings.resendApiKey,
  };

  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined) localStorage.setItem(key, value);
  }

  if (settings.emailEnabled !== undefined) {
    localStorage.setItem(KEYS.EMAIL_ENABLED, String(settings.emailEnabled));
  }
  if (settings.onboarded !== undefined) {
    localStorage.setItem(KEYS.ONBOARDED, String(settings.onboarded));
  }
}

// Returns the API key needed for the selected transcription provider
export function getTranscriptionKey(): string {
  const s = getSettings();
  switch (s.transcriptionProvider) {
    case "openai_whisper": return s.openaiKey;
    case "groq_whisper": return s.groqKey;
    case "google_gemini": return s.googleGeminiKey;
  }
}

// Returns the API key needed for the selected summarization provider
export function getSummarizationKey(): string {
  const s = getSettings();
  switch (s.summarizationProvider) {
    case "anthropic": return s.anthropicKey;
    case "openai": return s.openaiKey;
    case "google_gemini": return s.googleGeminiKey;
    case "deepseek": return s.deepseekKey;
  }
}

export function hasRequiredKeys(): boolean {
  const s = getSettings();
  const hasApiKeys = !!getTranscriptionKey() && !!getSummarizationKey();
  const hasDelivery = s.crmPlatform !== "none" || s.emailEnabled;
  return hasApiKeys && hasDelivery;
}

export function getApiKeys() {
  const s = getSettings();
  return {
    transcriptionKey: getTranscriptionKey(),
    summarizationKey: getSummarizationKey(),
    transcriptionProvider: s.transcriptionProvider,
    summarizationProvider: s.summarizationProvider,
    sheetsId: s.googleSheetsId,
  };
}
