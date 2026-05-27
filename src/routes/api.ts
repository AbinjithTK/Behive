import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';

export const api = new Hono();

/**
 * GET /api/alignment — Dashboard overview data
 */
api.get('/alignment', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const data = await redis.hGetAll(`alignment:${subreddit.name}`);
  return c.json(data || { overallScore: '0', status: 'learning', totalDecisions: '0' });
});

/**
 * GET /api/team — Mod team profiles
 */
api.get('/team', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const modList = await redis.hGetAll(`modlist:${subreddit.name}`);
  const profiles: any[] = [];

  if (modList) {
    for (const username of Object.keys(modList)) {
      try {
        const profile = await redis.hGetAll(`modprofile:${subreddit.name}:${username}`);
        if (profile) {
          profiles.push({ username, ...profile });
        }
      } catch { /* skip */ }
    }
  }

  // Sort by total actions descending
  profiles.sort((a, b) => parseInt(b.totalActions || '0') - parseInt(a.totalActions || '0'));
  return c.json({ team: profiles });
});

/**
 * GET /api/calibrations — Recent disagreements
 */
api.get('/calibrations', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;

  // Scan for calibration keys (we store them with known prefix patterns)
  // Since Redis doesn't support key listing, we use the calibration counter
  // and reconstruct from known patterns
  const calibrations: any[] = [];

  // Try to get recent calibrations from the fingerprint index
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  try {
    const recent = await redis.zRange(`fingerprints:${subredditName}`, weekAgo, now, { by: 'score' });

    // Group by fingerprint to find disagreements
    const groups = new Map<string, Array<{ id: string; action: string; mod: string; preview: string; ts: string }>>();

    for (const entry of recent.slice(-100)) {
      const parts = entry.member.split(':');
      const decId = parts[0] || '';
      const fp = parts[1] || '';
      if (!fp || fp === 'empty') continue;

      try {
        const decision = await redis.hGetAll(`decision:${subredditName}:${decId}`);
        if (decision && decision.action && decision.moderator) {
          const existing = groups.get(fp) || [];
          existing.push({
            id: decId,
            action: decision.action,
            mod: decision.moderator,
            preview: decision.contentPreview || '',
            ts: decision.timestamp || '0',
          });
          groups.set(fp, existing);
        }
      } catch { /* skip */ }
    }

    // Find groups with disagreements
    for (const [, decisions] of groups) {
      if (decisions.length < 2) continue;
      const actions = new Set(decisions.map(d => d.action));
      if (actions.size < 2) continue;

      // Found a disagreement
      const sorted = decisions.sort((a, b) => parseInt(b.ts) - parseInt(a.ts));
      const first = sorted[0]!;
      const second = sorted.find(d => d.action !== first.action);
      if (!second) continue;

      calibrations.push({
        modA: first.mod,
        actionA: first.action,
        modB: second.mod,
        actionB: second.action,
        contentPreview: first.preview,
        timestamp: first.ts,
      });
    }
  } catch { /* skip */ }

  return c.json({ calibrations: calibrations.slice(0, 20) });
});

/**
 * GET /api/rules — Subreddit rules + interpretations
 */
api.get('/rules', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  let rules: any[] = [];
  try {
    rules = await subreddit.getRules();
  } catch { /* rules API may not be available */ }

  let interpretations: Record<string, string> = {};
  try {
    interpretations = await redis.hGetAll(`interpretations:${subreddit.name}`) || {};
  } catch { /* skip */ }

  return c.json({ rules, interpretations });
});

/**
 * GET /api/streak — Alignment streak (days above target)
 */
api.get('/streak', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const streakStr = await redis.get(`streak:${subreddit.name}`);
  return c.json({ streak: parseInt(streakStr || '0') });
});

/**
 * GET /api/stats — Summary stats for the dashboard header
 */
api.get('/stats', async (c) => {
  const subreddit = await reddit.getCurrentSubreddit();
  const name = subreddit.name;

  const alignment = await redis.hGetAll(`alignment:${name}`);
  const calCount = await redis.get(`calibration-count:${name}`);
  const modList = await redis.hGetAll(`modlist:${name}`);
  const streak = await redis.get(`streak:${name}`);

  return c.json({
    alignmentScore: alignment?.overallScore || '0',
    status: alignment?.status || 'learning',
    totalDecisions: alignment?.totalDecisions || '0',
    modCount: modList ? Object.keys(modList).length : 0,
    calibrationCount: calCount || '0',
    streak: streak || '0',
  });
});
