/**
 * BeHive Core — Collective Intelligence Engine
 *
 * This module contains the shared logic for the BeHive mod tool:
 * - Content fingerprinting for similarity matching
 * - Action normalization
 * - Constants
 */

// Actions we track as meaningful moderation decisions
export const TRACKABLE_ACTIONS = [
  'removelink',
  'removecomment',
  'approvelink',
  'approvecomment',
  'banuser',
  'lock',
  'unlock',
  'spamlink',
  'spamcomment',
  'addremovalreason',
];

/**
 * Normalize Reddit mod action types into simple categories
 */
export function normalizeAction(action: string): string {
  if (action.includes('remove') || action.includes('spam')) return 'remove';
  if (action.includes('approve')) return 'approve';
  if (action.includes('ban')) return 'ban';
  if (action.includes('lock')) return 'lock';
  if (action.includes('unlock')) return 'unlock';
  return action;
}

/**
 * Generate a content fingerprint for similarity matching.
 *
 * This creates a simple hash from the normalized key terms in the content.
 * Two pieces of content with the same fingerprint are "similar enough"
 * that a mod decision on one is relevant precedent for the other.
 *
 * This is intentionally coarse — we want to group content by topic/pattern,
 * not require exact matches.
 */
export function generateFingerprint(text: string): string {
  if (!text || text.length < 10) return 'empty';

  // Normalize: lowercase, remove punctuation, extract significant words
  const normalized = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, 'URL') // normalize URLs
    .replace(/u\/\w+/g, 'USER') // normalize usernames
    .replace(/r\/\w+/g, 'SUB') // normalize subreddit mentions
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3) // only words with 4+ chars
    .filter((w) => !STOP_WORDS.has(w)) // remove stop words
    .sort()
    .slice(0, 8) // take top 8 significant words
    .join('|');

  if (!normalized) return 'empty';

  // Simple hash (not crypto — just for grouping similar content)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Common English stop words to filter out of fingerprints
const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
  'their', 'what', 'when', 'where', 'which', 'there', 'these',
  'those', 'then', 'than', 'them', 'will', 'would', 'could',
  'should', 'about', 'after', 'before', 'between', 'each',
  'every', 'other', 'some', 'such', 'only', 'also', 'just',
  'more', 'most', 'very', 'really', 'still', 'even', 'here',
  'does', 'dont', 'like', 'know', 'think', 'want', 'make',
  'going', 'people', 'thing', 'being', 'because',
]);
