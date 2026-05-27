# BeHive — Product Design Document

## Product Vision

BeHive transforms moderation from isolated individual decisions into collective team intelligence. Every mod action teaches the system. Every mod benefits from the team's accumulated wisdom.

---

## User Journeys (Minute-by-Minute)

### Journey 1: First-Time Install (Mod Lead)

**Who:** Head moderator of r/personalfinance (18M members, 12 mods)
**Context:** Tired of users complaining "mods are inconsistent"

1. Finds BeHive in App Directory → clicks Install
2. Sees toast: "🐝 BeHive installed! Learning starts immediately."
3. Opens subreddit menu → "Create BeHive Dashboard" → pinned post appears
4. Opens dashboard → sees "🌱 BeHive is Learning" with 0 decisions
5. Moderates normally for 2 days
6. Returns to dashboard → sees alignment score forming, mod profiles appearing
7. Shares dashboard link in mod Discord: "Check this out"

**Key insight:** Zero friction. No setup wizard. No API keys. No "configure your rules first." Just install and moderate.

---

### Journey 2: Daily Moderation (Experienced Mod)

**Who:** Mid-level mod on r/science, moderates 30 min/day
**Context:** Reviewing reported posts in the queue

1. Opens mod queue, sees a post: "My new study shows..."
2. Thinks: "Is this self-promotion or legitimate research sharing?"
3. Right-clicks → **"See Team Precedent"**
4. Sees form popup:

```
┌─────────────────────────────────────────┐
│ 🧠 Team Precedent                       │
│                                         │
│ Similar content decisions (last 90 days)│
│                                         │
│ ✅ Approved: 3 times                    │
│ ❌ Removed: 1 time                      │
│                                         │
│ Most recent:                            │
│ • u/SeniorMod approved (2 days ago)     │
│ • u/ModB approved (5 days ago)          │
│ • u/ModC removed (12 days ago)          │
│                                         │
│ Verdict: Team leans APPROVE (75%)       │
│                                         │
│ [Got it]                                │
└─────────────────────────────────────────┘
```

5. Approves with confidence. Moves to next item.
6. Total time added: 3 seconds per decision. Confidence gained: immeasurable.

---

### Journey 3: New Mod Onboarding

**Who:** Just added as mod to r/legaladvice (3 days ago)
**Context:** Nervous about making wrong calls

1. Opens the pinned BeHive Dashboard post
2. Clicks "Team" tab → sees all mod profiles with action patterns
3. Notices: senior mods have 60% removal rate, they have 40%
4. Clicks "Rules" tab → sees AI-generated interpretations:
   - "Rule 3 (No legal advice): Your team removes posts that give specific actionable legal guidance. General information about legal processes is approved."
5. Goes to mod queue, right-clicks a borderline post → "See Team Precedent"
6. Sees: "Your team REMOVED 4/5 similar items"
7. Removes with confidence. No need to message senior mod asking "is this okay?"

**Key insight:** Onboarding compressed from weeks of shadowing to minutes of reading patterns.

---

### Journey 4: Calibration Moment (Team Alignment)

**Who:** Two mods on r/cooking who interpret "low-effort" differently
**Context:** Mod A removes recipe screenshots. Mod B approves them.

1. Mod A removes a recipe screenshot post (Tuesday)
2. Mod B approves a similar recipe screenshot post (Thursday)
3. BeHive detects: same fingerprint, different actions, different mods
4. Both mods see in the dashboard "Calibrations" tab:

```
⚡ Calibration Moment
ModA → removed | ModB → approved
Content: "Here's my grandma's pasta recipe [image]"
This is an opportunity to align without a meeting.
```

5. Mod A messages Mod B: "Hey, I've been removing recipe screenshots. Are we keeping those?"
6. They discuss, agree on a standard, update the rule wiki
7. BeHive's alignment score ticks up from 74% to 78%

**Key insight:** Disagreements surface naturally, without blame. The system creates the conversation.

---

### Journey 5: Flagging Uncertainty

**Who:** Any mod encountering a genuinely ambiguous case
**Context:** Post that could go either way

1. Mod sees a post that's borderline Rule 4 violation
2. Checks precedent → "Split: 2 removed, 2 approved"
3. Thinks: "This needs team input"
4. Right-clicks → **"Flag for Calibration"**
5. Sees toast: "🚩 Flagged for team calibration"
6. Other mods see it in the Calibrations tab next time they check
7. Team discusses in their next mod chat → makes a ruling
8. Future similar posts now have clear precedent

---

## Feature Specifications

### Feature 1: Team Precedent (Menu Action)

**Trigger:** Right-click any post or comment → "See Team Precedent"
**Who sees it:** Moderators only
**Response time:** < 2 seconds
**Output:** Rich form showing:
- Number of similar past decisions (approve vs remove)
- Who made each decision and when
- Verdict summary ("Team leans APPROVE 75%")
- Confidence indicator (high/medium/low based on sample size)

**Edge cases:**
- No precedent yet → "BeHive needs more decisions. Keep moderating!"
- Only 1-2 matches → "Limited data (2 similar decisions found)"
- Content too short (< 10 chars) → "Content too short for matching"
- All decisions agree → "Strong consensus: team always removes this type"

---

### Feature 2: Live Dashboard (Custom Post)

**Trigger:** Subreddit menu → "Create BeHive Dashboard"
**Who sees it:** Moderators only (custom post visible to all, but data is mod-only)
**Tabs:**

| Tab | Content | Update Frequency |
|---|---|---|
| Overview | Alignment score, stats cards, recent calibrations | On page load |
| Rules | Rule list + AI interpretations + clarity scores | On page load |
| Team | Mod profiles, action breakdown, removal rates | On page load |
| Calibrations | All disagreements, flagged items, resolution status | On page load |

**Visual design:**
- Dark theme (#1a1a2e background) — matches Reddit dark mode
- Accent color: #4ecdc4 (teal) for positive, #ff6b6b for alerts
- Mobile-first: works on 320px width
- Cards with rounded corners, subtle borders
- No scroll traps (inline mode is tap-to-expand only)

---

### Feature 3: Calibration Detection (Automatic)

**Trigger:** Every `onModAction` event
**Logic:**
1. Compute content fingerprint
2. Search last 7 days of fingerprints for matches
3. If match found with different action + different mod → calibration moment
4. Store with 30-day TTL
5. Increment calibration counter

**Sensitivity tuning:**
- Only triggers on exact fingerprint match (same significant keywords)
- Ignores same-mod decisions (you can't disagree with yourself)
- Ignores same-action decisions (agreement isn't a calibration)
- Rate-limited: max 1 calibration per fingerprint per day

---

### Feature 4: Alignment Score (Scheduled)

**Trigger:** Hourly cron job
**Algorithm:**
1. Get all decisions from last 7 days
2. Group by fingerprint (content similarity)
3. For groups with 2+ decisions from different mods:
   - Count how many agree with the majority action
   - agreements / total = group agreement rate
4. Average across all groups = overall alignment score
5. Store in Redis

**Score interpretation:**
- 90-100%: Excellent — team is highly aligned
- 75-89%: Good — minor calibration opportunities
- 60-74%: Needs attention — significant disagreements
- Below 60%: Critical — team should discuss rules

---

### Feature 5: AI Rule Interpretations (Gemini)

**Trigger:** Weekly cron (when API key is configured)
**Input:** Last 50 decisions per rule + rule text
**Prompt:** "Analyze these moderation decisions and describe in 2-3 sentences how this team interprets this rule. What patterns emerge? What gets removed vs approved?"
**Output:** Plain-English summary stored in Redis
**Fallback:** Feature simply doesn't appear if no API key is set

---

### Feature 6: Flag for Calibration (Manual)

**Trigger:** Right-click any post/comment → "Flag for Calibration"
**Who sees it:** Moderators only
**Effect:**
- Stores flag with content ID, flagger username, timestamp
- Increments calibration counter
- Appears in dashboard Calibrations tab
- Toast confirmation to the flagger

---

## Settings (Per-Subreddit, Mod-Configurable)

| Setting | Type | Default | Purpose |
|---|---|---|---|
| Enable calibration alerts | Boolean | true | Turn off if team doesn't want disagreement tracking |
| Min decisions for precedent | Number | 10 | How many past decisions before showing precedent |
| Gemini API Key | Secret (global) | empty | Required only for AI rule interpretations |

---

## Data Model (Redis)

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `decision:{sub}:{id}` | Hash | 90 days | Individual mod decision record |
| `modprofile:{sub}:{user}` | Hash | None | Mod action statistics |
| `modlist:{sub}` | Hash | None | Active mod roster |
| `fingerprints:{sub}` | Sorted Set | None (members expire via decision TTL) | Content similarity index |
| `alignment:{sub}` | Hash | None | Current alignment score + metadata |
| `calibration:{sub}:{id}` | Hash | 30 days | Individual calibration moment |
| `calibration-count:{sub}` | String | None | Running total of calibrations |
| `interpretations:{sub}` | Hash | None | AI-generated rule interpretations |

**Storage estimate:** ~5MB per active subreddit per month. Well within 500MB limit.

---

## Privacy & Compliance

- Content previews: max 200 characters (not full posts)
- All decision data: 90-day TTL (auto-purge)
- Calibration data: 30-day TTL
- `onPostDelete` / `onCommentDelete`: triggers registered for compliance
- Account deletion: user data removed from modprofiles and modlist
- Gemini API: receives only anonymized decision patterns, never raw content
- No user-facing data stored (only mod actions, which are already in the public modlog)

---

## Why This Approach is Novel

1. **No other tool learns from mod decisions.** AutoMod has static rules. AI classifiers make their own decisions. BeHive learns from YOUR team's decisions.

2. **Precedent-based, not rule-based.** Instead of "does this match Rule 3?", BeHive asks "how has your team handled this before?" Case law, not statute law.

3. **Alignment as a metric.** No mod tool has ever quantified team consistency. BeHive makes it a number you can track, improve, and celebrate.

4. **Calibration without confrontation.** Disagreements are surfaced as "moments" not "mistakes." The language is neutral. The system creates conversations, not conflicts.

5. **Zero-config intelligence.** Most mod tools require extensive setup. BeHive works from the first mod action. The more you use it, the smarter it gets.
