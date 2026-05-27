import { Hono } from 'hono';
import { redis, reddit, settings } from '@devvit/web/server';
import type { TaskResponse } from '@devvit/web/server';
import { callLLM, type LLMProvider } from '../core/llm';

export const scheduler = new Hono();

/**
 * Compute Alignment — Runs every hour
 * Calculates team decision consistency score (0-100%).
 */
scheduler.post('/compute-alignment', async (c) => {
  let subredditName: string;
  try {
    const sub = await reddit.getCurrentSubreddit();
    subredditName = sub.name;
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let recent: Array<{ member: string; score: number }>;
  try {
    recent = await redis.zRange(`fingerprints:${subredditName}`, weekAgo, now, { by: 'score' });
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  if (recent.length < 10) {
    await redis.hSet(`alignment:${subredditName}`, {
      overallScore: '0',
      status: 'learning',
      totalDecisions: String(recent.length),
      lastComputed: String(now),
    });
    return c.json<TaskResponse>({ status: 'ok' });
  }

  // Group by fingerprint
  const groups = new Map<string, string[]>();
  for (const entry of recent) {
    const parts = entry.member.split(':');
    const decId = parts[0] || '';
    const fp = parts[1] || '';
    if (!fp || fp === 'empty') continue;
    const existing = groups.get(fp) || [];
    existing.push(decId);
    groups.set(fp, existing);
  }

  // Calculate agreement rate
  let agreements = 0;
  let comparisons = 0;

  for (const [, decisionIds] of groups) {
    if (decisionIds.length < 2) continue;

    const actions: string[] = [];
    for (const id of decisionIds.slice(0, 5)) {
      try {
        const action = await redis.hGet(`decision:${subredditName}:${id}`, 'action');
        if (action) actions.push(action);
      } catch { /* skip */ }
    }

    if (actions.length >= 2) {
      const counts = new Map<string, number>();
      for (const a of actions) counts.set(a, (counts.get(a) || 0) + 1);
      let maxCount = 0;
      for (const [, count] of counts) {
        if (count > maxCount) maxCount = count;
      }
      agreements += maxCount;
      comparisons += actions.length;
    }
  }

  const score = comparisons > 0 ? Math.round((agreements / comparisons) * 100) : 0;

  await redis.hSet(`alignment:${subredditName}`, {
    overallScore: String(score),
    status: 'active',
    totalDecisions: String(recent.length),
    lastComputed: String(now),
  });

  // Update streak: consecutive hours above 75% alignment
  const currentStreak = parseInt(await redis.get(`streak:${subredditName}`) || '0');
  if (score >= 75) {
    await redis.set(`streak:${subredditName}`, String(currentStreak + 1));
  } else {
    await redis.set(`streak:${subredditName}`, '0');
  }

  console.log(`[BeHive] Alignment: ${score}% (${recent.length} decisions in r/${subredditName}) streak: ${score >= 75 ? currentStreak + 1 : 0}`);
  return c.json<TaskResponse>({ status: 'ok' });
});

/**
 * Detect Calibrations — Runs every 30 minutes
 */
scheduler.post('/detect-calibrations', async (c) => {
  let subredditName: string;
  try {
    const sub = await reddit.getCurrentSubreddit();
    subredditName = sub.name;
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  const enableAlerts = await settings.get('enableCalibrationAlerts');
  if (enableAlerts === false) return c.json<TaskResponse>({ status: 'ok' });

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  let recent: Array<{ member: string; score: number }>;
  try {
    recent = await redis.zRange(`fingerprints:${subredditName}`, dayAgo, now, { by: 'score' });
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  const seen = new Map<string, { action: string; mod: string; id: string }>();

  for (const entry of recent) {
    const parts = entry.member.split(':');
    const decisionId = parts[0] || '';
    const fp = parts[1] || '';
    if (!fp || fp === 'empty') continue;

    let decision: Record<string, string> | undefined;
    try {
      decision = await redis.hGetAll(`decision:${subredditName}:${decisionId}`);
    } catch { continue; }
    if (!decision || !decision.action || !decision.moderator) continue;

    const prev = seen.get(fp);
    if (prev && prev.action !== decision.action && prev.mod !== decision.moderator) {
      const calKey = `calibration:${subredditName}:auto-${fp.substring(0, 8)}-${now}`;
      try {
        const exists = await redis.exists(calKey);
        if (!exists) {
          await redis.hSet(calKey, {
            modA: prev.mod,
            actionA: prev.action,
            modB: decision.moderator,
            actionB: decision.action,
            fingerprint: fp,
            contentPreview: decision.contentPreview || '',
            timestamp: String(now),
            resolved: 'false',
          });
          await redis.expire(calKey, 30 * 24 * 60 * 60);
        }
      } catch { /* skip */ }
    }

    seen.set(fp, { action: decision.action, mod: decision.moderator, id: decisionId });
  }

  return c.json<TaskResponse>({ status: 'ok' });
});


/**
 * Generate Rule Interpretations — Runs weekly (Sunday 3am)
 * Uses the mod-configured LLM (Gemini or OpenAI) to summarize
 * how the team interprets each rule based on actual decisions.
 */
scheduler.post('/generate-interpretations', async (c) => {
  let subredditName: string;
  try {
    const sub = await reddit.getCurrentSubreddit();
    subredditName = sub.name;
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  // Check if AI features are enabled
  const enableAI = await settings.get('enableAutoInterpretations');
  if (enableAI === false) return c.json<TaskResponse>({ status: 'ok' });

  const provider = (await settings.get('llmProvider') || 'none') as LLMProvider;
  const apiKey = (await settings.get('llmApiKey') || '') as string;

  if (provider === 'none' || !apiKey) {
    console.log('[BeHive] AI interpretations skipped: no LLM configured');
    return c.json<TaskResponse>({ status: 'ok' });
  }

  // Get subreddit rules
  let rules: any[] = [];
  try {
    const sub = await reddit.getCurrentSubreddit();
    rules = await sub.getRules();
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  if (rules.length === 0) return c.json<TaskResponse>({ status: 'ok' });

  // Get recent decisions
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  let recent: Array<{ member: string; score: number }>;
  try {
    recent = await redis.zRange(`fingerprints:${subredditName}`, monthAgo, now, { by: 'score' });
  } catch {
    return c.json<TaskResponse>({ status: 'ok' });
  }

  if (recent.length < 20) {
    console.log('[BeHive] Not enough decisions for interpretations');
    return c.json<TaskResponse>({ status: 'ok' });
  }

  // Collect sample decisions
  const samples: Array<{ action: string; preview: string }> = [];
  for (const entry of recent.slice(-50)) {
    const parts = entry.member.split(':');
    const decId = parts[0] || '';
    try {
      const decision = await redis.hGetAll(`decision:${subredditName}:${decId}`);
      if (decision && decision.action && decision.contentPreview) {
        samples.push({ action: decision.action, preview: decision.contentPreview });
      }
    } catch { /* skip */ }
  }

  if (samples.length < 10) return c.json<TaskResponse>({ status: 'ok' });

  // Generate interpretation for each rule
  for (let i = 0; i < Math.min(rules.length, 10); i++) {
    const rule = rules[i];
    const ruleName = rule?.shortName || rule?.violationReason || `Rule ${i + 1}`;

    // Build prompt with sample decisions
    const sampleText = samples
      .slice(0, 20)
      .map((s) => `[${s.action.toUpperCase()}] "${s.preview.substring(0, 100)}"`)
      .join('\n');

    const prompt = `A Reddit subreddit has this rule: "${ruleName}"

Here are recent moderation decisions made by the mod team:
${sampleText}

Based on these decisions, describe in 2-3 sentences how this mod team interprets and applies this rule. What patterns emerge? What gets removed vs approved? Be specific and practical.`;

    const interpretation = await callLLM({ provider, apiKey }, prompt);

    if (interpretation) {
      await redis.hSet(`interpretations:${subredditName}`, {
        [`rule_${i}`]: interpretation,
        lastGenerated: String(now),
      });
      console.log(`[BeHive] Generated interpretation for rule ${i}: ${ruleName}`);
    }

    // Small delay between API calls to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return c.json<TaskResponse>({ status: 'ok' });
});
