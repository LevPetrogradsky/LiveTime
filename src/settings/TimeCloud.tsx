import { useEffect, useRef, useState } from 'react'
import type { FocusSession } from '../data'
import { generateRecoveryCode } from '../journal/guest-recovery'

const key = 'livetime.history.guest.v1'
const valid = (code: string) => /^lt-[0-9a-f]{64}$/.test(code)

async function request(code: string, method: string, body?: FocusSession[], after?: string) {
  const response = await fetch('/api/livetime-history' + (after ? '?' + new URLSearchParams({ after }) : ''), {
    method, headers: { Authorization: 'LiveTime ' + code, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit',
  })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

async function download(code: string) {
  const sessions: FocusSession[] = []
  let after: string | undefined
  do {
    const page = await request(code, 'GET', undefined, after)
    sessions.push(...page.sessions)
    after = page.next
  } while (after)
  return sessions
}

export function useTimeCloud(enabled: boolean, sessions: FocusSession[], pendingId: string | undefined, merge: (incoming: FocusSession[]) => boolean) {
  const [code, setCode] = useState(() => {
    try { const saved = localStorage.getItem(key) ?? ''; return valid(saved) ? saved : '' } catch { return '' }
  })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, retry] = useState(0)
  const mergeRef = useRef(merge)
  mergeRef.current = merge
  useEffect(() => {
    if (!enabled || !code || busy) return
    let cancelled = false
    async function sync() {
      try {
        const cloud = await download(code)
        if (cancelled) return
        const known = new Map(cloud.map(session => [session.id, session]))
        const changes = sessions.filter(session => session.id !== pendingId && (!known.has(session.id) ||
          (known.get(session.id)?.interest === null && session.interest !== null)))
        for (const session of changes) {
          if (cancelled) return
          await request(code, 'POST', [session])
        }
        if (!cancelled) {
          if (!mergeRef.current(cloud)) throw new Error('local')
          setStatus('saved')
        }
      } catch { if (!cancelled) setStatus('error') }
    }
    void sync()
    return () => { cancelled = true }
  }, [enabled, code, busy, sessions, pendingId, attempt])

  async function connect(input?: string) {
    if (!enabled || busy || code) return
    const candidate = input === undefined ? 'lt-' + generateRecoveryCode() : input.trim().toLowerCase()
    if (!valid(candidate)) { setStatus('invalid'); return }
    setBusy(true)
    try {
      if (input === undefined) await request(candidate, 'PUT')
      else if (!mergeRef.current(await download(candidate))) throw new Error('local')
      localStorage.setItem(key, candidate)
      setCode(candidate)
      setStatus('saved')
    } catch (error) { setStatus(error instanceof Error && error.message === '404' ? 'missing' : 'error') }
    finally { setBusy(false) }
  }
  return { code, status, busy, connect, retry: () => retry(value => value + 1) }
}

export function TimeCloudPanel({ cloud, ru }: { cloud: ReturnType<typeof useTimeCloud>; ru: boolean }) {
  const [input, setInput] = useState('')
  const messages: Record<string, [string, string]> = {
    saved: ['Cloud history connected.', 'Облачная история подключена.'],
    error: ['Could not sync. Your local history is still available.', 'Не удалось синхронизировать. Локальная история доступна.'],
    invalid: ['Enter a LiveTime recovery code.', 'Введите код восстановления LiveTime.'],
    missing: ['LiveTime vault not found.', 'Хранилище LiveTime не найдено.'],
  }
  return <section className="settings-page__panel">
    <h2>{ru ? 'Гостевое облако' : 'Guest cloud'}</h2>
    <p>{ru ? 'В облако сохраняются только завершённые сессии. Сохраните код для восстановления на другом устройстве.' : 'Cloud storage saves completed sessions. Keep the recovery code to restore them on another device.'}</p>
    {cloud.code ? <>
      <label className="settings-page__field">{ru ? 'Код восстановления' : 'Recovery code'}
        <input readOnly value={cloud.code} onFocus={event => event.currentTarget.select()} />
      </label>
      <button type="button" className="settings-page__action" onClick={cloud.retry}>{ru ? 'Синхронизировать' : 'Sync now'}</button>
    </> : <>
      <button type="button" className="settings-page__action" disabled={cloud.busy} onClick={() => void cloud.connect()}>{ru ? 'Включить облако' : 'Enable cloud'}</button>
      <form onSubmit={event => { event.preventDefault(); void cloud.connect(input) }}>
        <label className="settings-page__field">{ru ? 'Код LiveTime' : 'LiveTime recovery code'}
          <input type="password" required value={input} autoComplete="off" onChange={event => setInput(event.currentTarget.value)} />
        </label>
        <button className="settings-page__action" disabled={cloud.busy}>{ru ? 'Восстановить' : 'Restore'}</button>
      </form>
    </>}
    {messages[cloud.status] && <p role="status">{messages[cloud.status][ru ? 1 : 0]}</p>}
  </section>
}
