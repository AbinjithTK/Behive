# Privacy Policy — BeHive

**Last updated:** May 28, 2026

## What BeHive Collects

BeHive collects the following data when moderators take actions in subreddits where it is installed:

- **Moderator username** — to attribute decisions and build mod profiles
- **Action type** — approve, remove, ban, lock (from the public mod log)
- **Content preview** — first 200 characters of moderated content (for similarity matching)
- **Content fingerprint** — a hash of normalized keywords (not reversible to original content)
- **Timestamp** — when the action occurred

## What BeHive Does NOT Collect

- Full post or comment text (only 200-character previews)
- User votes, subscriptions, or browsing history
- Private messages or DMs
- Personal information of non-moderator users
- IP addresses or device information

## How Data Is Used

- **Precedent matching:** Finding similar past decisions to help mods make consistent choices
- **Alignment scoring:** Calculating team consistency metrics
- **Calibration detection:** Identifying when mods disagree on similar content
- **AI rule interpretations (optional):** Summarizing team decision patterns

## Data Retention

| Data Type | Retention Period |
|---|---|
| Decision records | 90 days (auto-deleted) |
| Calibration moments | 30 days (auto-deleted) |
| Mod profiles | Until account deletion or app uninstall |
| Rule interpretations | Until regenerated (weekly) |
| Alignment scores | Overwritten hourly |

## Data Deletion

- **Post/comment deletion:** When content is deleted on Reddit, associated previews are covered by the 90-day TTL and will auto-expire.
- **Account deletion:** When a Reddit account is deleted, all associated moderator profile data is removed.
- **App uninstall:** When BeHive is uninstalled from a subreddit, all Redis data for that installation is automatically purged by the Devvit platform.

## Third-Party Services

BeHive optionally connects to the following services **only when configured by moderators:**

- **Google Gemini API** (`generativelanguage.googleapis.com`) — for generating rule interpretation summaries
- **OpenAI API** (`api.openai.com`) — for generating rule interpretation summaries

When AI features are enabled:
- Only anonymized decision patterns are sent (action type + 200-char content preview)
- No usernames, user IDs, or personal data is sent to AI providers
- Moderators provide their own API keys
- No Reddit data is used for AI model training

When AI features are disabled (default), no data is sent to any third party.

## Data Storage

All data is stored in Devvit's Redis infrastructure, which is:
- Isolated per subreddit installation (no cross-subreddit data sharing)
- Hosted on Reddit's infrastructure
- Subject to Reddit's security practices

## Moderator Access

Only moderators of the subreddit where BeHive is installed can:
- View the alignment dashboard
- See team precedent data
- Access mod profiles and calibration moments
- Configure app settings

Regular community members cannot access any BeHive data.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above and in the GitHub repository.

## Contact

For privacy questions or data deletion requests, contact via:
- GitHub Issues: [github.com/AbinjithTK/Behive/issues](https://github.com/AbinjithTK/Behive/issues)
- Reddit: u/ABINJITHTK
