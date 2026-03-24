"use client";

import { useState, useEffect } from "react";
import {
  getSettings,
  saveSettings,
  type CrmPlatform,
  type TranscriptionProvider,
  type SummarizationProvider,
} from "@/lib/storage";
import HelpTooltip from "./HelpTooltip";

interface SettingsProps {
  onClose: () => void;
  onSave: () => void;
  isOnboarding?: boolean;
}

/* ── Provider data ────────────────────────────────────── */

interface ProviderOption {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  cost: string;
  bestFor: string;
  description: string;
}

const TRANSCRIPTION_PROVIDERS: ProviderOption[] = [
  {
    id: "openai_whisper",
    name: "OpenAI Whisper",
    badge: "Best Quality",
    badgeColor: "var(--accent)",
    cost: "~$0.36/hr",
    bestFor: "Important meetings, messy audio, 99+ languages",
    description: "Industry-leading accuracy. Best for critical meetings where every word matters.",
  },
  {
    id: "groq_whisper",
    name: "Groq (Whisper)",
    badge: "Best Value",
    badgeColor: "var(--success)",
    cost: "~$0.11/hr",
    bestFor: "Regular meetings, 1-3 hours, budget-conscious",
    description: "Same Whisper model, 3x cheaper. Lightning fast. Great for daily standups & calls.",
  },
  {
    id: "google_gemini",
    name: "Google Gemini",
    badge: "Budget Friendly",
    badgeColor: "var(--warning)",
    cost: "~$0.01/hr",
    bestFor: "Very long meetings (3+ hours), tight budget",
    description: "Ultra cheap via multimodal AI. Good for long meetings where cost adds up.",
  },
];

const SUMMARIZATION_PROVIDERS: ProviderOption[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    badge: "Best Quality",
    badgeColor: "var(--accent)",
    cost: "~$0.03/meeting",
    bestFor: "Complex meetings, detailed action items, nuanced discussions",
    description: "Best-in-class reasoning. Excels at extracting subtle decisions & action items.",
  },
  {
    id: "openai",
    name: "OpenAI GPT-4o",
    badge: "Great All-Around",
    badgeColor: "var(--success)",
    cost: "~$0.02/meeting",
    bestFor: "General meetings, 30min-2hr, good quality at fair price",
    description: "Reliable and versatile. Great balance of quality and cost for most meetings.",
  },
  {
    id: "google_gemini",
    name: "Google Gemini",
    badge: "Best for Long Meetings",
    badgeColor: "var(--warning)",
    cost: "~$0.002/meeting",
    bestFor: "Very long meetings (3+ hours), huge context, tight budget",
    description: "Massive context window handles multi-hour transcripts easily. Ultra affordable.",
  },
  {
    id: "deepseek",
    name: "Deepseek",
    badge: "Ultra Budget",
    badgeColor: "#f472b6",
    cost: "~$0.003/meeting",
    bestFor: "Quick meetings, ≤30min, or when other APIs have no credit",
    description: "Extremely cheap with decent quality. Perfect when you need to keep costs near zero.",
  },
];

const CRM_OPTIONS: { id: CrmPlatform; name: string; icon: string; description: string }[] = [
  { id: "google_sheets", name: "Google Sheets", icon: "📊", description: "Free, simple spreadsheet" },
  { id: "hubspot", name: "HubSpot", icon: "🟠", description: "CRM & sales platform" },
  { id: "salesforce", name: "Salesforce", icon: "☁️", description: "Enterprise CRM" },
  { id: "pipedrive", name: "Pipedrive", icon: "🟢", description: "Sales pipeline CRM" },
  { id: "airtable", name: "Airtable", icon: "📋", description: "Flexible database" },
  { id: "none", name: "No CRM", icon: "💾", description: "Skip CRM integration" },
];

/* ── Help tooltip data per provider ────────────────────── */

const PROVIDER_HELP: Record<string, { title: string; steps: string[]; exampleKey: string; linkText: string; linkUrl: string }> = {
  openai: {
    title: "How to get OpenAI API Key",
    steps: [
      "Go to platform.openai.com and sign up or log in",
      "Click your profile icon → 'API keys'",
      "Click 'Create new secret key'",
      "Copy the key (starts with sk-...)",
      "Paste it here. You need at least $5 credit.",
    ],
    exampleKey: "sk-proj-abc123def456ghi789...",
    linkText: "Open OpenAI Dashboard",
    linkUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    title: "How to get Anthropic API Key",
    steps: [
      "Go to console.anthropic.com and sign up or log in",
      "Go to 'API Keys' in the left sidebar",
      "Click 'Create Key'",
      "Give it a name and copy the key (starts with sk-ant-...)",
      "Paste it here. You need credit on your account.",
    ],
    exampleKey: "sk-ant-api03-abc123def456...",
    linkText: "Open Anthropic Console",
    linkUrl: "https://console.anthropic.com/",
  },
  google_gemini: {
    title: "How to get Google Gemini API Key",
    steps: [
      "Go to aistudio.google.com",
      "Click 'Get API Key' in the top bar",
      "Click 'Create API key'",
      "Select a Google Cloud project (or create one)",
      "Copy the API key and paste it here. Free tier available!",
    ],
    exampleKey: "AIzaSyA1B2c3D4e5F6g7H8i9J0k...",
    linkText: "Open Google AI Studio",
    linkUrl: "https://aistudio.google.com/apikey",
  },
  groq: {
    title: "How to get Groq API Key",
    steps: [
      "Go to console.groq.com and sign up (free)",
      "Click 'API Keys' in the left sidebar",
      "Click 'Create API Key'",
      "Copy the key (starts with gsk_...)",
      "Paste it here. Free tier: 14,400 audio-sec/day!",
    ],
    exampleKey: "gsk_abc123def456ghi789jkl012...",
    linkText: "Open Groq Console",
    linkUrl: "https://console.groq.com/keys",
  },
  deepseek: {
    title: "How to get Deepseek API Key",
    steps: [
      "Go to platform.deepseek.com and sign up",
      "Click 'API Keys' in the sidebar",
      "Click 'Create new API key'",
      "Copy the key (starts with sk-...)",
      "Paste it here. Very affordable rates.",
    ],
    exampleKey: "sk-abc123def456ghi789jkl012mno345...",
    linkText: "Open Deepseek Platform",
    linkUrl: "https://platform.deepseek.com/api_keys",
  },
};

/* ── Which API key each provider needs ────────────────── */

function getNeededKeyForTranscription(provider: TranscriptionProvider): string {
  switch (provider) {
    case "openai_whisper": return "openai";
    case "groq_whisper": return "groq";
    case "google_gemini": return "google_gemini";
  }
}

function getNeededKeyForSummarization(provider: SummarizationProvider): string {
  switch (provider) {
    case "anthropic": return "anthropic";
    case "openai": return "openai";
    case "google_gemini": return "google_gemini";
    case "deepseek": return "deepseek";
  }
}

/* ── Component ──────────────────────────────────────────── */

export default function Settings({ onClose, onSave, isOnboarding = false }: SettingsProps) {
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>("openai_whisper");
  const [summarizationProvider, setSummarizationProvider] = useState<SummarizationProvider>("anthropic");

  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");

  const [crmPlatform, setCrmPlatform] = useState<CrmPlatform>("none");
  const [googleSheetsId, setGoogleSheetsId] = useState("");
  const [hubspotKey, setHubspotKey] = useState("");
  const [salesforceToken, setSalesforceToken] = useState("");
  const [pipedriveKey, setPipedriveKey] = useState("");
  const [airtableKey, setAirtableKey] = useState("");
  const [airtableBaseId, setAirtableBaseId] = useState("");

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = getSettings();
    setTranscriptionProvider(s.transcriptionProvider);
    setSummarizationProvider(s.summarizationProvider);
    setOpenaiKey(s.openaiKey);
    setAnthropicKey(s.anthropicKey);
    setGeminiKey(s.googleGeminiKey);
    setGroqKey(s.groqKey);
    setDeepseekKey(s.deepseekKey);
    setCrmPlatform(s.crmPlatform);
    setGoogleSheetsId(s.googleSheetsId);
    setHubspotKey(s.hubspotKey);
    setSalesforceToken(s.salesforceToken);
    setPipedriveKey(s.pipedriveKey);
    setAirtableKey(s.airtableKey);
    setAirtableBaseId(s.airtableBaseId);
    setEmailEnabled(s.emailEnabled);
    setEmailRecipients(s.emailRecipients);
  }, []);

  // Figure out which API keys are needed
  const neededKeys = new Set<string>();
  neededKeys.add(getNeededKeyForTranscription(transcriptionProvider));
  neededKeys.add(getNeededKeyForSummarization(summarizationProvider));

  const keyValues: Record<string, string> = {
    openai: openaiKey,
    anthropic: anthropicKey,
    google_gemini: geminiKey,
    groq: groqKey,
    deepseek: deepseekKey,
  };

  const hasApiKeys = [...neededKeys].every((k) => keyValues[k]?.trim());
  const hasDelivery = crmPlatform !== "none" || emailEnabled;
  const emailValid = !emailEnabled || emailRecipients.trim() !== "";
  const canSave = hasApiKeys && hasDelivery && emailValid;

  const emailList = emailRecipients.split(",").map(e => e.trim()).filter(Boolean);

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (emailList.includes(email)) {
      setNewEmail("");
      return;
    }
    const updated = emailList.length > 0 ? emailRecipients + ", " + email : email;
    setEmailRecipients(updated);
    setNewEmail("");
  };

  const removeEmail = (emailToRemove: string) => {
    const updated = emailList.filter(e => e !== emailToRemove).join(", ");
    setEmailRecipients(updated);
  };

  const handleSave = () => {
    saveSettings({
      transcriptionProvider,
      summarizationProvider,
      openaiKey: openaiKey.trim(),
      anthropicKey: anthropicKey.trim(),
      googleGeminiKey: geminiKey.trim(),
      groqKey: groqKey.trim(),
      deepseekKey: deepseekKey.trim(),
      crmPlatform,
      googleSheetsId: googleSheetsId.trim(),
      hubspotKey: hubspotKey.trim(),
      salesforceToken: salesforceToken.trim(),
      pipedriveKey: pipedriveKey.trim(),
      airtableKey: airtableKey.trim(),
      airtableBaseId: airtableBaseId.trim(),
      emailEnabled,
      emailRecipients: emailRecipients.trim(),
      onboarded: true,
    });
    onSave();
    onClose();
  };

  const toggleShow = (key: string) => {
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Key input config
  const KEY_INPUTS: Record<string, { label: string; value: string; setter: (v: string) => void; placeholder: string; helpKey: string }> = {
    openai: { label: "OpenAI API Key", value: openaiKey, setter: setOpenaiKey, placeholder: "sk-proj-...", helpKey: "openai" },
    anthropic: { label: "Anthropic API Key", value: anthropicKey, setter: setAnthropicKey, placeholder: "sk-ant-...", helpKey: "anthropic" },
    google_gemini: { label: "Google Gemini API Key", value: geminiKey, setter: setGeminiKey, placeholder: "AIzaSy...", helpKey: "google_gemini" },
    groq: { label: "Groq API Key", value: groqKey, setter: setGroqKey, placeholder: "gsk_...", helpKey: "groq" },
    deepseek: { label: "Deepseek API Key", value: deepseekKey, setter: setDeepseekKey, placeholder: "sk-...", helpKey: "deepseek" },
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto slide-up">
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-6 pb-4 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {isOnboarding ? "Welcome! Let's set up" : "Settings"}
              </h2>
              <p className="text-[var(--text-secondary)] text-sm mt-1">
                {isOnboarding
                  ? "Choose your AI providers and delivery method. Takes ~2 minutes."
                  : "Update your AI providers, API keys, and delivery settings."}
              </p>
            </div>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white text-2xl">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Section: Transcription Provider ────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Step 1: Transcription (Speech-to-Text)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Converts your meeting audio into text. Choose based on quality needs and budget.
            </p>

            <div className="space-y-2">
              {TRANSCRIPTION_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTranscriptionProvider(p.id as TranscriptionProvider)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    transcriptionProvider === p.id
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${p.badgeColor} 15%, transparent)`, color: p.badgeColor }}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">{p.cost}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.description}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Best for: {p.bestFor}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* ── Section: Summarization Provider ────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Step 2: Summarization (AI Summary)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Analyzes your transcript to extract key points, decisions, and action items.
            </p>

            <div className="space-y-2">
              {SUMMARIZATION_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSummarizationProvider(p.id as SummarizationProvider)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    summarizationProvider === p.id
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${p.badgeColor} 15%, transparent)`, color: p.badgeColor }}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--text-secondary)]">{p.cost}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.description}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Best for: {p.bestFor}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cost estimate */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-[var(--warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold">Estimated cost for your selection</span>
            </div>
            <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
              <div>1-hour meeting: <strong className="text-white">
                {transcriptionProvider === "openai_whisper" ? "~$0.39" : transcriptionProvider === "groq_whisper" ? "~$0.14" : "~$0.04"}
              </strong> (transcription {TRANSCRIPTION_PROVIDERS.find(p => p.id === transcriptionProvider)?.cost} + summary {SUMMARIZATION_PROVIDERS.find(p => p.id === summarizationProvider)?.cost})</div>
              <div>3-hour meeting: <strong className="text-white">
                {transcriptionProvider === "openai_whisper" ? "~$1.11" : transcriptionProvider === "groq_whisper" ? "~$0.36" : "~$0.06"}
              </strong></div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              Costs are approximate and may change. Check each provider&apos;s pricing page for latest rates.
            </p>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* ── Section: API Keys (only show what's needed) ── */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Step 3: Enter API Keys
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Only showing keys needed for your selected providers.
            </p>

            <div className="space-y-4">
              {[...neededKeys].map((keyId) => {
                const input = KEY_INPUTS[keyId];
                const help = PROVIDER_HELP[keyId];
                if (!input || !help) return null;

                // Show which function this key serves
                const usedFor: string[] = [];
                if (getNeededKeyForTranscription(transcriptionProvider) === keyId) usedFor.push("Transcription");
                if (getNeededKeyForSummarization(summarizationProvider) === keyId) usedFor.push("Summarization");

                return (
                  <div key={keyId} className="fade-in">
                    <label className="flex items-center text-sm font-medium mb-1.5">
                      {input.label}
                      <span className="text-[var(--danger)] ml-0.5">*</span>
                      <HelpTooltip {...help} />
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword[keyId] ? "text" : "password"}
                        value={input.value}
                        onChange={(e) => input.setter(e.target.value)}
                        placeholder={input.placeholder}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] pr-10 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShow(keyId)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white text-xs"
                      >
                        {showPassword[keyId] ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Used for: {usedFor.join(" & ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* ── Section: Delivery — CRM + Email ────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Step 4: Where to deliver summaries
              <span className="text-[var(--danger)] ml-0.5">*</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Choose at least one: CRM, Email, or both. You can always download as a file too.
            </p>

            {!hasDelivery && (
              <div className="bg-[var(--danger-light)] border border-[rgba(239,68,68,0.3)] rounded-xl p-3 mb-3">
                <span className="text-xs text-[var(--danger)] font-medium">
                  Please select at least one delivery method (CRM or Email)
                </span>
              </div>
            )}

            {/* Email Toggle */}
            <div className={`mb-4 p-4 rounded-xl border transition-all ${
              emailEnabled
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] bg-[var(--bg-secondary)]"
            }`}>
              <button
                type="button"
                onClick={() => setEmailEnabled(!emailEnabled)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📧</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold">Email Summary</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Send structured summary to one or more email addresses</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${
                  emailEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailEnabled ? "left-5" : "left-1"
                  }`} />
                </div>
              </button>

              {emailEnabled && (
                <div className="mt-4 space-y-3 fade-in">
                  {/* Email recipients */}
                  <div>
                    <label className="text-xs font-medium mb-1.5 block text-[var(--text-secondary)]">
                      Recipients
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); }}}
                        placeholder="email@example.com"
                        className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={addEmail}
                        className="px-3 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-sm font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {emailList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {emailList.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-full px-2.5 py-1 text-xs"
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => removeEmail(email)}
                              className="text-[var(--text-muted)] hover:text-[var(--danger)] ml-0.5"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {emailEnabled && emailList.length === 0 && (
                      <p className="text-[10px] text-[var(--danger)] mt-1">Add at least one email address</p>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* CRM Platform */}
            <div className="grid grid-cols-2 gap-2">
              {CRM_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCrmPlatform(option.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    crmPlatform === option.id
                      ? "border-[var(--accent)] bg-[var(--accent-light)]"
                      : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]"
                  }`}
                >
                  <div className="text-lg mb-0.5">{option.icon}</div>
                  <div className="text-sm font-medium">{option.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{option.description}</div>
                </button>
              ))}
            </div>

            {/* CRM-specific fields */}
            <div className="mt-4">
              {crmPlatform === "google_sheets" && (
                <div className="fade-in">
                  <label className="flex items-center text-sm font-medium mb-1.5">
                    Google Sheets ID
                    <HelpTooltip
                      title="How to get Google Sheets ID"
                      steps={[
                        "Create a new Google Sheet at sheets.google.com",
                        "Add headers in Row 1: Date | Duration | You Spoke | Other Spoke | Transcript | Summary",
                        "Look at the URL in your browser",
                        "Copy the long ID between /d/ and /edit",
                        "Paste that ID here",
                      ]}
                      exampleKey="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                      linkText="Create a new Google Sheet"
                      linkUrl="https://sheets.google.com"
                    />
                  </label>
                  <input
                    type="text"
                    value={googleSheetsId}
                    onChange={(e) => setGoogleSheetsId(e.target.value)}
                    placeholder="1BxiMVs0XRA5nFMd..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    URL format: docs.google.com/spreadsheets/d/<strong className="text-[var(--warning)]">THIS_PART</strong>/edit
                  </p>
                </div>
              )}

              {crmPlatform === "hubspot" && (
                <div className="fade-in">
                  <label className="flex items-center text-sm font-medium mb-1.5">
                    HubSpot API Key
                    <HelpTooltip
                      title="How to get HubSpot API Key"
                      steps={[
                        "Log in to your HubSpot account",
                        "Go to Settings → Integrations → Private Apps",
                        "Click 'Create a private app'",
                        "Give it a name and select CRM scopes",
                        "Copy the access token and paste it here",
                      ]}
                      exampleKey="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      linkText="Open HubSpot Settings"
                      linkUrl="https://app.hubspot.com/settings"
                    />
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.hubspot ? "text" : "password"}
                      value={hubspotKey}
                      onChange={(e) => setHubspotKey(e.target.value)}
                      placeholder="pat-na1-..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] pr-10 transition-colors"
                    />
                    <button type="button" onClick={() => toggleShow("hubspot")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white text-xs">
                      {showPassword.hubspot ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {crmPlatform === "salesforce" && (
                <div className="fade-in">
                  <label className="flex items-center text-sm font-medium mb-1.5">
                    Salesforce Access Token
                    <HelpTooltip
                      title="How to get Salesforce Token"
                      steps={[
                        "Log in to Salesforce",
                        "Go to Setup → Apps → App Manager",
                        "Create a new Connected App with OAuth",
                        "Use the OAuth flow to get an access token",
                        "Paste the access token here",
                      ]}
                      exampleKey="00D5g00000Abc12!ARcAQ..."
                      linkText="Salesforce Developer Docs"
                      linkUrl="https://developer.salesforce.com/docs"
                    />
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.salesforce ? "text" : "password"}
                      value={salesforceToken}
                      onChange={(e) => setSalesforceToken(e.target.value)}
                      placeholder="00D5g00000..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] pr-10 transition-colors"
                    />
                    <button type="button" onClick={() => toggleShow("salesforce")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white text-xs">
                      {showPassword.salesforce ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {crmPlatform === "pipedrive" && (
                <div className="fade-in">
                  <label className="flex items-center text-sm font-medium mb-1.5">
                    Pipedrive API Token
                    <HelpTooltip
                      title="How to get Pipedrive API Token"
                      steps={[
                        "Log in to Pipedrive",
                        "Click your profile icon → Personal Preferences",
                        "Go to the 'API' tab",
                        "Copy your personal API token",
                        "Paste it here",
                      ]}
                      exampleKey="abc123def456ghi789jkl012mno345"
                      linkText="Open Pipedrive Settings"
                      linkUrl="https://app.pipedrive.com/settings/api"
                    />
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.pipedrive ? "text" : "password"}
                      value={pipedriveKey}
                      onChange={(e) => setPipedriveKey(e.target.value)}
                      placeholder="API token..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] pr-10 transition-colors"
                    />
                    <button type="button" onClick={() => toggleShow("pipedrive")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white text-xs">
                      {showPassword.pipedrive ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {crmPlatform === "airtable" && (
                <div className="fade-in space-y-3">
                  <div>
                    <label className="flex items-center text-sm font-medium mb-1.5">
                      Airtable API Key
                      <HelpTooltip
                        title="How to get Airtable API Key"
                        steps={[
                          "Go to airtable.com/create/tokens",
                          "Click 'Create new token'",
                          "Give it a name and add scopes: data.records:write",
                          "Add your base to the access list",
                          "Copy the token and paste it here",
                        ]}
                        exampleKey="patABC123.abcdef1234567890"
                        linkText="Airtable Token Settings"
                        linkUrl="https://airtable.com/create/tokens"
                      />
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword.airtable ? "text" : "password"}
                        value={airtableKey}
                        onChange={(e) => setAirtableKey(e.target.value)}
                        placeholder="patABC123..."
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] pr-10 transition-colors"
                      />
                      <button type="button" onClick={() => toggleShow("airtable")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white text-xs">
                        {showPassword.airtable ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Airtable Base ID</label>
                    <input
                      type="text"
                      value={airtableBaseId}
                      onChange={(e) => setAirtableBaseId(e.target.value)}
                      placeholder="appABC123..."
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--bg-card)] border-t border-[var(--border)] p-6 pt-4 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isOnboarding ? "Get Started" : "Save Settings"}
            </button>
          </div>
          {!canSave && (
            <p className="text-[10px] text-[var(--text-muted)] text-center mt-2">
              {!hasApiKeys ? "Enter all required API keys" : !hasDelivery ? "Select at least one delivery method (CRM or Email)" : "Fill in all email fields"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
