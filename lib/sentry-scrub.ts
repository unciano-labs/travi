// PII scrubbing for every Sentry event (ENG-03). Shared by the browser, Node and edge Sentry configs,
// so it must stay dependency-free (no node:*, no lib/env). Sentry is a data processor under
// RA 10173: it must never receive cookies, auth headers, request bodies, emails, phone numbers,
// OTP codes, tokens or payout account numbers.
import type { Breadcrumb, ErrorEvent, Event } from '@sentry/nextjs';

const FILTERED = '[Filtered]';
const MAX_DEPTH = 6;

// Object keys whose values are always dropped, wherever they appear (extra, contexts, data…).
const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|session|otp|code_?hash|^code$|api_?key|signature|email|phone|account_?(number|no)|card|cvv|iban|tin$|address|full_?name|first_?name|last_?name/i;

// Header names that are never forwarded.
const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-forwarded-for|x-real-ip|paymongo-signature|x-supabase-.*|apikey)$/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// PH mobile numbers (+639xxxxxxxxx / 09xxxxxxxxx) and any other long digit run (account/card numbers).
const PHONE = /(\+?63|0)9\d{9}\b/g;
const LONG_DIGITS = /(?<![\w-])\d{8,}(?![\w-])/g; // not inside UUIDs or other ids
// JWTs and bearer tokens.
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function scrubString(value: string): string {
  return value
    .replace(JWT, FILTERED)
    .replace(BEARER, `Bearer ${FILTERED}`)
    .replace(EMAIL, FILTERED)
    .replace(PHONE, FILTERED)
    .replace(LONG_DIGITS, FILTERED);
}

/** Drop the query string (it can carry auth codes, token_hash, emails) and keep only the path. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

// Keys whose string values are URLs or paths (e.g. contexts.nextjs.request_path): drop the query.
const URL_KEY = /(url|path|target|href|referr?er)$/i;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return FILTERED;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) out[key] = FILTERED;
    else if (URL_KEY.test(key) && typeof item === 'string') out[key] = stripQuery(scrubString(item));
    else out[key] = scrubValue(item, depth + 1);
  }
  return out;
}

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER.test(name)) continue;
    out[name] = name.toLowerCase() === 'referer' ? stripQuery(value) : scrubString(value);
  }
  return out;
}

function scrubRequest(event: Event) {
  if (!event.request) return;
  const { request } = event;
  delete request.cookies;
  delete request.data; // never send request bodies (forms carry passwords, OTPs, payout numbers)
  delete request.query_string;
  if (request.url) request.url = stripQuery(request.url);
  request.headers = scrubHeaders(request.headers);
}

/** `beforeSend` for every runtime. Never returns null: errors are still reported, just without PII. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  scrubRequest(event);

  // Keep only the opaque user id for grouping; drop email, username and IP.
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;

  if (event.message) event.message = scrubString(event.message);
  if (event.logentry?.message) event.logentry.message = scrubString(event.logentry.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
  }
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (event.tags) event.tags = scrubValue(event.tags) as typeof event.tags;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => scrubBreadcrumb(crumb) ?? crumb);
  }
  return event;
}

// Span attributes that carry full URLs, query strings or credentials.
const SPAN_URL_KEYS = ['url', 'url.full', 'http.url', 'http.target'];
const SPAN_DROP_KEYS = /^(url\.query|http\.query|http\.request\.header\.(cookie|authorization|x-forwarded-for|x-real-ip))$/i;

function scrubSpanData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  for (const key of Object.keys(data)) {
    if (SPAN_DROP_KEYS.test(key)) delete data[key];
    else if (SPAN_URL_KEYS.includes(key) && typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
  }
}

/** `beforeSendTransaction`: performance spans carry URLs with query strings (auth codes, tokens). */
export function scrubTransaction<T extends Event>(event: T): T {
  scrubRequest(event);
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.transaction) event.transaction = stripQuery(event.transaction);
  scrubSpanData(event.contexts?.trace?.data as Record<string, unknown> | undefined);
  for (const span of event.spans ?? []) {
    scrubSpanData(span.data as Record<string, unknown> | undefined);
    if (span.description) span.description = stripQuery(scrubString(span.description));
  }
  return event;
}

/** `beforeBreadcrumb`: navigation/fetch breadcrumbs carry URLs with query strings. */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  const next: Breadcrumb = { ...crumb };
  if (next.message) next.message = scrubString(next.message);
  if (next.data) {
    const data = { ...next.data };
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
    }
    next.data = scrubValue(data) as Breadcrumb['data'];
  }
  return next;
}
