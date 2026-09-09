import {
  ALLOWED_HOSTS,
  CANONICAL_PAGE_URL,
  DEFAULT_USER_AGENT,
  FETCH_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  SEASON_51_SLUG,
  WP_POSTS_URL,
  type DiscoverResult,
} from './types.ts'

type DiscoverOptions = {
  fetchImpl?: typeof fetch
  userAgent?: string
  timeoutMs?: number
  maxBytes?: number
  slug?: string
}

type Fetched = { response: Response; url: URL }

function hostBlocked(url: URL): DiscoverResult | null {
  if (ALLOWED_HOSTS.has(url.hostname)) return null
  return {
    ok: false,
    code: 'disallowed_host',
    httpStatus: null,
    detail: `Host ${url.hostname} is not allow-listed.`,
  }
}

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; code: 'too_large' }> {
  const lengthHeader = response.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > maxBytes) {
    return { ok: false, code: 'too_large' }
  }
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > maxBytes) {
    return { ok: false, code: 'too_large' }
  }
  return { ok: true, text: new TextDecoder().decode(buffer) }
}

async function fetchFollow(
  fetchImpl: typeof fetch,
  startUrl: string,
  init: RequestInit,
): Promise<DiscoverResult | Fetched> {
  const start = new URL(startUrl)
  const blocked = hostBlocked(start)
  if (blocked) return blocked

  const response = await fetchImpl(start, { ...init, redirect: 'manual' })
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location')
    if (!location) {
      return { ok: false, code: 'http_error', httpStatus: response.status, detail: 'Redirect without location.' }
    }
    const next = new URL(location, start)
    if (!ALLOWED_HOSTS.has(next.hostname)) {
      return {
        ok: false,
        code: 'redirect_blocked',
        httpStatus: response.status,
        detail: `Redirected off Global TV to ${next.hostname}.`,
      }
    }
    const followed = await fetchImpl(next, { ...init, redirect: 'error' })
    return { response: followed, url: next }
  }
  return { response, url: start }
}

function isFetched(value: DiscoverResult | Fetched): value is Fetched {
  return 'response' in value
}

export async function discoverSeason51Source(options: DiscoverOptions = {}): Promise<DiscoverResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES
  const slug = options.slug ?? SEASON_51_SLUG
  const headers = {
    'user-agent': options.userAgent ?? DEFAULT_USER_AGENT,
    accept: 'application/json, text/html;q=0.8',
  }

  try {
    const restUrl = `${WP_POSTS_URL}?slug=${encodeURIComponent(slug)}&_fields=id,modified,slug,link,content`
    const rest = await fetchFollow(fetchImpl, restUrl, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!isFetched(rest)) return rest
    if (rest.response.status === 404) {
      return { ok: false, code: 'not_published_yet', httpStatus: 404, detail: 'WordPress post was not found.' }
    }
    if (rest.response.ok) {
      const contentType = rest.response.headers.get('content-type') ?? ''
      if (!contentType.includes('json') && !contentType.includes('html')) {
        return {
          ok: false,
          code: 'bad_content_type',
          httpStatus: rest.response.status,
          detail: contentType,
        }
      }
      const body = await readLimited(rest.response, maxBytes)
      if (!body.ok) {
        return { ok: false, code: 'too_large', httpStatus: rest.response.status, detail: 'Response exceeded size cap.' }
      }
      if (contentType.includes('json')) {
        const posts = JSON.parse(body.text) as Array<{
          id: number
          modified?: string
          link?: string
          content?: { rendered?: string }
        }>
        if (!Array.isArray(posts) || posts.length === 0) {
          return {
            ok: false,
            code: 'not_published_yet',
            httpStatus: rest.response.status,
            detail: 'No WordPress post exists for this slug.',
          }
        }
        const post = posts[0]
        return {
          ok: true,
          document: {
            url: post.link ?? rest.url.toString(),
            html: post.content?.rendered ?? '',
            wpPostId: post.id,
            modifiedAt: post.modified ?? null,
            httpStatus: rest.response.status,
            via: 'wordpress_rest',
          },
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, code: 'timeout', httpStatus: null, detail: 'WordPress REST request timed out.' }
    }
  }

  try {
    const htmlResult = await fetchFollow(fetchImpl, CANONICAL_PAGE_URL, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!isFetched(htmlResult)) return htmlResult
    if (htmlResult.response.status === 404) {
      return { ok: false, code: 'not_published_yet', httpStatus: 404, detail: 'Canonical HTML page was not found.' }
    }
    if (!htmlResult.response.ok) {
      return {
        ok: false,
        code: 'http_error',
        httpStatus: htmlResult.response.status,
        detail: `HTML fallback failed with ${htmlResult.response.status}.`,
      }
    }
    const contentType = htmlResult.response.headers.get('content-type') ?? ''
    if (contentType && !contentType.includes('html') && !contentType.includes('text')) {
      return {
        ok: false,
        code: 'bad_content_type',
        httpStatus: htmlResult.response.status,
        detail: contentType,
      }
    }
    const body = await readLimited(htmlResult.response, maxBytes)
    if (!body.ok) {
      return { ok: false, code: 'too_large', httpStatus: htmlResult.response.status, detail: 'HTML exceeded size cap.' }
    }
    return {
      ok: true,
      document: {
        url: htmlResult.url.toString(),
        html: body.text,
        wpPostId: null,
        modifiedAt: htmlResult.response.headers.get('last-modified'),
        httpStatus: htmlResult.response.status,
        via: 'html_fallback',
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, code: 'timeout', httpStatus: null, detail: 'HTML fallback timed out.' }
    }
    return {
      ok: false,
      code: 'network',
      httpStatus: null,
      detail: error instanceof Error ? error.message : 'Network error',
    }
  }
}
