## Inspiration

We started with a question that no existing mod tool answers: **"Am I making the right call?"**

Every mod tool on the market solves throughput — process items faster, auto-remove spam, clear the queue. But academic research (arxiv 2025: "Understanding How Reddit Moderators Use the Modqueue") revealed something surprising: moderators care about **fairness and accuracy** more than speed. The real pain isn't volume. It's isolation.

A moderator removes a post at 2am. They're alone. They wonder: "Would my co-mods agree? Am I being too strict? Too lenient?" There's no way to know. When users complain about "inconsistent moderation," they're right — because each mod is making decisions in a vacuum.

We watched this pattern repeat across communities:
- **r/science** (1500+ mods): New mods take weeks to understand what "peer-reviewed source" means to THIS team
- **r/personalfinance** (18M members): "No self-promotion" means different things to different mods — users notice
- **Growing subs (10K-500K)**: A senior mod leaves, and years of institutional judgment vanish overnight

The name "BeHive" is intentional. Bees make collective decisions. A hive mind. And it sounds like "behave" — because when a team is aligned, the community behaves better too.

---

## What it does

BeHive is a **collective intelligence engine** for Reddit mod teams. It turns every moderation decision into team knowledge, surfaces disagreements for calibration, and gives every mod — new or veteran — instant access to the team's shared judgment.

### Core Features

**🧠 Team Precedent (Right-Click Any Content)**
The killer feature. Right-click any post or comment → "See Team Precedent" → instantly see: "Your team REMOVED 4/5 similar items." No more guessing. No more second-guessing. You know exactly how your team handles this type of content.

**📊 Live Alignment Dashboard (Custom Post)**
A pinned interactive post showing your team's health in real-time:
- **Alignment Score (0-100%)**: One number showing how consistently your team makes decisions. Gamifies fairness.
- **Mod Profiles**: Each mod's action breakdown — removal rates, approval patterns, activity levels
- **Rule Clarity Scores**: Which rules your team agrees on (94% for "Be Civil") and which need discussion (61% for "No Self-Promo")
- **Calibration Timeline**: Every disagreement, visualized

**🚩 Calibration Moments (Automatic)**
When Mod A removes something similar to what Mod B approved last week, BeHive detects it automatically. Both mods see it. This creates natural alignment without meetings, without Discord arguments, without anyone feeling called out.

**🎓 New Mod Onboarding**
A new mod joins your team. Instead of weeks of shadowing, they open the dashboard and see: "Your team has made 2,000 decisions. Here's how they interpret each rule." Instant institutional memory.

**📏 AI Rule Interpretations (Gemini-Powered)**
Weekly, BeHive analyzes your team's decisions and generates plain-English summaries: "Based on 180 decisions, your team interprets 'low-effort' as: posts under 50 words, screenshot-only posts, and questions answered in the FAQ." Rules stop being ambiguous.

**🏷️ Flag for Calibration (Manual)**
Unsure about a decision? Right-click → "Flag for Calibration." Your team gets notified. Creates a structured discussion point without the drama of "why did you remove my post?"

### How It Works for Different Communities

| Community Type | Pain Point | How BeHive Helps |
|---|---|---|
| Large subs (1M+) | 20+ mods, inconsistent enforcement | Alignment score reveals drift before users complain |
| Mid-size (50K-500K) | 3-5 mods, no formal training | Precedent feature = instant training for every decision |
| Growing subs | Adding new mods frequently | Onboarding tab = weeks of shadowing compressed to minutes |
| Niche/strict subs | Complex rules, edge cases | Rule interpretations make ambiguity visible and fixable |
| Multi-timezone teams | Mods never overlap, can't discuss | Calibration moments create async alignment |

---

## How we built it

**Architecture: Devvit Web (React + Hono + TypeScript)**

```
src/
├── client/          # React dashboard (mobile-first, dark mode)
│   ├── App.tsx      # 4-tab dashboard: Overview, Rules, Team, Calibrations
│   └── index.html   # Custom post entry point
├── server/          # Hono API server
│   ├── routes/
│   │   ├── triggers.ts    # onModAction learning engine
│   │   ├── menu.ts        # Precedent, Calibration, Alignment actions
│   │   ├── scheduler.ts   # Hourly alignment + calibration detection
│   │   └── api.ts         # Dashboard data endpoints
│   └── core/
│       └── hivemind.ts    # Fingerprinting + similarity engine
└── devvit.json            # Full config: triggers, scheduler, menu, settings
```

**The Learning Engine (Zero-Config)**
Every `onModAction` trigger fires our learning pipeline:
1. Extract content + moderator + action type
2. Generate a content fingerprint (normalized keyword hash for similarity grouping)
3. Store decision in Redis with 90-day TTL
4. Update mod profile statistics
5. Check for disagreements with recent similar decisions
6. If disagreement found → store calibration moment

**Content Fingerprinting**
We built a lightweight similarity engine that doesn't require embeddings or LLM calls. It normalizes content (lowercase, remove URLs/usernames, filter stop words), extracts the 8 most significant terms, sorts them, and hashes. Two pieces of content with the same fingerprint are "similar enough" that a decision on one is relevant precedent for the other. Fast, free, runs on every single mod action.

**Alignment Score Algorithm**
Every hour, the scheduler groups recent decisions by fingerprint. For groups where multiple mods acted on similar content, it calculates agreement rate. 100% = perfect consensus. 50% = coin flip. The score is a single, actionable number that tells a mod team "we're aligned" or "we need to talk."

**Tech Stack**
- Devvit 0.13 (latest) with Hono server framework
- React 19 for the interactive dashboard
- Redis for all state (sorted sets for fingerprint index, hashes for decisions/profiles)
- Google Gemini API for rule interpretation generation
- Vite for build tooling

---

## Challenges we ran into

**1. Similarity without embeddings**
Our first approach used OpenAI embeddings for content similarity. But that meant an API call on every single mod action — expensive, slow, and a dependency for the core feature. We pivoted to fingerprint-based similarity: deterministic, instant, zero-cost. It's coarser than embeddings but perfectly adequate for "is this the same type of content?" matching.

**2. The ModAction payload**
The `onModAction` trigger payload isn't well-documented for the new Devvit Web architecture. We had to reverse-engineer the shape through playtest logging — discovering that `moderator.name`, `action`, `target.body`, `target.title`, and `subreddit.name` are the fields we needed.

**3. Redis without key listing**
Devvit's Redis doesn't support `KEYS` or `SCAN` for listing all keys. This meant we couldn't just "get all calibrations." We solved it by maintaining explicit indexes: a sorted set of fingerprints (scored by timestamp) and a hash of mod usernames. Every query is O(1) or O(n) on a known set.

**4. Making disagreement detection non-confrontational**
Early designs showed "Mod X was WRONG." That's toxic. We reframed everything as "calibration moments" — neutral language that says "your team might want to discuss this" rather than "someone made a mistake." The UX is designed to build trust, not blame.

**5. Icon size constraints**
Devvit requires icons between 256x256 and 500KB. Our designer's original was 939KB. We had to compress without losing the hexagonal hive-mind concept at small sizes.

---

## Accomplishments that we're proud of

**Zero-config value delivery.** Install BeHive, and it starts learning immediately. No API keys needed for the core features. No configuration. No "set up your rules first." Just moderate normally, and BeHive builds your team's collective memory in the background.

**The "See Team Precedent" moment.** The first time a mod right-clicks a post and sees "Your team REMOVED 4/5 similar items" — that's the moment they understand. They're not alone anymore. Their team's judgment is right there, one click away.

**Research-backed design.** We didn't build what we thought mods wanted. We read the academic literature (3 papers from 2025 on Reddit moderation workflows), identified the actual gap (consistency > throughput), and built for that. Every feature maps to a documented pain point.

**Mobile-first dashboard.** The React dashboard works beautifully on phones. Mods can check team alignment from anywhere. The dark theme, tap-friendly cards, and responsive layout make it feel native.

**Privacy-first architecture.** We only store 200-character content previews (not full posts). Everything has 90-day TTL. Deletion triggers purge data. Account deletions are respected. The Gemini API only receives anonymized decision patterns, never raw user content.

**The name.** "BeHive" = collective intelligence (hive mind) + behavior alignment (behave). It's a mod tool that helps communities behave better by helping mod teams think together.

---

## What we learned

**Mods don't want AI to replace them. They want AI to help them agree.**

Every other hackathon entry we saw was building "AI that auto-moderates." But mods told us (through research and feedback): they don't trust black-box automation. They want to make the decisions. They just want confidence that their decisions are consistent with their team.

**The smallest useful unit is one decision.** We originally planned complex features (real-time collaborative queues, live presence indicators). But the most impactful thing turned out to be the simplest: recording one decision, matching it to similar past decisions, and showing the result in a toast message. That's it. That's the product.

**Fingerprinting beats embeddings for this use case.** We don't need to know that two posts are semantically similar. We need to know they're "the same type of rule-breaking content." A simple keyword hash does that perfectly, with zero latency and zero cost.

**Gamification works on mod teams.** The alignment score (0-100%) creates a subtle competitive dynamic. Teams want to improve it. They start discussing edge cases proactively. The number itself drives the behavior change.

---

## What's next for BeHive

**Realtime Collaboration**
Using Devvit's Realtime API to push calibration alerts live to all connected mods. When a disagreement is detected, every mod with the dashboard open sees it instantly — no refresh needed.

**Gemini Rule Interpretation Engine**
Weekly automated analysis of decision patterns per rule. "Based on 340 decisions this month, your team's interpretation of Rule 4 has shifted: you're now approving blog links if they include original commentary." Makes rule drift visible.

**Cross-Subreddit Insights (Opt-in)**
For mod teams that moderate multiple related subreddits, share alignment patterns across communities. "Your r/science team is 92% aligned but your r/askscience team is only 67% — here's where they diverge."

**Mod Confidence Indicator**
Before a mod takes action, show a subtle indicator: "High confidence — your team consistently removes this type of content" or "Edge case — your team is split on this. Consider flagging for calibration."

**Appeal Integration**
When a user appeals a removal, show the mod handling the appeal: "This was removed by Mod A. 3 similar items were also removed by other mods. Team consensus: remove." Gives the appeals mod confidence to uphold — or data to overturn.

**Onboarding Quizzes**
Generate practice scenarios from real past decisions: "Your team saw this post. What did they do?" New mods can calibrate their judgment before touching the live queue.

**Reddit Developer Funds**
BeHive is designed for long-term engagement. Every mod action makes it smarter. Every new mod benefits from all past decisions. We're building toward the Developer Funds engagement milestones to sustain development beyond the hackathon.
