/**
 * PII filtering for logs
 *
 * Filters Personally Identifiable Information from log messages
 * to ensure compliance with privacy regulations (GDPR, CCPA, etc.)
 */

/**
 * Regex patterns for PII data
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
const SSN_REGEX = /\d{3}-\d{2}-\d{4}/g;
const CREDIT_CARD_REGEX = /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g;

/**
 * Sensitive field names that should always be redacted
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'ssn',
  'creditCard',
  'creditcard',
  'credit_card',
  'apiKey',
  'apikey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
]);

/**
 * Filter PII from log messages
 */
export function filterPII(message: string): string {
  return message
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(PHONE_REGEX, '[PHONE_REDACTED]')
    .replace(SSN_REGEX, '[SSN_REDACTED]')
    .replace(CREDIT_CARD_REGEX, '[CARD_REDACTED]');
}

/**
 * Filter PII from objects recursively
 */
export function filterPIIFromObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return filterPII(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(filterPIIFromObject);
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Redact sensitive fields
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      filtered[key] = '[REDACTED]';
    } else if (key.toLowerCase() === 'email') {
      filtered[key] = '[EMAIL_REDACTED]';
    } else {
      filtered[key] = filterPIIFromObject(value);
    }
  }

  return filtered;
}

// Intentionally kept for future use
// type LogLevel = 'info' | 'error' | 'warn' | 'debug';

interface LogMeta {
  [key: string]: unknown;
}

/**
 * Structured logger with PII filtering
 */
export const logger = {
  info: (message: string, meta?: LogMeta): void => {
    const filteredMessage = filterPII(message);
    const filteredMeta = meta ? filterPIIFromObject(meta) : undefined;
    if (filteredMeta) {
      console.log(JSON.stringify({ level: 'info', message: filteredMessage, ...filteredMeta as object }));
    } else {
      console.log(JSON.stringify({ level: 'info', message: filteredMessage }));
    }
  },

  error: (message: string, meta?: LogMeta): void => {
    const filteredMessage = filterPII(message);
    const filteredMeta = meta ? filterPIIFromObject(meta) : undefined;
    if (filteredMeta) {
      console.error(JSON.stringify({ level: 'error', message: filteredMessage, ...filteredMeta as object }));
    } else {
      console.error(JSON.stringify({ level: 'error', message: filteredMessage }));
    }
  },

  warn: (message: string, meta?: LogMeta): void => {
    const filteredMessage = filterPII(message);
    const filteredMeta = meta ? filterPIIFromObject(meta) : undefined;
    if (filteredMeta) {
      console.warn(JSON.stringify({ level: 'warn', message: filteredMessage, ...filteredMeta as object }));
    } else {
      console.warn(JSON.stringify({ level: 'warn', message: filteredMessage }));
    }
  },

  debug: (message: string, meta?: LogMeta): void => {
    if (process.env.NODE_ENV === 'development') {
      const filteredMessage = filterPII(message);
      const filteredMeta = meta ? filterPIIFromObject(meta) : undefined;
      if (filteredMeta) {
        console.debug(JSON.stringify({ level: 'debug', message: filteredMessage, ...filteredMeta as object }));
      } else {
        console.debug(JSON.stringify({ level: 'debug', message: filteredMessage }));
      }
    }
  },
};
