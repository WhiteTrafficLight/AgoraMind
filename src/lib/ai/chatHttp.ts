import { loggers } from '@/utils/logger';

/**
 * Parse a fetch response body, defending against HTML error pages and
 * empty bodies which the chat backend occasionally returns. Returns
 * `any` because each consumer narrows differently and the API responses
 * span many endpoints with no shared shape — narrowing happens at the
 * call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API boundary; consumers narrow.
export async function safeParseJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    loggers.api.warn('Response has HTML content type');
    const text = await response.text();
    loggers.api.error('Received HTML response from API', {
      preview: text.substring(0, 500),
    });
    throw new Error(`API returned HTML instead of JSON. Status: ${response.status}`);
  }

  const text = await response.text();

  loggers.api.debug('Raw API response', {
    preview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
  });

  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    loggers.api.warn('Received HTML response instead of JSON');
    loggers.api.error('HTML response preview', { preview: text.substring(0, 500) });
    throw new Error(`API returned HTML instead of JSON. Status: ${response.status}`);
  }

  if (!text.trim()) {
    loggers.api.warn('Received empty response');
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    loggers.api.error('Failed to parse JSON response', { error });
    loggers.api.error('Response text preview', { preview: text.substring(0, 500) });
    throw new Error(`Invalid JSON response. Status: ${response.status}`);
  }
}
