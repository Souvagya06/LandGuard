import { useState, type FormEvent } from 'react'
import { signIn } from '../lib/api'
import { LandGuardLogo, LANDGUARD_TAGLINE } from '../components/brand'

/** Same dark brand experience as the Android launch / server setup screens. */
export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded-2xl border border-leaf/15 bg-[#102A1CB3] px-4 py-3.5 text-[15px] text-mist placeholder:text-mist-muted/60 outline-none focus:border-leaf'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-forest-night px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-leaf/10 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-sm">
        <LandGuardLogo size={64} />
        <p className="mt-3 text-[30px] font-extrabold tracking-[-0.02em]"><span className="text-mist">Land</span><span className="text-leaf">Guard</span></p>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist-muted">{LANDGUARD_TAGLINE}</p>

        <h1 className="mt-8 text-[28px] font-extrabold leading-tight text-mist">Authority<br />Control Center</h1>
        <p className="mt-2 text-[15px] leading-snug text-mist-muted">Sign in with your authority account to monitor risk and issue alerts to LandGuard devices.</p>

        <div className="mt-7 space-y-3">
          <label className="block">
            <span className="sr-only">Username</span>
            <input className={field} autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <input className={field} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        </div>

        {error && <p className="mt-3 rounded-xl bg-[#FF4D3D1A] px-3 py-2 text-[13px] text-[#FF8A7D]" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl bg-leaf text-[15px] font-extrabold text-forest-night transition-colors hover:bg-leaf-bright disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
