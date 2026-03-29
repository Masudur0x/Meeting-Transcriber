# Meeting Transcriber — SaaS Conversion Roadmap

> This document outlines everything needed to convert the current "bring your own API key" tool into a full SaaS product where users subscribe, log in, and start using — no setup required from their side.

---

## Current State (What's Built)

- [x] Multi-provider transcription (OpenAI Whisper, Groq, Gemini)
- [x] Multi-provider summarization (Claude, GPT-4o, Gemini, Deepseek)
- [x] Browser meeting recording (mic + tab audio)
- [x] Desktop app recording (via virtual audio driver)
- [x] CRM integrations (Google Sheets, HubSpot, Salesforce, Pipedrive, Airtable)
- [x] Meeting results with copy/download
- [x] Deployable to Vercel

**How it works now:** Each user provides their own API keys. No database. No login. Everything stored in browser localStorage.

**How SaaS will work:** Users subscribe → log in → click record. We handle everything behind the scenes.

---

## What You Need Before Building

### 1. Accounts to Create

| Account | Purpose | Cost | Link |
|---------|---------|------|------|
| **Vercel Pro** | Hosting (needed for long function timeouts) | $20/mo | vercel.com |
| **Supabase** | Database + Auth (Google/email login) | Free tier works to start | supabase.com |
| **Stripe** | Payment processing | 2.9% + $0.30 per transaction | stripe.com |
| **OpenAI** | Whisper transcription API | Pay as you go | platform.openai.com |
| **Groq** | Cheaper transcription option | Pay as you go | console.groq.com |
| **Google AI Studio** | Gemini API (cheapest option) | Pay as you go | aistudio.google.com |
| **Anthropic** | Claude summarization API | Pay as you go | console.anthropic.com |
| **Deepseek** | Budget summarization option | Pay as you go | platform.deepseek.com |
| **Cloudflare R2** or **AWS S3** | Audio file storage (optional) | ~$0.015/GB/mo | cloudflare.com or aws.amazon.com |
| **Resend** or **SendGrid** | Transactional emails (welcome, receipts) | Free tier works to start | resend.com or sendgrid.com |
| **Domain name** | Your product URL (e.g., meetscribe.com) | ~$12/year | namecheap.com or cloudflare.com |

### 2. API Keys to Collect

Once you have the accounts, you'll need these keys stored as Vercel environment variables:

```env
# Auth (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...

# AI Providers (your keys, not users')
OPENAI_API_KEY=sk-proj-...
GROQ_API_KEY=gsk_...
GOOGLE_GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# Email (optional)
RESEND_API_KEY=re_...

# Storage (optional, for saving recordings)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET_NAME=meeting-recordings
```

### 3. Stripe Products to Set Up

Create these in your Stripe dashboard:

**Product: Meeting Transcriber**

| Plan | Price | Limits | Stripe Price ID |
|------|-------|--------|-----------------|
| **Free** | $0/mo | 3 meetings/month, max 30 min each, Gemini only | (no Stripe needed) |
| **Basic** | $15/mo | 20 meetings/month, max 2 hours, Groq + Gemini | Create in Stripe |
| **Pro** | $29/mo | Unlimited meetings, all providers, priority processing | Create in Stripe |
| **Team** | $49/mo | Everything in Pro + 5 team members, shared workspace | Create in Stripe (future) |

### 4. Supabase Setup

**Google OAuth (for "Sign in with Google"):**
1. Go to console.cloud.google.com
2. Create OAuth 2.0 credentials
3. Add authorized redirect: `https://xxxxx.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret into Supabase → Auth → Providers → Google

**Database tables to create (I'll build these, but for reference):**

```
users
├── id (from Supabase auth)
├── email
├── name
├── avatar_url
├── plan (free / basic / pro / team)
├── stripe_customer_id
├── meetings_this_month
├── created_at

meetings
├── id
├── user_id → users.id
├── date
├── duration_seconds
├── you_spoke_seconds
├── other_spoke_seconds
├── transcript (text)
├── summary (text)
├── transcription_provider
├── summarization_provider
├── status (processing / completed / failed)
├── created_at

subscriptions
├── id
├── user_id → users.id
├── stripe_subscription_id
├── plan
├── status (active / canceled / past_due)
├── current_period_start
├── current_period_end
├── created_at
```

---

## Build Order

### Phase 1: Login System (Waiting on Tim's confirmation)

**You do:**
- [ ] Get confirmation from Tim on which Google account to use (Wicflow or separate)
- [ ] Create Supabase account at supabase.com using that account
- [ ] Create a new Supabase project
- [ ] Set up Google OAuth credentials in Google Cloud Console (guided walkthrough)
- [ ] Share Supabase project URL and keys

**I build:**
- [ ] Google login (Sign in with Google)
- [ ] Email/password login (sign up, sign in, forgot password)
- [ ] Protected pages (only logged-in users can access the transcriber)
- [ ] User profile stored in database

### Phase 2: Server-Side API Keys

**You do:**
- [ ] Add your AI API keys (OpenAI, Groq, Anthropic, etc.) to Vercel environment variables

**I build:**
- [ ] Move all AI calls to the backend (users never see or need API keys)
- [ ] Remove the BYOK (bring your own key) settings panel

### Phase 3: Meeting History & Auto-Cleanup

**I build:**
- [ ] Save summaries to Supabase after each meeting
- [ ] Auto-send summary to user's email/CRM
- [ ] Auto-delete summaries after 24hrs or 7 days (configurable)
- [ ] Dashboard where users see recent meetings

**Key decisions made:**
- No audio/recording storage (saves cost)
- No long-term transcript storage — transcript used only during processing, then discarded
- Summaries stored temporarily, auto-sent to email/CRM, then auto-deleted

### Phase 4: Payment Connection (via Wicflow website)

**You/Tim do:**
- [ ] Set up pricing on Wicflow website
- [ ] Provide how Wicflow sends payment notifications (webhook, n8n, etc.)

**I build:**
- [ ] Webhook endpoint that receives "user paid" signal from Wicflow
- [ ] Auto-create user account and mark as active in Supabase
- [ ] Send "welcome, set your password" email to new users
- [ ] Only paid users can access the transcriber

**Key decisions made:**
- No Stripe inside the transcriber — payments handled entirely on the Wicflow website
- Wicflow payment triggers a webhook → Supabase creates/activates the user
- Individual users only (no team features in v1, can add later if needed)

### Phase 5: Domain & Polish

**You/Tim do:**
- [ ] Decide domain (e.g. transcriber.wicflow.com or separate domain)
- [ ] Point DNS to Vercel

**I build:**
- [ ] Landing page (features, link to Wicflow to purchase)
- [ ] Onboarding flow for first-time users
- [ ] Usage stats in settings page

### Phase 6: Growth (Future)
14. **Team features** — Invite members, shared meeting library (if demand exists)
15. **Admin dashboard** — Revenue, users, usage analytics
16. **Meeting search** — Full-text search across recent summaries
17. **Integrations** — Auto-push to Slack, Notion, CRM after each meeting
18. **Calendar sync** — Auto-start recording for scheduled meetings
19. **Custom branding** — White-label option for agencies

---

## Monthly Cost Estimate (Your Operating Costs)

### With 0-50 users (early stage)
| Item | Cost |
|------|------|
| Vercel Pro | $20/mo |
| Supabase (free tier) | $0 |
| Domain | ~$1/mo |
| AI API costs (50 users × 10 meetings × $0.15 avg) | ~$75/mo |
| **Total** | **~$96/mo** |

### With 100 users
| Item | Cost |
|------|------|
| Vercel Pro | $20/mo |
| Supabase Pro | $25/mo |
| AI API costs | ~$150/mo |
| **Total** | **~$195/mo** |
| **Revenue (if 30% paid at $15)** | **~$450/mo** |

### With 500 users
| Item | Cost |
|------|------|
| Vercel Pro | $20/mo |
| Supabase Pro | $25/mo |
| AI API costs | ~$750/mo |
| Cloudflare R2 storage | ~$5/mo |
| **Total** | **~$800/mo** |
| **Revenue (if 30% paid, mix of plans)** | **~$3,000/mo** |

---

## Pricing Strategy Advice

- **Free tier is essential** — lets people try before buying, builds trust
- **$15/mo Basic** — covers your AI costs per user (~$2-3) with healthy margin
- **$29/mo Pro** — power users who want the best quality (OpenAI + Claude)
- **Annual discount** — offer 2 months free for yearly billing (increases retention)
- **Compare to competitors:** Otter.ai is $17/mo, Fireflies is $19/mo, Fathom is $24/mo

---

## Decisions Made

1. **No audio storage** — recordings are not saved, keeps costs near zero
2. **No long-term transcript storage** — transcript is used during processing only, then discarded
3. **Temporary summary storage** — summaries saved briefly, auto-sent to email/CRM, then auto-deleted (24hrs or 7 days)
4. **No team features in v1** — individual users only, team features added later if demand exists
5. **No Stripe in the transcriber** — payments handled on Wicflow website, webhook notifies Supabase to activate users
6. **Web app only** — no desktop app for now, can add later if needed

## Decisions Still Needed

1. **Product name?** — "Meeting Transcriber" or something catchier (MeetScribe, RecapAI, etc.)
2. **Pricing?** — $10 one-time or monthly subscription — to be decided with Tim
3. **Domain?** — transcriber.wicflow.com or separate domain
4. **Which Google account?** — Wicflow or separate (waiting on Tim)

---

## Quick Start Checklist (Phase 1 — Login System)

- [ ] Get Tim's confirmation on which Google account to use
- [ ] Create Supabase account and project
- [ ] Set up Google OAuth credentials in Google Cloud Console
- [ ] Share Supabase URL + keys
- [ ] Tell me "let's build" and I'll start Phase 1

---

*Last updated: March 2026*
*Current version: BYOK (Bring Your Own Key) — ready for personal use and deployment*
