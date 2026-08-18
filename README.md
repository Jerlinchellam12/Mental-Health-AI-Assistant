# Lumin&Us — The Lighthouse Bridge

A wellbeing companion for teenagers and a connection tool for the families around them. Built at the **HealthTech AI Hackathon** for **Beacon ABA Services (UK)**, as Team 5's project *"The Lighthouse Bridge: Multi-agent AI for family co-regulation."*

This repo is my continuation of that project — I took the idea from the hackathon and rebuilt the core experience as a working app (React, Firebase, Gemini) so it's something people can actually click through instead of just reading a slide deck about it.

> ⚠️ **Disclaimer:** This is not a clinical tool and is not a substitute for professional mental health support. If you or someone you know is in crisis, contact Childline (0800 1111, UK) or your GP immediately.

---

## Why we built this

The UK has a growing youth mental health crisis. 1 in 5 young people now have a diagnosable mental health disorder, and half of all conditions start before the age of 14. Meanwhile, CAMHS (the NHS's child mental health service) has an average wait time of 3.5 months, and youth mental health services cost the UK roughly £1 trillion a year.

The clinical pipeline isn't the only gap, though. Research consistently shows that a teenager's mental health is strongly improved by having one good, trusted relationship with an adult — usually a parent or caregiver. The problem is a lot of parents genuinely want to help but don't have the tools, language, or emotional bandwidth to do it well in the moment. They're not the cause of the gap, they're just under-equipped for it.

That's the gap we tried to build for: not another clinical waiting list, but something that sits *between* the teen and the parent, helps the teen feel heard without judgement, and quietly gives the parent something useful to do about it — without ever handing over the teen's actual words.

## The idea

The core concept from the hackathon (the "Lighthouse Bridge") is a **multi-agent system with three roles**, not one chatbot trying to do everything:

1. **Teen Talk** — a chat companion the teen talks to directly. It listens, validates, and responds like a warm older sibling rather than a therapist. At the start of a session the teen does a quick check-in (Safe / Struggling / Drowning), and the agent adjusts its tone accordingly.
2. **Parent Talk** — a completely separate agent that the parent interacts with. It never sees what the teen actually said.
3. **The Bridge** — the piece in the middle. It takes the teen's conversation, strips it down to an anonymous *theme* (like `#school-stress` or `#friendship-conflict`), and that's the only thing that ever crosses over to the parent side. The parent gets a handful of warm, low-effort activity suggestions built around that theme — never a transcript, never a quote, never a paraphrase.

The whole point of splitting it into agents like this is privacy. A teen won't open up if they think their parent is reading it live. A single shared chatbot can't credibly promise that separation — a multi-agent design with a genuine one-way information bridge can.

There's also a safety layer running underneath all of this: if a teen's message signals self-harm, suicide, abuse, or immediate danger, the system stops the casual conversation, signposts Childline (0800 1111) immediately, and quietly flags an "urgent connection" theme to the parent side — again, with zero content shared, just a signal that says *"reach out now."*

## What's actually in this repo vs. what's in the hackathon vision

I want to be upfront about this because the original hackathon report describes a bigger system than what's implemented here — the full pitch included six fine-tuned local models (risk scoring, mood tracking, privacy classification, form-filling for clinical intake, etc.), Azure OpenAI, and Whisper for speech. That was the 48-hour hackathon vision, built to be presented and scored, not shipped.

What's in **this repo** is the part I rebuilt afterward to actually work end-to-end:

- Real Google sign-in and per-user accounts (Firebase Auth)
- A live, persisted chat between teen and AI companion (Firebase Firestore, real-time sync)
- The teen-side companion and parent-side suggestion engine as two separate Gemini prompts with two separate rulesets — not one prompt trying to serve both audiences
- Automatic theme extraction from each teen conversation, so the parent dashboard has something anonymized to work with
- A "heart" feature so teens can save messages that meant something to them, to come back to later
- Voice input (speech-to-text via Gemini) and instant spoken replies (on-device text-to-speech, so there's no lag waiting on a network call)
- A small animated avatar that changes mood/colour based on the teen's check-in state
- Firestore security rules that actually enforce the privacy model at the database level — a teen's messages are only readable by that teen (or an admin), and the `parentThemes` collection deliberately never stores raw text, only theme tags

There's also an earlier, rougher prototype in this repo (`connectai.html`, `connectai.js`, `connectai.css`) called "Buddy Chat" — that's closer to what we actually had running at the hackathon itself, calling out to `/api/child-agent` and `/api/bridge-agent` endpoints for the multi-agent backend our team sketched out. It's kept here for reference but isn't wired into the current app.

**Things that are still demo-grade, not production-grade**, so nobody's surprised:
- The 4-digit PIN screen (teen `0000` / parent `1234`) is a placeholder gate, not real per-family authentication
- Parent–child linking is hardcoded to a single demo parent — in a real deployment, each parent would only ever see themes tied to their own linked teen(s), and that filtering isn't built yet
- The six-local-model risk/privacy pipeline from the hackathon report isn't implemented here — the safety behaviour currently comes entirely from the Gemini system prompt, not from a dedicated risk-scoring model

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend/data:** Firebase (Auth + Firestore), with hand-written security rules
- **AI:** Google Gemini (`gemini-3-flash-preview` for chat/theme extraction, Gemini audio for transcription)
- **Voice:** Browser `MediaRecorder` for capture, native `SpeechSynthesis` for zero-latency replies

## Getting started

```bash
npm install
```

Set `GEMINI_API_KEY` in your environment (or `.env` locally — see `.env.example`).

```bash
npm run dev
```

The app runs on `http://localhost:3000` by default. You'll need a Firebase project of your own (Auth + Firestore enabled) if you want data to actually persist — swap the config in `firebase-applet-config.json` for yours, and deploy `firestore.rules` to it.

## Where things live

```
src/
  App.tsx                    # all the screens: onboarding, teen chat, parent dashboard
  components/Avatar.tsx      # the animated mood avatar
  services/geminiService.ts  # the three Gemini "agents": chat, theme extraction, parent suggestions
  services/voiceService.ts   # speech-to-text + (unused) text-to-speech via Gemini
  firebase.ts                # Firebase init + error handling
firestore.rules              # database-level privacy enforcement
firebase-blueprint.json      # data model reference
connectai.html/js/css        # the original hackathon-day prototype
```

## Roadmap (from the original pitch)

If this ever went further than a hackathon/portfolio project, the plan was:

- **Phase 1 (MVP):** local model hosting, Supabase for auth/storage
- **Phase 2 (Scale):** move models to managed cloud endpoints, add proper NHS Data Security and Protection Toolkit compliance and a GDPR Article 35 DPIA
- **Phase 3 (Distribution):** white-labelled for NHS Trusts and school/academy chains, mobile app via Capacitor, and federated learning so the models improve across deployments without ever centralising sensitive family data

## Credit

Built with my team at the HealthTech AI Hackathon, for Beacon ABA Services (UK). This repo is my personal rebuild of the core idea, done afterward to have something real to point people to.
