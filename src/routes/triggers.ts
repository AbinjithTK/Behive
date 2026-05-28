import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { generateFingerprint, TRACKABLE_ACTIONS, normalizeAction } from '../core/hivemind';

export const triggers = new Hono();

/**
 * onModAction — The Learning Engine
 * Records every mod decision as team knowledge.
 */
triggers.post('/on-mod-action', async (c) => {
  try {
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
  } catch (e) {
    console.error('[BeHive] onModAction error:', e);
    return c.json<TriggerResponse>({ status: 'ok' });
  }
});

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<{ subreddit?: { name?: string }; installer?: { name?: string } }>();
  const subredditName = input.subreddit?.name;
  if (!subredditName) return c.json<TriggerResponse>({ status: 'ignored' });

  try {
    // Initialize alignment tracking
    await redis.hSet(`alignment:${subredditName}`, {
      overallScore: '0',
      status: 'learning',
      lastComputed: String(Date.now()),
      totalDecisions: '0',
    });

    // Auto-create the dashboard post so mods see it immediately
    await reddit.submitCustomPost({
      subredditName,
      title: '🐝 BeHive — Team Alignment Dashboard',
      entry: 'default',
      textFallback: { text: `# 🐝 BeHive — Collective Intelligence for Mod Teams\n\nBeHive learns how your mod team thinks by watching every approve, remove, and ban.\n\n## How to use:\n1. **Moderate normally** — every action teaches BeHive\n2. **Right-click any post/comment** → "See Team Precedent" to see how your team handled similar content\n3. **Check this dashboard** for your alignment score and calibration moments\n4. **Flag edge cases** → "Flag for Calibration" when you're unsure\n\n## What you'll see:\n- **Alignment Score** — how consistently your team makes decisions (0-100%)\n- **Calibration Moments** — when two mods disagree on similar content\n- **Mod Profiles** — each mod's action patterns\n- **Rule Interpretations** — AI summaries of how your team applies each rule (optional)\n\nBeHive gets smarter with every decision. Pin this post to keep it visible for your team!` },
    });

    console.log(`[BeHive] Installed on r/${subredditName} — dashboard created`);
  } catch (e) {
    console.error('[BeHive] Install error:', e);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-post-delete', async (c) => {
  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-comment-delete', async (c) => {
  return c.json<TriggerResponse>({ status: 'ok' });
});

/**
 * onPostReport — Proactive Precedent
 * When a post is reported, automatically check precedent and add a mod note
 * so the reviewing mod sees team history WITHOUT needing to right-click.
 */
triggers.post('/on-post-report', async (c) => {
  try {
    const input = await c.req.json<{
      post?: { id?: string; title?: string; selftext?: string };
      subreddit?: { name?: string };
      reason?: string;
    }>();

    const postId = input.post?.id;
    const subredditName = input.subreddit?.name;
    if (!postId || !subredditName) return c.json<TriggerResponse>({ status: 'ignored' });

    const contentText = `${input.post?.title || ''} ${input.post?.selftext || ''}`;
    if (contentText.length < 10) return c.json<TriggerResponse>({ status: 'ignored' });

    const fingerprint = generateFingerprint(contentText);
    if (fingerprint === 'empty') return c.json<TriggerResponse>({ status: 'ignored' });

    // Find precedent
    const allFingerprints = await redis.zRange(`fingerprints:${subredditName}`, 0, Date.now(), { by: 'score' });

    let removeCount = 0;
    let approveCount = 0;
    let total = 0;

    for (const entry of allFingerprints) {
      const parts = entry.member.split(':');
      const fp = parts[1] || '';
      const decId = parts[0] || '';
      if (fp !== fingerprint) continue;

      try {
        const decision = await redis.hGetAll(`decision:${subredditName}:${decId}`);
        if (decision && decision.action) {
          if (decision.action === 'remove') removeCount++;
          else if (decision.action === 'approve') approveCount++;
          total++;
        }
      } catch { /* skip */ }
      if (total >= 5) break;
    }

    // Only add note if we have meaningful precedent
    if (total >= 2) {
      const verdict = removeCount > approveCount
        ? `Team removed ${removeCount}/${total} similar`
        : approveCount > removeCount
        ? `Team approved ${approveCount}/${total} similar`
        : `Split: ${removeCount} removed, ${approveCount} approved`;

      try {
        await reddit.addModNote({
          subreddit: subredditName,
          user: input.post?.title ? 'be-hive' : 'be-hive',
          note: `🐝 BeHive Precedent: ${verdict}. Report reason: ${input.reason || 'none'}`,
          label: 'HELPFUL_USER',
          redditId: postId as `t3_${string}`,
        });
      } catch {
        // ModNote API may not be available in all contexts — non-blocking
        console.log(`[BeHive] Could not add mod note for ${postId}`);
      }
    }

    return c.json<TriggerResponse>({ status: 'ok' });
  } catch (e) {
    console.error('[BeHive] onPostReport error:', e);
    return c.json<TriggerResponse>({ status: 'ok' });
  }
});

/**
 * onCommentReport — Same as post report but for comments
 */
triggers.post('/on-comment-report', async (c) => {
  try {
    const input = await c.req.json<{
      comment?: { id?: string; body?: string };
      subreddit?: { name?: string };
      reason?: string;
    }>();

    const commentId = input.comment?.id;
    const subredditName = input.subreddit?.name;
    if (!commentId || !subredditName) return c.json<TriggerResponse>({ status: 'ignored' });

    const contentText = input.comment?.body || '';
    if (contentText.length < 10) return c.json<TriggerResponse>({ status: 'ignored' });

    const fingerprint = generateFingerprint(contentText);
    if (fingerprint === 'empty') return c.json<TriggerResponse>({ status: 'ignored' });

    const allFingerprints = await redis.zRange(`fingerprints:${subredditName}`, 0, Date.now(), { by: 'score' });

    let removeCount = 0;
    let approveCount = 0;
    let total = 0;

    for (const entry of allFingerprints) {
      const parts = entry.member.split(':');
      const fp = parts[1] || '';
      const decId = parts[0] || '';
      if (fp !== fingerprint) continue;

      try {
        const decision = await redis.hGetAll(`decision:${subredditName}:${decId}`);
        if (decision && decision.action) {
          if (decision.action === 'remove') removeCount++;
          else if (decision.action === 'approve') approveCount++;
          total++;
        }
      } catch { /* skip */ }
      if (total >= 5) break;
    }

    if (total >= 2) {
      const verdict = removeCount > approveCount
        ? `Team removed ${removeCount}/${total} similar`
        : approveCount > removeCount
        ? `Team approved ${approveCount}/${total} similar`
        : `Split: ${removeCount} removed, ${approveCount} approved`;

      try {
        await reddit.addModNote({
          subreddit: subredditName,
          user: 'be-hive',
          note: `🐝 BeHive Precedent: ${verdict}. Report: ${input.reason || 'none'}`,
          label: 'HELPFUL_USER',
          redditId: commentId as `t1_${string}`,
        });
      } catch {
        console.log(`[BeHive] Could not add mod note for ${commentId}`);
      }
    }

    return c.json<TriggerResponse>({ status: 'ok' });
  } catch (e) {
    console.error('[BeHive] onCommentReport error:', e);
    return c.json<TriggerResponse>({ status: 'ok' });
  }
});
