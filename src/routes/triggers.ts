import { Hono } from 'hono';
import { redis } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { generateFingerprint, TRACKABLE_ACTIONS, normalizeAction } from '../core/hivemind';

export const triggers = new Hono();

/**
 * onModAction — The Learning Engine
 * Records every mod decision as team knowledge.
 */
triggers.post('/on-mod-action', async (c) => {
  const input = await c.req.json<{
    moderator?: { name?: string };
    action?: string;
    target?: { id?: string; body?: string; title?: string; author?: string };
    subreddit?: { name?: string };
  }>();

  const moderator = input.moderator?.name;
  const action = input.action;

  if (!moderator || !action) return c.json<TriggerResponse>({ status: 'ignored' });
  if (!TRACKABLE_ACTIONS.includes(action)) return c.json<TriggerResponse>({ status: 'ignored' });
  if (moderator === 'be-hive') return c.json<TriggerResponse>({ status: 'ignored' });

  const target = input.target;
  const subredditName = input.subreddit?.name || 'unknown';
  const contentId = target?.id || '';
  const contentBody = target?.body || target?.title || '';
  const contentPreview = contentBody.substring(0, 200);
  const contentType = target?.title ? 'post' : 'comment';
  const normalized = normalizeAction(action);
  const fingerprint = generateFingerprint(contentPreview);
  const timestamp = Date.now();
  const decisionId = `${timestamp}-${moderator.substring(0, 8)}`;

  await redis.hSet(`decision:${subredditName}:${decisionId}`, {
    action: normalized,
    moderator,
    contentId,
    contentType,
    contentPreview,
    timestamp: String(timestamp),
    fingerprint,
  });
  await redis.expire(`decision:${subredditName}:${decisionId}`, 90 * 24 * 60 * 60);

  const profileKey = `modprofile:${subredditName}:${moderator}`;
  await redis.hIncrBy(profileKey, 'totalActions', 1);
  await redis.hIncrBy(profileKey, `${normalized}s`, 1);
  await redis.hSet(profileKey, { lastActive: String(timestamp) });
  await redis.hSet(`modlist:${subredditName}`, { [moderator]: String(timestamp) });

  await redis.zAdd(`fingerprints:${subredditName}`, {
    member: `${decisionId}:${fingerprint}`,
    score: timestamp,
  });

  // Detect disagreements
  try {
    const weekAgo = timestamp - 7 * 24 * 60 * 60 * 1000;
    const recent = await redis.zRange(`fingerprints:${subredditName}`, weekAgo, timestamp, { by: 'score' });

    for (const entry of recent) {
      const [existingId, existingFp] = entry.member.split(':');
      if (existingId === decisionId || existingFp !== fingerprint) continue;

      const existing = await redis.hGetAll(`decision:${subredditName}:${existingId}`);
      if (!existing || existing.action === normalized || existing.moderator === moderator) continue;

      const calId = `cal-${timestamp}`;
      await redis.hSet(`calibration:${subredditName}:${calId}`, {
        modA: existing.moderator || 'unknown',
        actionA: existing.action || 'unknown',
        modB: moderator,
        actionB: normalized,
        fingerprint,
        contentPreview,
        timestamp: String(timestamp),
        resolved: 'false',
      });
      await redis.expire(`calibration:${subredditName}:${calId}`, 30 * 24 * 60 * 60);
      await redis.incrBy(`calibration-count:${subredditName}`, 1);
      console.log(`[BeHive] Calibration: ${existing.moderator} (${existing.action}) vs ${moderator} (${normalized})`);
      break;
    }
  } catch (e) {
    console.error('[BeHive] Disagreement detection error:', e);
  }

  console.log(`[BeHive] Recorded: ${moderator} → ${normalized} on ${contentType}`);
  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<{ subreddit?: { name?: string }; installer?: { name?: string } }>();
  const subredditName = input.subreddit?.name;
  if (!subredditName) return c.json<TriggerResponse>({ status: 'ignored' });

  await redis.hSet(`alignment:${subredditName}`, {
    overallScore: '0',
    status: 'learning',
    lastComputed: String(Date.now()),
  });
  console.log(`[BeHive] Installed on r/${subredditName}`);
  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-delete', async (c) => {
  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-comment-delete', async (c) => {
  return c.json<TriggerResponse>({ status: 'ok' });
});
