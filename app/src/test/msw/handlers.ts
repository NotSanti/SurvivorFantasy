import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('https://example.invalid/health', () =>
    HttpResponse.json({ ok: true }),
  ),
]
