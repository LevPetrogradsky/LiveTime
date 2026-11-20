import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, Check, ClipboardList, Timer, X } from 'lucide-react'
import { maxDisplayNameLength } from '../data'
import { requestOnboardingFeedback, type OnboardingMode } from './state'
import { translate, type AppLanguage } from '../language'
import type { AccountEntryMode } from '../settings/AccountPanel'
import './onboarding.css'

export type OnboardingDestination = 'tasks' | 'journal' | 'focus'

interface Props {
  mode: Exclude<OnboardingMode, null>
  displayName: string
  account?: (mode: AccountEntryMode) => ReactNode
  language: AppLanguage
  onComplete: (name: string, destination: OnboardingDestination) => boolean
  onClose: () => void
}

const features = [
  { Icon: ClipboardList, title: 'Tasks', detail: 'Choose what matters today.' },
  { Icon: BookOpen, title: 'Journal', detail: 'Keep a note when it comes to you.' },
  { Icon: Timer, title: 'Focus', detail: 'Give one thing your attention.' },
]

const destinations: { id: OnboardingDestination; title: string; detail: string }[] = [
  { id: 'tasks', title: 'Plan my day', detail: 'Start with a task.' },
  { id: 'journal', title: 'Write a note', detail: 'Capture a thought.' },
  { id: 'focus', title: 'Start focusing', detail: 'Choose a focus preset.' },
]

const titles = ['A little space for your day', 'Make it yours', 'Where would you like to begin?']
const descriptions = [
  'LifePortable keeps your plans, notes, and focus time together on this device.',
  'Your name is optional. You can change it later in Settings.',
  'Pick a starting point. Everything else stays one tap away.',
]

export default function WebOnboarding({ mode, displayName, account, language, onComplete, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [accountMode, setAccountMode] = useState<AccountEntryMode>()
  const t = (text: string) => translate(language, text)
  const [name, setName] = useState(displayName)
  const [destination, setDestination] = useState<OnboardingDestination>('tasks')
  const [error, setError] = useState('')
  const [visibleViewport, setVisibleViewport] = useState(() => ({
    height: window.visualViewport?.height,
    top: window.visualViewport?.offsetTop ?? 0,
  }))

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setVisibleViewport({ height: viewport.height, top: viewport.offsetTop })
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update) }
  }, [])

  function back() {
    if (step === 1) return
    requestOnboardingFeedback()
    setError('')
    setStep(step - 1)
  }

  function advance() {
    requestOnboardingFeedback()
    if (step < 3) { setError(''); setStep(step + 1); return }
    if (!onComplete(name.trim(), destination)) setError('Your setup could not be saved. Please try again.')
  }

  return <div className="lifeos-onboarding" role="dialog" aria-modal="true" aria-label="Welcome to LifePortable"
    style={{ height: visibleViewport.height ? `${visibleViewport.height}px` : '100dvh', top: visibleViewport.top }}>
    <div className="lifeos-onboarding__header">
      {step > 1 || accountMode ? <button type="button" className="lifeos-onboarding__back" onClick={accountMode ? () => setAccountMode(undefined) : back}>
        <ArrowLeft size={17} aria-hidden="true" /> Back
      </button> : <span />}
      <span className="lifeos-onboarding__progress" aria-label={`Step ${step} of 3`}>{step} of 3</span>
      {mode === 'preview' && <button type="button" className="lifeos-onboarding__close" aria-label="Close onboarding preview"
        onClick={onClose}><X size={20} aria-hidden="true" /></button>}
    </div>
    <div className="lifeos-onboarding__track" aria-hidden="true"><span style={{ width: `${step * 100 / 3}%` }} /></div>

    <main className="lifeos-onboarding__content" key={step}>
      <p className="lifeos-onboarding__eyebrow">LifePortable</p>
      <h1>{accountMode ? t('Account') : titles[step - 1]}</h1>
      {!accountMode && <p className="lifeos-onboarding__description">{descriptions[step - 1]}</p>}

      {accountMode && <div className="lifeos-onboarding__account">{account?.(accountMode)}</div>}
      {step === 1 && !accountMode && account && <div className="lifeos-onboarding__account-options">
        <button type="button" onClick={() => setAccountMode('sign-up')}>{t('Create account')}</button>
        <button type="button" onClick={() => setAccountMode('sign-in')}>{t('Sign in')}</button>
      </div>}
      {step === 1 && !accountMode && <div className="lifeos-onboarding__items">
        {features.map(({ Icon, title, detail }) => <div className="lifeos-onboarding__feature" key={title}>
          <span className="lifeos-onboarding__icon"><Icon size={22} aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{detail}</small></span>
        </div>)}
      </div>}
      {step === 2 && !accountMode && <label className="lifeos-onboarding__name">
        <strong>What should we call you?</strong>
        <input type="text" autoComplete="nickname" maxLength={maxDisplayNameLength} value={name}
          placeholder="Your name (optional)" onChange={event => setName(event.currentTarget.value)} />
      </label>}

      {step === 3 && !accountMode && <div className="lifeos-onboarding__items" role="radiogroup" aria-label="First section">
        {destinations.map(option => <button type="button" role="radio" aria-checked={destination === option.id}
          className={`lifeos-onboarding__destination${destination === option.id ? ' is-selected' : ''}`}
          key={option.id} onClick={() => { requestOnboardingFeedback(); setDestination(option.id) }}>
          <span><strong>{option.title}</strong><small>{option.detail}</small></span>
          <span className="lifeos-onboarding__mark" aria-hidden="true">{destination === option.id ? <Check size={18} /> : null}</span>
        </button>)}
      </div>}
    </main>

    {!accountMode && <div className="lifeos-onboarding__footer">
      {error && <p role="alert" className="lifeos-onboarding__error">{error}</p>}
      <button type="button" className="lifeos-onboarding__primary" onClick={advance}>
        {step === 1 ? t('Continue as a guest') : step === 3 ? 'Open LifePortable' : 'Continue'}
      </button>
    </div>}
  </div>
}
