# 🐝 BeHive — Collective Intelligence for Mod Teams

> Your team's judgment, amplified.

BeHive turns every moderation decision into team knowledge. It learns how your mod team interprets your rules, detects disagreements for calibration, and gives every moderator instant access to the team's shared judgment.

## Features

### 🧠 See Team Precedent
Right-click any post or comment → "See Team Precedent." Instantly see how your team has handled similar content: approval/removal breakdown, confidence level, recent history with mod names and timestamps.

### 📊 Live Alignment Dashboard
A pinned interactive post showing:
- **Alignment Score** (0-100%) — how consistently your team decides
- **Mod Profiles** — action breakdown per moderator
- **Rule Clarity** — which rules your team agrees on vs. needs discussion
- **Calibration Moments** — every disagreement, surfaced neutrally
- **Streak Tracking** — consecutive hours above 75% alignment

### 🚩 Calibration Detection
When two mods handle similar content differently, BeHive detects it automatically. Creates alignment opportunities without meetings or confrontation.

### 🎓 New Mod Onboarding
New mods see years of institutional knowledge from day one through the dashboard's team patterns and rule interpretations.

### 🤖 AI Rule Interpretations (Optional)
Weekly AI-generated summaries of how your team applies each rule. Supports Google Gemini and OpenAI. Mods provide their own API key.

### 🚩 Flag for Calibration
Unsure about a decision? Flag it for team discussion with one click.

## Installation

1. Visit [developers.reddit.com/apps/be-hive](https://developers.reddit.com/apps/be-hive)
2. Click Install on your subreddit
3. Moderate normally — BeHive learns automatically
4. After ~5 decisions, right-click any content → "See Team Precedent"
5. Create the dashboard: subreddit menu → "Create BeHive Dashboard"

## Configuration

After installation, go to your subreddit's app settings:

| Setting | Description | Default |
|---|---|---|
| AI Provider | None / Google Gemini / OpenAI | None |
| AI API Key | From aistudio.google.com or platform.openai.com | (empty) |
| Calibration Detection | Detect mod disagreements automatically | Enabled |
| Min Decisions for Precedent | Past decisions needed before showing precedent | 5 |
| Weekly AI Interpretations | Generate rule interpretation summaries | Enabled |

## How It Works

1. **Every mod action** (approve, remove, ban, lock) triggers the learning engine
2. **Content fingerprinting** groups similar content without LLM calls
3. **Precedent matching** finds past decisions on similar content instantly
4. **Disagreement detection** compares actions across mods on similar content
5. **Alignment scoring** (hourly) measures team consistency
6. **AI interpretations** (weekly, optional) summarize rule application patterns

## Fetch Domains

- `generativelanguage.googleapis.com` — Google Gemini API (rule interpretations)
- `api.openai.com` — OpenAI API (rule interpretations)

Both are optional. Core features work without any API key.

## Privacy

- Only stores 200-character content previews (not full posts)
- All decision data has 90-day TTL (auto-purge)
- Calibration data has 30-day TTL
- Respects post/comment deletion triggers
- Account deletions remove all associated data
- AI APIs receive only anonymized decision patterns
- See full [Privacy Policy](https://github.com/AbinjithTK/Behive/blob/main/PRIVACY.md)

## Terms

See [Terms of Service](https://github.com/AbinjithTK/Behive/blob/main/TERMS.md)

## Tech Stack

- Devvit 0.13 (Devvit Web)
- TypeScript + Hono (server)
- React 19 (dashboard UI)
- Redis (state storage)
- Vite (build)
- Google Gemini / OpenAI (optional AI features)

## License

BSD-3-Clause

## Links

- [GitHub](https://github.com/AbinjithTK/Behive)
- [Privacy Policy](https://github.com/AbinjithTK/Behive/blob/main/PRIVACY.md)
- [Terms of Service](https://github.com/AbinjithTK/Behive/blob/main/TERMS.md)
