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

## Build Order (When You're Ready)

### Phase 1: Core SaaS (Week 1-2)
1. **Auth system** — Supabase auth with Google + email login
2. **Database** — Users + meetings tables
3. **Server-side API keys** — Move all AI keys to environment variables, remove client-side key input
4. **Meeting storage** — Save transcripts and summaries to database
5. **Dashboard** — Meeting history page with search

### Phase 2: Payments (Week 2-3)
6. **Stripe integration** — Checkout page, subscription management
7. **Plan enforcement** — Track usage, enforce limits per plan
8. **Billing portal** — Users can manage/cancel subscription
9. **Webhooks** — Handle payment success, failure, cancellation

### Phase 3: Polish (Week 3-4)
10. **Landing page** — Marketing page with pricing, features, testimonials
11. **Onboarding flow** — Welcome email, guided first meeting
12. **Settings page** — Profile, plan info, usage stats
13. **Email notifications** — Welcome, payment receipts, usage warnings

### Phase 4: Growth (Month 2+)
14. **Team features** — Invite members, shared meeting library
15. **Admin dashboard** — Revenue, users, usage analytics
16. **Audio storage** — Option to save and replay recordings
17. **Meeting search** — Full-text search across all transcripts
18. **Integrations** — Auto-push to Slack, Notion, CRM after each meeting
19. **Calendar sync** — Auto-start recording for scheduled meetings
20. **Custom branding** — White-label option for agencies

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

## Decisions You Need to Make Before SaaS Build

1. **Product name?** — "Meeting Transcriber" works, but something catchier helps marketing (e.g., MeetScribe, RecapAI, NoteBot)

2. **Which AI providers per plan?**
   - Free: Gemini only (cheapest for you)
   - Basic: Groq + Gemini (good quality, affordable)
   - Pro: All providers, user picks (premium feel)

3. **Store recordings or not?**
   - Yes = higher storage costs, but users can replay meetings
   - No = cheaper, but transcript only (no going back to listen)

4. **Team features in v1?**
   - Simpler to launch without teams, add later
   - But teams = higher revenue per account ($49 vs $15)

5. **Free trial or free tier?**
   - Free tier (3 meetings/mo forever) = steady funnel
   - 14-day free trial of Pro = faster conversion but more churn

---

## Quick Start Checklist

When you're ready to build SaaS, do these first:

- [ ] Create Supabase account and project
- [ ] Create Stripe account and verify business
- [ ] Set up Stripe products and prices (Basic $15, Pro $29)
- [ ] Get Google OAuth credentials (for "Sign in with Google")
- [ ] Buy a domain name
- [ ] Fund your AI provider accounts ($50-100 each to start)
- [ ] Upgrade Vercel to Pro plan
- [ ] Tell me "let's build the SaaS" and I'll start with Phase 1

---

*Last updated: March 2026*
*Current version: BYOK (Bring Your Own Key) — ready for personal use and deployment*
