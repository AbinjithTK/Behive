/**
 * BeHive LLM Integration — Supports both OpenAI and Google Gemini
 * Mods choose their provider and provide their own API key via subreddit settings.
 * Only approved providers per Devvit rules: OpenAI and Google Gemini.
 */

export type LLMProvider = 'openai' | 'gemini' | 'none';

interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
}

/**
 * Call the configured LLM with a prompt and return the text response.
 * Returns null if LLM is not configured or call fails.
 */
export async function callLLM(config: LLMConfig, prompt: string): Promise<string | null> {
  if (config.provider === 'none' || !config.apiKey) return null;

  try {
    if (config.provider === 'gemini') {
      return await callGemini(config.apiKey, prompt);
    } else if (config.provider === 'openai') {
      return await callOpenAI(config.apiKey, prompt);
    }
  } catch (e) {
    console.error(`[BeHive] LLM call failed (${config.provider}):`, e);
  }
  return null;
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
      },
    }),
  });

  if (!response.ok) {
    console.error(`[BeHive] Gemini error: ${response.status}`);
    return null;
  }

  const data = await response.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOpenAI(apiKey: string, prompt: string): Promise<string | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You analyze moderation decision patterns and describe them concisely in 2-3 sentences.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    console.error(`[BeHive] OpenAI error: ${response.status}`);
    return null;
  }

  const data = await response.json() as any;
  return data?.choices?.[0]?.message?.content || null;
}
