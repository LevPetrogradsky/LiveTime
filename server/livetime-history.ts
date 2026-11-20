import { createHash } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { emptyData, validateLiveOSData } from '../src/data.ts'

export default { async fetch(request: Request) {
  const reply = (status: number, body: unknown = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  const url = process.env.LIVETIME_HISTORY_DATABASE_URL
  if (!url) return reply(503)
  const match = /^LiveTime (lt-[0-9a-f]{64})$/.exec(request.headers.get('Authorization') ?? '')
  if (!match) return reply(401)
  const owner = createHash('sha256').update('livetime-history/v1:' + match[1]).digest('hex')
  try {
    const sql = neon(url)
    if (request.method === 'PUT') {
      await sql`INSERT INTO livetime_guest_vaults (owner) VALUES (${owner}) ON CONFLICT DO NOTHING`
      return reply(200)
    }
    if (request.method !== 'GET' && request.method !== 'POST') return reply(405)
    if (!(await sql`SELECT 1 FROM livetime_guest_vaults WHERE owner = ${owner}`).length) return reply(404)
    if (request.method === 'GET') {
      const after = new URL(request.url).searchParams.get('after') ?? ''
      const rows = await sql`SELECT id, payload FROM livetime_guest_sessions WHERE owner = ${owner} AND id > ${after} ORDER BY id LIMIT 101`
      return reply(200, { sessions: rows.slice(0, 100).map(row => row.payload), next: rows.length > 100 ? rows[99].id : null })
    }
    const raw = await request.text()
    if (raw.length > 250_000) return reply(413)
    let sessions: unknown
    try { sessions = JSON.parse(raw) } catch { return reply(400) }
    const data: unknown = { ...emptyData(), sessions }
    if (!Array.isArray(sessions) || sessions.length > 100 || !validateLiveOSData(data) ||
      !data.sessions.every(session => session.id.length > 0 && session.id.length <= 200)) return reply(400)
    await sql`INSERT INTO livetime_guest_sessions (owner, id, payload)
      SELECT ${owner}, entry->>'id', entry FROM jsonb_array_elements(${JSON.stringify(data.sessions)}::jsonb) AS entry
      ON CONFLICT (owner, id) DO UPDATE SET payload = EXCLUDED.payload
      WHERE livetime_guest_sessions.payload->'interest' = 'null'::jsonb AND EXCLUDED.payload->'interest' <> 'null'::jsonb`
    return reply(200)
  } catch {
    return reply(503)
  }
} }
