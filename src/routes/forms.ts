import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';

export const forms = new Hono();

// Placeholder form endpoints (used if we add detailed views later)
forms.post('/precedent-result', async (c) => {
  return c.json<UiResponse>({ showToast: 'Precedent noted.' });
});

forms.post('/alignment-result', async (c) => {
  return c.json<UiResponse>({ showToast: 'Alignment updated.' });
});
