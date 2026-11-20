import { ArrowLeft, BellOff, Ellipsis, ExternalLink, Eye, EyeOff, Flag, Globe, Minimize2, Pause, Play, Smartphone, Trees, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { elapsedClock, focusedDuration, type ActiveSession } from './data'
import { translate, type AppLanguage } from './language'
import './main-dashboard.css'

interface MainFocusProps {
  language?: AppLanguage
  session: ActiveSession
  showTime: boolean
  now: number
  storageError: boolean
  checkinEnabled: boolean
  showCheckinToggle: boolean
  onToggleCheckin: () => void
  onToggleTime: () => void
  onToggleSilence: () => void
  onPause: () => void
  onResume: () => void
  onLeave: () => void
  onMinimize: () => void
  returnDestination: string
  onFinish: () => void
  children?: ReactNode
}

const deviceHelp = {
  apps: {
    title: 'Block Apps',
    description: 'Use Screen Time on your iPhone to set time limits for distracting apps.',
    link: 'https://support.apple.com/guide/iphone/set-up-screen-time-for-yourself-iphbfa595995/ios',
  },
  sites: {
    title: 'Hide Sites',
    description: 'Use Web Content restrictions in Screen Time to block specific websites on your iPhone.',
    link: 'https://support.apple.com/en-euro/guide/iphone/iph3ff83f3b1/ios',
  },
}

function createAmbientNoise(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
  const samples = buffer.getChannelData(0)
  let lastSample = 0
  for (let index = 0; index < samples.length; index++) {
    lastSample = (lastSample + 0.02 * (Math.random() * 2 - 1)) / 1.02
    // Fade the ends of the loop so it does not click when it repeats.
    const fade = Math.min(1, index / 1024, (samples.length - 1 - index) / 1024)
    samples[index] = lastSample * fade * 3.5
  }
  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  source.loop = true
  gain.gain.value = 0.18
  source.connect(gain).connect(context.destination)
  source.start()
}

function closeAudio(context: AudioContext | null) {
  if (context && context.state !== 'closed') void context.close().catch(() => undefined)
}

export default function MainFocus({
  language = 'en',
  session, showTime, now, storageError, checkinEnabled, showCheckinToggle, onToggleCheckin, onToggleTime, onToggleSilence,
  onPause, onResume, onLeave, onMinimize, returnDestination, onFinish, children,
}: MainFocusProps) {
  const t = (text: string) => translate(language, text)
  const [panel, setPanel] = useState<'options' | keyof typeof deviceHelp>('options')
  const dialog = useRef<HTMLDialogElement>(null)
  const dialogTrigger = useRef<HTMLButtonElement>(null)
  const panelHeading = useRef<HTMLHeadingElement>(null)
  const audio = useRef<AudioContext>(null)
  const [ambient, setAmbient] = useState(false)
  const [ambientMessage, setAmbientMessage] = useState('')
  const silenced = session.silenceBreakReminders === true
  const paused = Boolean(session.pausedAt)
  const help = panel !== 'options' ? deviceHelp[panel] : null

  useEffect(() => () => {
    const context = audio.current
    audio.current = null
    closeAudio(context)
  }, [])

  useEffect(() => {
    if (dialog.current?.open) panelHeading.current?.focus()
  }, [panel])

  const toggleAmbient = async () => {
    setAmbientMessage('')
    if (audio.current) {
      const context = audio.current
      audio.current = null
      closeAudio(context)
      setAmbient(false)
      return
    }
    if (!window.AudioContext) {
      setAmbientMessage('Ambient sound is unavailable in this browser.')
      return
    }
    let context: AudioContext | null = null
    try {
      context = new AudioContext()
      audio.current = context
      await context.resume()
      if (audio.current !== context) return
      createAmbientNoise(context)
      setAmbient(true)
    } catch {
      if (audio.current !== context) return
      audio.current = null
      closeAudio(context)
      setAmbientMessage('Ambient sound could not start.')
    }
  }

  return <main className="life-main-focus" data-paused={paused}>
    {storageError && <p className="life-main-focus-error" role="alert">{t('Your session is still here. Check available storage and try again.')}</p>}
    <header className="life-main-focus-top">
      <button type="button" aria-label={language === 'ru' ? `${paused ? 'Вернуться' : 'Поставить на паузу и вернуться'}: ${t(returnDestination)}` : paused ? `Back to ${returnDestination}` : `Pause and return to ${returnDestination}`}
        title={language === 'ru' ? `Вернуться: ${t(returnDestination)}` : `Back to ${returnDestination}`} onClick={onLeave}><ArrowLeft size={22} aria-hidden="true" /></button>
      <h1>LifeTime</h1>
      <button ref={dialogTrigger} type="button" aria-label={t('Focus options')} aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}><Ellipsis size={23} /></button>
    </header>
    <div className="life-main-focus-center">
      <div className="life-main-clock">
        <div className="life-main-clock-time" id="focus-elapsed-time" data-hidden={!showTime}
          role={showTime ? 'timer' : undefined}>
          {showTime ? elapsedClock(focusedDuration(session, now)) : <span aria-hidden="true">{t('Time hidden')}</span>}
        </div>
      </div>
      <h2>{session.taskId ? session.taskTitle : t(session.taskTitle)}</h2>
      {paused && <p className="life-main-focus-status" role="status">{t('Paused')}</p>}
      <div className="life-main-focus-preferences">
        <button type="button" className="life-main-time-toggle" aria-controls="focus-elapsed-time" onClick={onToggleTime}>
          {showTime ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />} {t(showTime ? 'Hide elapsed time' : 'Show elapsed time')}
        </button>
        {showCheckinToggle && <button type="button" className="life-main-checkin-toggle" role="switch" aria-label="Focus check-in"
          aria-checked={checkinEnabled} onClick={onToggleCheckin}>
          {t('Check-in')} <span aria-hidden="true">{t(checkinEnabled ? 'On' : 'Off')}</span>
        </button>}
      </div>
      <div className="life-main-focus-controls">
        <button type="button" className="life-main-focus-pause" onClick={paused ? onResume : onPause}>
          {paused ? <><Play size={18} aria-hidden="true" /> {language === 'ru' ? 'Продолжить' : 'Continue'}</> : <><Pause size={18} aria-hidden="true" /> {language === 'ru' ? 'Пауза' : 'Pause'}</>}
        </button>
        {!paused && <button type="button" className="life-main-focus-minimize" onClick={onMinimize}>
          <Minimize2 size={17} aria-hidden="true" /> {language === 'ru' ? 'Свернуть таймер' : 'Minimize timer'}
        </button>}
        <button type="button" className="life-main-focus-finish" onClick={onFinish}><Flag size={17} aria-hidden="true" /> {language === 'ru' ? 'Завершить' : 'Finish'}</button>
      </div>
    </div>
    <dialog ref={dialog} className="life-main-focus-dialog" aria-labelledby="focus-dialog-title"
      onClose={() => { setPanel('options'); dialogTrigger.current?.focus() }}>
      <div className="life-main-focus-dialog-header">
        {help && <button type="button" aria-label={t('Back to focus options')} onClick={() => setPanel('options')}><ArrowLeft size={20} /></button>}
        <h2 id="focus-dialog-title" ref={panelHeading} tabIndex={-1}>{t(help?.title ?? 'Focus options')}</h2>
        <button type="button" aria-label={t('Close')} autoFocus onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      {help ? <>
        <p>{t(help.description)}</p>
        <p>{t('LifePortable can’t change these settings from the browser.')}</p>
        <a href={help.link} target="_blank" rel="noreferrer">{t('Apple Screen Time guide')} <ExternalLink size={16} /></a>
      </> : <div className="life-main-focus-dialog-actions">
        <button type="button" onClick={() => setPanel('apps')}>
          <Smartphone size={18} aria-hidden="true" /> {t('Block Apps')}
        </button>
        <button type="button" aria-pressed={silenced} aria-describedby="focus-silence-help" onClick={onToggleSilence}>
          <BellOff size={18} aria-hidden="true" /> {t('Silence')} <span>{t(silenced ? 'On' : 'Off')}</span>
        </button>
        <button type="button" onClick={() => setPanel('sites')}>
          <Globe size={18} aria-hidden="true" /> {t('Hide Sites')}
        </button>
        <button type="button" aria-pressed={ambient} onClick={toggleAmbient}>
          <Trees size={18} aria-hidden="true" /> {t('Ambient')} <span>{t(ambient ? 'On' : 'Off')}</span>
        </button>
        <p id="focus-silence-help" className="life-main-focus-tool-note">{t('Silence applies to LifePortable break reminders.')}</p>
        {ambientMessage && <p className="life-main-focus-tool-note" role="status">{t(ambientMessage)}</p>}
      </div>}
    </dialog>
    {children}
  </main>
}
