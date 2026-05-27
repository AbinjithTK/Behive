import { Hono } from 'hono';
import { redis, reddit } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import { generateFingerprint } from '../core/hivemind';

export const menu = new Hono();

interface MenuRequest {
  targetId: string;
  location: string;
}

/**
 * See Team Precedent — Shows a rich form with detailed decision history
 */
menu.post('/show-precedent', async (c) => {
  const input = await c.req.json<MenuRequest>();
  const targetId = input.targetId;

  if (!targetId) {
    return c.json<UiResponse>({ showToast: 'No content selected.' });
  }

  const subreddit = await reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;

  // Get content text
  let contentText = '';
  let contentTitle = '';
  try {
    if (targetId.startsWith('t1_')) {
      const comment = await reddit.getCommentById(targetId as `t1_${string}`);
      contentText = comment.body || '';
      contentTitle = 'Comment';
    } else if (targetId.startsWith('t3_')) {
      const post = await reddit.getPostById(targetId as `t3_${string}`);
      contentText = `${post.title} ${post.body || ''}`;
      contentTitle = post.title.substring(0, 50);
    }
  } catch {
    return c.json<UiResponse>({ showToast: 'Could not read content.' });
  }

  if (!contentText || contentText.length < 10) {
    return c.json<UiResponse>({ showToast: 'Content too short for precedent matching.' });
  }

  // Find similar past decisions
  const fingerprint = generateFingerprint(contentText);
  let allFingerprints: Array<{ member: string; score: number }>;
  try {
    allFingerprints = await redis.zRange(`fingerprints:${subredditName}`, 0, Date.now(), { by: 'score' });
  } catch {
    return c.json<UiResponse>({ showToast: 'Could not search precedent.' });
  }

  const matches: Array<{ action: string; moderator: string; timestamp: string }> = [];
  for (const entry of allFingerprints) {
    const parts = entry.member.split(':');
    const fp = parts[1] || '';
    const decId = parts[0] || '';
    if (fp !== fingerprint) continue;

    try {
      const decision = await redis.hGetAll(`decision:${subredditName}:${decId}`);
      if (decision && decision.action) {
        matches.push({
          action: decision.action,
          moderator: decision.moderator || 'unknown',
          timestamp: decision.timestamp || '0',
        });
      }
    } catch { /* skip */ }
    if (matches.length >= 10) break;
  }

  // No matches — show encouraging message
  if (matches.length === 0) {
    return c.json<UiResponse>({
      showForm: {
        name: 'precedentResult',
        form: {
          title: '🧠 Team Precedent',
          description: 'No precedent found yet for this type of content. BeHive needs more team decisions to find patterns. Keep moderating — every action teaches the system!',
          fields: [],
          acceptLabel: 'Got it',
        },
      },
    });
  }

  // Build rich summary
  const removeCount = matches.filter((m) => m.action === 'remove').length;
  const approveCount = matches.filter((m) => m.action === 'approve').length;
  const banCount = matches.filter((m) => m.action === 'ban').length;
  const total = matches.length;

  let verdict: string;
  let confidence: string;

  if (total >= 5) confidence = '🟢 High confidence';
  else if (total >= 3) confidence = '🟡 Medium confidence';
  else confidence = '🔴 Limited data';

  if (removeCount > approveCount * 2) {
    verdict = `Strong consensus: REMOVE (${removeCount}/${total})`;
  } else if (approveCount > removeCount * 2) {
    verdict = `Strong consensus: APPROVE (${approveCount}/${total})`;
  } else if (removeCount > approveCount) {
    verdict = `Team leans REMOVE (${removeCount}/${total})`;
  } else if (approveCount > removeCount) {
    verdict = `Team leans APPROVE (${approveCount}/${total})`;
  } else {
    verdict = `Split decision (${removeCount} removed, ${approveCount} approved)`;
  }

  // Build history lines
  const historyLines = matches
    .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    .slice(0, 5)
    .map((m) => {
      const icon = m.action === 'remove' ? '❌' : m.action === 'approve' ? '✅' : '🚫';
      const ago = getTimeAgo(parseInt(m.timestamp));
      return `${icon} u/${m.moderator} → ${m.action} (${ago})`;
    })
    .join('\n');

  const description = [
    `📋 Content: "${contentTitle}"`,
    ``,
    `${confidence} (${total} similar decisions found)`,
    ``,
    `📊 Breakdown:`,
    `  ✅ Approved: ${approveCount}`,
    `  ❌ Removed: ${removeCount}`,
    banCount > 0 ? `  🚫 Banned: ${banCount}` : '',
    ``,
    `🎯 Verdict: ${verdict}`,
    ``,
    `📜 Recent history:`,
    historyLines,
  ].filter(Boolean).join('\n');

  return c.json<UiResponse>({
    showForm: {
      name: 'precedentResult',
      form: {
        title: '🧠 Team Precedent',
        description,
        fields: [],
        acceptLabel: 'Got it',
      },
    },
  });
});

/**
 * Flag for Calibration
 */
menu.post('/flag-calibration', async (c) => {
  const input = await c.req.json<MenuRequest>();
  const targetId = input.targetId;

  if (!targetId) {
    return c.json<UiResponse>({ showToast: 'No content selected.' });
  }

  const subreddit = await reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;
  const username = await reddit.getCurrentUsername() || 'unknown';

  const flagId = `flag-${Date.now()}`;
  await redis.hSet(`calibration:${subredditName}:${flagId}`, {
    contentId: targetId,
    flaggedBy: username,
    timestamp: String(Date.now()),
    resolved: 'false',
    type: 'manual',
  });
  await redis.expire(`calibration:${subredditName}:${flagId}`, 30 * 24 * 60 * 60);
  await redis.incrBy(`calibration-count:${subredditName}`, 1);

  return c.json<UiResponse>({
    showToast: '🚩 Flagged for team calibration. Your team will see this in the dashboard.',
  });
});

/**
 * View Team Alignment — Rich form with stats
 */
menu.post('/view-alignment', async (c) => {
  await c.req.json<MenuRequest>();

  const subreddit = await reddit.getCurrentSubreddit();
  const subredditName = subreddit.name;

  const alignment = await redis.hGetAll(`alignment:${subredditName}`);
  const calCount = await redis.get(`calibration-count:${subredditName}`);
  const modList = await redis.hGetAll(`modlist:${subredditName}`);
  const modCount = modList ? Object.keys(modList).length : 0;

  const score = alignment?.overallScore || '0';
  const status = alignment?.status || 'learning';
  const totalDecisions = alignment?.totalDecisions || '0';

  let scoreEmoji: string;
  const scoreNum = parseInt(score);
  if (scoreNum >= 90) scoreEmoji = '🟢';
  else if (scoreNum >= 75) scoreEmoji = '🟡';
  else if (scoreNum >= 60) scoreEmoji = '🟠';
  else scoreEmoji = '🔴';

  let description: string;

  if (status === 'learning') {
    description = [
      '🌱 BeHive is still learning your team\'s patterns.',
      '',
      `📊 Progress:`,
      `  • ${totalDecisions} decisions recorded`,
      `  • ${modCount} mods tracked`,
      `  • ${calCount || '0'} calibration moments`,
      '',
      'Keep moderating! BeHive needs at least 10 decisions',
      'from multiple mods to calculate alignment.',
      '',
      '💡 Tip: Right-click any post → "See Team Precedent"',
      'to check how your team handles similar content.',
    ].join('\n');
  } else {
    description = [
      `${scoreEmoji} Team Alignment Score: ${score}%`,
      '',
      `📊 Stats:`,
      `  • ${totalDecisions} decisions analyzed (last 7 days)`,
      `  • ${modCount} active moderators`,
      `  • ${calCount || '0'} calibration moments detected`,
      '',
      scoreNum >= 85
        ? '✨ Your team is highly aligned! Great consistency.'
        : scoreNum >= 70
        ? '👍 Good alignment. A few areas could use calibration.'
        : '⚠️ Your team has significant disagreements. Check the Calibrations tab in the dashboard.',
      '',
      '💡 Create the BeHive Dashboard post to see full details,',
      'mod profiles, and rule clarity scores.',
    ].join('\n');
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'alignmentResult',
      form: {
        title: '🐝 BeHive — Team Alignment',
        description,
        fields: [],
        acceptLabel: 'Close',
      },
    },
  });
});

/**
 * Create BeHive Dashboard — Pinned custom post
 */
menu.post('/create-dashboard', async (c) => {
  await c.req.json<MenuRequest>();

  const subreddit = await reddit.getCurrentSubreddit();

  try {
    await reddit.submitCustomPost({
      subredditName: subreddit.name,
      title: '🐝 BeHive — Team Alignment Dashboard',
      entry: 'default',
      textFallback: { text: 'BeHive collective intelligence dashboard. Install BeHive to view your mod team\'s alignment score, calibration moments, and team profiles. This post is interactive for moderators with BeHive installed.' },
    });

    return c.json<UiResponse>({
      showToast: '🐝 Dashboard created! Pin it to keep it visible for your mod team.',
    });
  } catch (e) {
    console.error('[BeHive] Dashboard creation failed:', e);
    return c.json<UiResponse>({
      showToast: 'Failed to create dashboard. Try again.',
    });
  }
});

// Helper: human-readable time ago
function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
