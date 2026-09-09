export const GLOBAL_TV_HOSTS = new Set(['www.globaltv.com', 'globaltv.com'])

export function assertAllowedSourceUrl(
  raw: string,
  allowedHosts = GLOBAL_TV_HOSTS,
): { ok: true; url: URL } | { ok: false; code: 'disallowed_host' | 'invalid_url' } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, code: 'invalid_url' }
  }
  if (url.protocol !== 'https:') return { ok: false, code: 'disallowed_host' }
  if (!allowedHosts.has(url.hostname)) return { ok: false, code: 'disallowed_host' }
  return { ok: true, url }
}

export function assertAllowedRedirect(
  location: string,
  from: URL,
  allowedHosts = GLOBAL_TV_HOSTS,
): { ok: true; url: URL } | { ok: false; code: 'redirect_blocked' } {
  const next = new URL(location, from)
  if (next.protocol !== 'https:' || !allowedHosts.has(next.hostname)) {
    return { ok: false, code: 'redirect_blocked' }
  }
  return { ok: true, url: next }
}
