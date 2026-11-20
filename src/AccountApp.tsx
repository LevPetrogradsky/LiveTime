import App from './App'
import { accountAuth, type AccountAuth } from './accounts'
import AccountPanel from './settings/AccountPanel'
import { STORAGE_KEY } from './data'
import { readRecoveryCode } from './journal/guest-recovery'
import { useState, type FormEvent } from 'react'
import { translate } from './language'

function ResetPassword({ auth, token, onDone }: { auth: AccountAuth; token: string; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await auth.resetPassword({ token, newPassword: password })
      if (result.error) {
        setMessage('This link may have expired. Request a new link in Settings.')
        return
      }
      setPassword('')
      setDone(true)
      setMessage('Password updated. You can sign in with your new password.')
    } catch {
      setMessage('Could not connect. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="settings-page">
    <h1>Reset password</h1>
    {token && !done && <form className="settings-page__account" onSubmit={submit}>
      <label className="settings-page__field">New password
        <input type="password" autoComplete="new-password" minLength={8} required
          value={password} onChange={event => setPassword(event.currentTarget.value)} />
      </label>
      <button type="submit" className="settings-page__action" disabled={busy}>Save new password</button>
    </form>}
    {(message || !token) && <p role="status">{message || 'This reset link is invalid or has expired.'}</p>}
    <button type="button" className="settings-page__action" disabled={busy} onClick={onDone}>Back to LifePortable</button>
  </main>
}

function ConnectedApp({ auth }: { auth: AccountAuth }) {
  const { data, isPending, error, refetch } = auth.useSession()
  const guestToken = import.meta.env.VITE_JOURNAL_SYNC_ENABLED === 'true'
    ? async () => { const code = readRecoveryCode(); return code ? `Guest ${code}` : null }
    : undefined
  if (isPending) return <main className="settings-page"><p role="status">Opening LifePortable...</p></main>
  if (error) return <App journalCloudToken={guestToken} guestCloud account={language => <div className="settings-page__account">
    <p className="settings-page__description" role="alert">{translate(language, 'Could not connect to your account. You can use LifePortable as a guest.')}</p>
    <button type="button" className="settings-page__action" onClick={() => void refetch()}>{translate(language, 'Try again')}</button>
  </div>} existingAccount />

  const user = data?.user
  const storageKey = user ? `${STORAGE_KEY}.neon.${user.id}` : undefined
  return <App key={storageKey ?? STORAGE_KEY} storageKey={storageKey} existingAccount={Boolean(user)}
    guestCloud={!user}
    journalCloudToken={user && import.meta.env.VITE_JOURNAL_SYNC_ENABLED === 'true'
      ? async () => {
        const token = (await auth.getSession({ fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } })).data?.session?.token
        return token?.split('.').length === 3 ? token : null
      } : guestToken}
    account={(language, initialMode) => <AccountPanel auth={auth} user={user} refreshSession={refetch} language={language} initialMode={initialMode} />} />
}

export default function AccountApp() {
  const [reset, setReset] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('account') === 'reset' ? { token: params.get('token') ?? '' } : null
  })
  if (accountAuth && reset) return <ResetPassword auth={accountAuth} token={reset.token} onDone={() => {
    window.history.replaceState(null, '', window.location.pathname)
    setReset(null)
  }} />
  return accountAuth ? <ConnectedApp auth={accountAuth} /> : <App guestCloud journalCloudToken={import.meta.env.VITE_JOURNAL_SYNC_ENABLED === 'true'
    ? async () => { const code = readRecoveryCode(); return code ? `Guest ${code}` : null }
    : undefined} />
}
