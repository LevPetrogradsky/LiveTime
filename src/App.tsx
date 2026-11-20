import { TimeCloudPanel, useTimeCloud } from './settings/TimeCloud'
import MainDashboard from './MainDashboard'
import MainFocus from './MainFocus'
import TaskHistory from './TaskHistory'
import AskLiveOS from './home/AskLifeOS'
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ClipboardList, History, House, Leaf, MessageCircle, Play, Settings2, Sparkles } from 'lucide-react'
import { elapsedClock, focusedDuration, loadData, recordUnratedSession, restoreBackup, saveData, shortcuts, shortcutVisible, timerView, visibleShortcuts, STORAGE_KEY, type Factor, type JournalFolderAppearance, type LiveOSData, type Shortcut, type ShortcutLocation, type Task } from './data'
import { base64ToBytes, buildNoteBlocks, makeImportedNote, type SourceIndex } from './notes'
import JournalPage, { type JournalDraft } from './journal/JournalPage'
import { detectJournalDevice } from './journal/device'
import { clearJournalDraft, readJournalDraft, writeJournalDraft } from './journal/drafts'
import { JournalCloudSync, guestJournalCount, withJournalChanges } from './journal/cloud-sync'
import { cloudConsentKey, guestRecoveryStorageKey, normalizeRecoveryCode, readRecoveryCode } from './journal/guest-recovery'
import FlowEnginePage from './flow/FlowEnginePage'
import BreakReminder from './settings/BreakReminder'
import SettingsPage from './settings/SettingsPage'
import PostFocusChoice from './PostFocusChoice'
import FocusPresets from './presets/PresetsPage'
import { applyFocusPreset, findFocusPreset, type FocusPresetId } from './presets/focusPresets'
import { useDeleteUndo } from './delete-undo'
import UnifiedSearch from './search/UnifiedSearch'
import type { AccountEntryMode } from './settings/AccountPanel'
import WebOnboarding, { type OnboardingDestination } from './onboarding/WebOnboarding'
import { completionKey, initialOnboardingMode } from './onboarding/state'
import { translate, type AppLanguage } from './language'
import './reflection-confirmation.css'
import './mobile-navigation.css'
import './time-home.css'
import { mobileNavigationLayout } from './mobile-navigation'
import { repositoryUrl, serviceMode, serviceName } from './service-mode'

type View = Exclude<Shortcut, 'focus'> | 'main' | 'ask' | 'settings' | 'focus-history' | 'presets' | 'time-home'
const shortcutIcons = { tasks: ClipboardList, journal: BookOpen, focus: Play, flow: MessageCircle }
const serviceLabels = { tasks: 'LiveTasks', journal: 'LiveJournal', focus: 'LiveTime', flow: '3 questions' }
const factors: Factor[] = ['Meaningful Goal', 'Personal Control', 'Fast Feedback', 'Other']
const repoUrl = repositoryUrl
const hubUrl = 'https://lifeos-demo-kappa.vercel.app/'

function App({ storageKey, account, existingAccount = false, journalCloudToken, guestCloud = false }: { storageKey?: string; account?: (language: AppLanguage, initialMode?: AccountEntryMode) => ReactNode; existingAccount?: boolean; journalCloudToken?: () => Promise<string | null>; guestCloud?: boolean }) {
  const effectiveStorageKey = storageKey ?? STORAGE_KEY
  const [cloudEnabled, setCloudEnabled] = useState(() => {
    try { return Boolean(journalCloudToken && localStorage.getItem(cloudConsentKey(effectiveStorageKey)) === 'true' && (!guestCloud || readRecoveryCode())) }
    catch { return false }
  })
  const [recoveryCode, setRecoveryCode] = useState(() => guestCloud ? readRecoveryCode() : null)
  const [loadResult, setLoadResult] = useState(() => loadData(storageKey))
  const [showTimeIntro, setShowTimeIntro] = useState(() => {
    if (serviceMode !== 'time') return false
    try { return localStorage.getItem('livetime:intro-seen') !== 'true' } catch { return true }
  })
  const [onboardingMode, setOnboardingMode] = useState(() => serviceMode === 'hub' ? initialOnboardingMode(storageKey, localStorage, window.location.search, existingAccount) : null)
  const data = loadResult.data
  const language = data.language ?? 'en'
  const timeFormat = data.timeFormat ?? (language === 'ru' ? '24' : '12')
  const t = (text: string) => translate(language, text)
  const accountContent = account?.(language)
  const dataRef = useRef(data)
  const hiddenSections = data.hiddenSections ?? []
  const showHome = serviceMode === 'hub' && !hiddenSections.includes('main')
  const showAskLiveOS = serviceMode === 'hub' && data.askLiveOSInBar === true
  const onHome = (id: Shortcut) => shortcutVisible(data, id, 'home')
  const inBar = (id: Shortcut) => serviceMode === 'hub' ? shortcutVisible(data, id, 'bar') : serviceMode !== 'time' && id === serviceMode
  const defaultView: View = serviceMode === 'time' ? 'time-home' : serviceMode === 'tasks' || serviceMode === 'journal' ? serviceMode : showHome ? 'main' : (['journal', 'tasks'] as const).find(inBar) ?? 'settings'
  const [requestedView, setView] = useState<View>(() => {
    try { return serviceMode === 'hub' && localStorage.getItem(`${storageKey ?? STORAGE_KEY}.last-view`) === 'journal' ? 'journal' : defaultView }
    catch { return defaultView }
  })
  const [homeNavigationKey, setHomeNavigationKey] = useState(0)
  const [presetsReturnView, setPresetsReturnView] = useState<View>(defaultView)
  const [reflectionReturnView, setReflectionReturnView] = useState<View>(defaultView)
  const [reflectionNotice, setReflectionNotice] = useState('')
  const [postFocusReflection, setPostFocusReflection] = useState(false)
  const isHidden = (page: View) => page === 'main' ? !showHome
    : page === 'flow' ? !postFocusReflection
      : serviceMode !== 'hub' && page === 'journal' && serviceMode !== 'journal' ? true
      : page === 'journal' && !inBar(page) && !(showHome && onHome(page))
  const view = isHidden(requestedView) ? defaultView : requestedView
  const showJournal = !isHidden('journal')
  const [searchOpen, setSearchOpen] = useState(false)
  const [journalSearchResult, setJournalSearchResult] = useState<{ id: string }>()
  const [storageError, setStorageError] = useState(false)
  const [showTime, setShowTime] = useState(() => {
    try { return localStorage.getItem(`${storageKey ?? STORAGE_KEY}.focus-time`) !== 'hidden' }
    catch { return true }
  })
  const [pausedFocusScreen, setPausedFocusScreen] = useState<string>()
  const [minimizedFocusScreen, setMinimizedFocusScreen] = useState<string | undefined>(() => {
    try {
      const id = loadResult.data.activeSession?.id
      return id && localStorage.getItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) === id ? id : undefined
    } catch { return undefined }
  })
  const [now, setNow] = useState(Date.now())
  const [interest, setInterest] = useState(0)
  const [continueDesire, setContinueDesire] = useState(0)
  const [progress, setProgress] = useState(0)
  const [checkingIn, setCheckingIn] = useState(false)
  const [selectedFactors, setSelectedFactors] = useState<Factor[]>([])
  const [taskHistoryId, setTaskHistoryId] = useState<string | null>(null)
  const [journalTaskId, setJournalTaskId] = useState<string | undefined>()
  const [journalDraft, setJournalDraft] = useState<JournalDraft>(() => readJournalDraft(storageKey) ?? { text: '' })
  const [journalDraftError, setJournalDraftError] = useState(false)
  const journalDraftRef = useRef(journalDraft)
  const journalCloud = useRef<JournalCloudSync | null>(null)
  const [journalCloudStatus, setJournalCloudStatus] = useState('')
  const [journalCloudError, setJournalCloudError] = useState(false)
  const [journalLastSavedAt, setJournalLastSavedAt] = useState<string | null>(() => {
    if (!journalCloudToken || !cloudEnabled) return null
    try {
      const value = localStorage.getItem(`${effectiveStorageKey}.journal-last-synced`)
      return value && Number.isFinite(Date.parse(value)) ? value : null
    } catch { return null }
  })
  const [guestNotesAvailable, setGuestNotesAvailable] = useState(() => journalCloudToken && !guestCloud ? guestJournalCount(loadResult.data) : 0)
  const [journalPrompt, setJournalPrompt] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')

  useEffect(() => {
    if (journalCloudToken && !guestCloud) setGuestNotesAvailable(guestJournalCount(data))
  }, [journalCloudToken, guestCloud, data.journal])

  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => {
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.last-view`, view === 'journal' ? 'journal' : 'other') }
    catch { /* Navigation still works when browser storage is unavailable. */ }
  }, [storageKey, view])

  useEffect(() => {
    const selected = data.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.theme
    document.documentElement.dataset.theme = selected
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => { if (data.theme === 'system') document.documentElement.dataset.theme = media.matches ? 'dark' : 'light' }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [data.theme])
  useEffect(() => {
    if (!data.activeSession || data.activeSession.pausedAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    const refresh = () => setNow(Date.now())
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    refresh()
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [data.activeSession])
  const changeJournalDraft = (change: SetStateAction<JournalDraft>) => {
    const next = typeof change === 'function' ? change(journalDraftRef.current) : change
    journalDraftRef.current = next
    const persisted = writeJournalDraft(next, storageKey)
    setJournalDraftError(!persisted)
    if (!persisted) setStorageError(true)
    setJournalDraft(next)
  }
  const toggleFocusTime = () => {
    const next = !showTime
    setShowTime(next)
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-time`, next ? 'visible' : 'hidden') }
    catch { setStorageError(true) }
  }
  useEffect(() => {
    if (!reflectionNotice) return
    const timeout = window.setTimeout(() => setReflectionNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [reflectionNotice])

  const update = (change: (current: LiveOSData) => LiveOSData) => {
    if (loadResult.error) { setStorageError(true); return false }
    let next = change(dataRef.current)
    try {
      if (cloudEnabled) next = withJournalChanges(dataRef.current, next)
    } catch {
      setStorageError(true)
      return false
    }
    const persisted = saveData(next, storageKey)
    setStorageError(!persisted)
    if (persisted) {
      dataRef.current = next
      setLoadResult({ data: next, error: null })
      if (cloudEnabled && next.journalCloud?.pending.length) void journalCloud.current?.sync()
    }
    return persisted
  }

  const canUseTimeCloud = serviceMode === 'time' && !storageKey && !existingAccount &&
    import.meta.env.VITE_LIVETIME_HISTORY_ENABLED === 'true' && !loadResult.error
  const timeCloud = useTimeCloud(canUseTimeCloud, data.sessions, data.pendingSession?.id, incoming => {
    const current = dataRef.current
    const sessions = new Map(current.sessions.map(session => [session.id, session]))
    let changed = false
    for (const session of incoming) {
      const local = sessions.get(session.id)
      if (session.id === current.pendingSession?.id || session.id === current.activeSession?.id) continue
      if (!local || (local.interest === null && session.interest !== null)) {
        sessions.set(session.id, session)
        changed = true
      }
    }
    return !changed || update(value => ({ ...value, sessions: [...sessions.values()] }))
  })

  useEffect(() => {
    if (!journalCloudToken || !cloudEnabled || loadResult.error) return
    const sync = new JournalCloudSync({
      getData: () => dataRef.current,
      save: next => {
        if (!saveData(next, storageKey)) return false
        dataRef.current = next
        setLoadResult({ data: next, error: null })
        return true
      },
      token: journalCloudToken,
      status: message => {
        setJournalCloudStatus(message)
        if (message === 'Syncing Journal…') setJournalCloudError(false)
        if (message === 'Journal saved in cloud.') {
          setJournalCloudError(false)
          const savedAt = new Date().toISOString()
          setJournalLastSavedAt(savedAt)
          try { localStorage.setItem(`${effectiveStorageKey}.journal-last-synced`, savedAt) } catch { /* Status remains visible for this session. */ }
        } else if (message !== 'Syncing Journal…') setJournalCloudError(true)
      },
    })
    journalCloud.current = sync
    sync.start()
    return () => {
      sync.stop()
      if (journalCloud.current === sync) journalCloud.current = null
    }
  }, [storageKey, cloudEnabled, loadResult.error])

  const verifyRecoveryCode = async (code: string) => {
    const normalized = normalizeRecoveryCode(code)
    if (!normalized) return false
    try {
      const response = await fetch('/api/journal?guest=status', { headers: { Authorization: `Guest ${normalized}` }, cache: 'no-store' })
      return response.ok && (await response.json()).exists === true
    } catch { return false }
  }

  const enableJournalCloud = async (code: string | null) => {
    if (!journalCloudToken || loadResult.error || cloudEnabled) return false
    if (guestCloud) {
      const normalized = normalizeRecoveryCode(code ?? '')
      if (!normalized) return false
      try {
        const response = await fetch('/api/journal?guest=create', { method: 'POST', headers: { Authorization: `Guest ${normalized}` }, cache: 'no-store' })
        if (!response.ok) return false
        localStorage.setItem(guestRecoveryStorageKey, normalized)
        localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true')
        setRecoveryCode(normalized)
      } catch { return false }
    } else {
      try { localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true') }
      catch { return false }
    }
    setCloudEnabled(true)
    return true
  }

  const recoverJournalCloud = async (code: string) => {
    const normalized = normalizeRecoveryCode(code)
    if (!guestCloud || !normalized || loadResult.error || !(await verifyRecoveryCode(normalized))) return false
    const current = dataRef.current
    const next = { ...current, journalCloud: { version: 1 as const, migrated: false, pending: [] } }
    if (!saveData(next, storageKey)) return false
    try {
      localStorage.setItem(guestRecoveryStorageKey, normalized)
      localStorage.setItem(cloudConsentKey(effectiveStorageKey), 'true')
    } catch { return false }
    dataRef.current = next
    setLoadResult({ data: next, error: null })
    setRecoveryCode(normalized)
    setJournalLastSavedAt(null)
    setCloudEnabled(true)
    return true
  }

  const importGuestJournal = async () => {
    if (!window.confirm('Copy guest Journal entries and folders into this account? The guest copy will stay on this device.')) return
    try {
      await journalCloud.current?.importGuest()
      setGuestNotesAvailable(0)
      setJournalCloudStatus('Guest Journal copied into this account. The guest copy is still on this device.')
    } catch (error) {
      setJournalCloudStatus(error instanceof Error ? error.message : 'Guest Journal could not be copied. Its local copy was kept.')
    }
  }

  const { deleteTask, deleteJournalEntry, clearUndo, undoNotice } = useDeleteUndo(dataRef, update)

  const importBytes = async (name: string, type: string, bytes: Uint8Array, index?: SourceIndex): Promise<boolean> => {
    const note = await makeImportedNote(name, type, bytes)
    const blocks = index ? buildNoteBlocks(note, index) : null
    if (blocks) note.noteBlocks = blocks
    const existing = dataRef.current.importedNotes.find(item => item.sha256 === note.sha256)
    if (existing) {
      if (existing.rawBytesBase64 !== note.rawBytesBase64) throw new Error('Stored source bytes differ from the original')
      if (blocks && JSON.stringify(existing.noteBlocks) !== JSON.stringify(blocks)) {
        if (!update(current => ({ ...current, importedNotes: current.importedNotes.map(item => item.id === existing.id ? { ...item, noteBlocks: blocks } : item) }))) throw new Error('Local storage is unavailable')
      }
      return false
    }
    if (!update(current => ({ ...current, importedNotes: [...current.importedNotes, note] }))) throw new Error('Local storage is unavailable')
    return true
  }

  useEffect(() => {
    if (storageKey) return
    let cancelled = false
    async function importLocalSources() {
      try {
        const response = await fetch('/__lifeos_local_notes', { cache: 'no-store' })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return
        const sources = await response.json() as { name: string; type: string; bytesBase64: string; index?: SourceIndex }[]
        if (!Array.isArray(sources)) return
        for (const source of sources) {
          if (cancelled) return
          await importBytes(source.name, source.type, base64ToBytes(source.bytesBase64), source.index)
        }
      } catch { /* A production build has no private local seed endpoint. */ }
    }
    void importLocalSources()
    return () => { cancelled = true }
  }, [])

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const backupText = await file.text()
      const next = await restoreBackup(backupText, dataRef.current, localStorage, () => window.confirm('Replace your current tasks, sessions, journal, and settings with this backup? Any readable imported Notes will be kept. Unreadable saved data will be preserved for recovery.'), storageKey,
        cloudEnabled ? restored => withJournalChanges(dataRef.current, { ...restored, journalCloud: dataRef.current.journalCloud }) : undefined)
      if (!next) return
      clearUndo()
      dataRef.current = next
      setLoadResult({ data: next, error: null })
      setStorageError(false)
      void journalCloud.current?.sync()
      setBackupMessage('Backup restored. Readable imported Notes were kept; previous unreadable data was preserved for recovery.')
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Backup could not be restored.')
    } finally {
      event.target.value = ''
    }
  }

  const startFocus = (task?: Task) => {
    if (dataRef.current.activeSession || dataRef.current.pendingSession) return false
    const now = Date.now()
    const sessionId = crypto.randomUUID()
    const compact = timerView(dataRef.current) === 'compact'
    const started = update(current => ({
      ...current,
      activeSession: {
        id: sessionId,
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? findFocusPreset(current.focusPresetId)?.label ?? 'Open focus',
        startedAt: new Date(now).toISOString(),
        silenceBreakReminders: findFocusPreset(current.focusPresetId)?.silenceBreakReminders,
      },
    }))
    if (started) {
      if (compact) {
        try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, sessionId) } catch { setStorageError(true) }
        setMinimizedFocusScreen(sessionId)
        if (view !== 'main' && view !== 'tasks') navigate(showHome ? 'main' : defaultView)
      } else {
        try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Focus still opens. */ }
        setMinimizedFocusScreen(undefined)
      }
      setPausedFocusScreen(undefined)
      setNow(now)
    }
    return started
  }

  const pauseSession = (stayInFocus: boolean, returnHome = true) => {
    const session = dataRef.current.activeSession
    if (!session) return
    if (!session.pausedAt) {
      const pausedAt = new Date()
      if (!update(current => ({ ...current, activeSession: { ...session, pausedAt: pausedAt.toISOString(), breakReminderDismissed: undefined } }))) return
      setNow(pausedAt.getTime())
    }
    setPausedFocusScreen(stayInFocus ? session.id : undefined)
    if (!stayInFocus && returnHome) navigate(showHome ? 'main' : defaultView)
  }

  const resumeSession = (stayCompact = false) => {
    const session = dataRef.current.activeSession
    if (!session?.pausedAt) return
    const now = Date.now()
    const pausedDurationMs = (session.pausedDurationMs ?? 0) + Math.max(0, now - Date.parse(session.pausedAt))
    if (update(current => ({
      ...current,
      activeSession: { ...session, pausedAt: undefined, pausedDurationMs, breakReminderDismissed: undefined },
    }))) {
      setMinimizedFocusScreen(stayCompact ? session.id : undefined)
      try {
        if (stayCompact) localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, session.id)
        else localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`)
      } catch { setStorageError(true) }
      setPausedFocusScreen(undefined)
      setNow(now)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  const returnToFocus = () => {
    setPausedFocusScreen(dataRef.current.activeSession?.pausedAt ? dataRef.current.activeSession.id : undefined)
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Focus still opens. */ }
    setNow(Date.now())
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const minimizeFocus = () => {
    const session = dataRef.current.activeSession
    if (!session || session.pausedAt) return
    try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, session.id) }
    catch { setStorageError(true) }
    setMinimizedFocusScreen(session.id)
    navigate(showHome ? 'main' : defaultView)
  }

  const toggleFocusSilence = () => {
    const session = dataRef.current.activeSession
    if (!session) return
    update(current => ({
      ...current,
      activeSession: { ...session, silenceBreakReminders: !session.silenceBreakReminders },
      focusPresetId: undefined,
    }))
  }

  const dismissBreakReminder = () => {
    const session = dataRef.current.activeSession
    if (!session?.pausedAt) return
    update(current => ({ ...current, activeSession: { ...session, breakReminderDismissed: true } }))
  }

  const endSession = () => {
    const current = dataRef.current
    if (!current.activeSession) return
    const finished = { ...current.activeSession, endedAt: new Date().toISOString() }
    if (!update(data => ({ ...recordUnratedSession({ ...data, activeSession: null }, finished), pendingSession: finished }))) return
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Session is already saved. */ }
    setCheckingIn(false)
    setInterest(0)
    setContinueDesire(0)
    setProgress(0)
    setSelectedFactors([])
  }

  const cancelSession = () => {
    if (!dataRef.current.activeSession) return
    if (!update(current => ({ ...current, activeSession: null }))) return
    setPausedFocusScreen(undefined)
    setMinimizedFocusScreen(undefined)
    try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { setStorageError(true) }
  }

  const choosePostFocusAction = (action: 'reflection' | 'check-in') => {
    const pending = dataRef.current.pendingSession
    if (!pending) return
    if (action === 'check-in') {
      setCheckingIn(true)
      return
    }
    if (update(current => recordUnratedSession(current, pending))) {
      setCheckingIn(false)
      setPostFocusReflection(true)
      setReflectionReturnView(showHome ? 'main' : defaultView)
      setView('flow')
    }
  }

  const skipPostFocus = () => {
    const pending = dataRef.current.pendingSession
    if (!pending) return
    if (!update(current => recordUnratedSession(current, pending))) return
    setCheckingIn(false)
    navigate(showHome ? 'main' : defaultView)
  }

  const saveCheckin = (event: FormEvent) => {
    event.preventDefault()
    const pending = dataRef.current.pendingSession
    if (!interest || !continueDesire || !progress || !pending) return
    const saved = update(current => {
      const ratedSession = {
        id: pending.id, taskId: pending.taskId, taskTitle: pending.taskTitle,
        startedAt: pending.startedAt, endedAt: pending.endedAt,
        durationMs: focusedDuration(pending, Date.parse(pending.endedAt)),
        interest, continueDesire, progress, factors: selectedFactors,
      }
      return {
        ...current,
        pendingSession: null,
        sessions: current.sessions.some(session => session.id === pending.id)
          ? current.sessions.map(session => session.id === pending.id ? ratedSession : session)
          : [ratedSession, ...current.sessions],
      }
    })
    if (!saved) return
    if (showJournal) {
      setJournalPrompt(true)
      setView('journal')
    } else {
      navigate(defaultView)
    }
  }

  const createJournalEntry = (draft: JournalDraft, folderId?: string) => {
    const saved = update(current => ({
      ...current,
      journal: [{
        ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString(), createdOn: detectJournalDevice(navigator), taskId: journalTaskId,
        folderId: current.journalFolders?.some(folder => folder.id === folderId) ? folderId : undefined,
      }, ...current.journal],
    }))
    if (saved) {
      if (!clearJournalDraft(storageKey)) setStorageError(true)
      setJournalDraftError(false)
      journalDraftRef.current = { text: '' }
      setJournalDraft({ text: '' })
      setJournalTaskId(undefined)
      setJournalPrompt(false)
    }
    return saved
  }

  const editJournalEntry = (id: string, draft: JournalDraft) => update(current => ({
    ...current,
    journal: current.journal.map(entry => entry.id === id ? { ...entry, text: draft.text, photo: draft.photo, location: draft.location,
      linkedEntryId: draft.linkedEntryId === id ? undefined : draft.linkedEntryId, updatedAt: new Date().toISOString() } : entry),
  }))

  const saveJournalFolder = (name: string, appearance: JournalFolderAppearance, id?: string) => {
    const folders = dataRef.current.journalFolders ?? []
    if (folders.some(folder => folder.id !== id && folder.name.toLowerCase() === name.toLowerCase())) return false
    const journalFolders = id
      ? folders.map(folder => folder.id === id ? { ...folder, name, ...appearance } : folder)
      : [...folders, { id: crypto.randomUUID(), name, ...appearance }]
    return update(current => ({ ...current, journalFolders }))
  }

  const reorderJournalFolders = (from: string, to: string) => {
    const folders = [...(dataRef.current.journalFolders ?? [])]
    const fromIndex = folders.findIndex(folder => folder.id === from)
    const toIndex = folders.findIndex(folder => folder.id === to)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false

    const [moved] = folders.splice(fromIndex, 1)
    folders.splice(toIndex, 0, moved)
    return update(current => ({ ...current, journalFolders: folders }))
  }

  const deleteJournalFolder = (id: string) => update(current => ({
    ...current,
    journalFolders: current.journalFolders?.filter(folder => folder.id !== id),
    journal: current.journal.map(entry => entry.folderId === id ? { ...entry, folderId: undefined } : entry),
  }))

  const moveJournalEntry = (id: string, folderId?: string) => {
    const current = dataRef.current
    if (folderId !== undefined && !current.journalFolders?.some(folder => folder.id === folderId)) return false
    return update(data => ({
      ...data,
      journal: data.journal.map(entry => entry.id === id ? { ...entry, folderId } : entry),
    }))
  }

  const exportData = () => {
    const { journalCloud: _sync, ...exportable } = data
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `liveos-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const navigate = (next: View) => {
    setJournalSearchResult(undefined)
    if (next !== 'flow') setPostFocusReflection(false)
    if (next === 'flow' && view !== 'flow') {
      setReflectionReturnView(view)
      setReflectionNotice('')
    }
    setView(isHidden(next) ? defaultView : next)
    setJournalPrompt(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openPresets = () => {
    setPresetsReturnView(view)
    navigate('presets')
  }

  const applyPreset = (id: FocusPresetId) => {
    const preset = findFocusPreset(id)
    if (!preset) return false
    const idle = !dataRef.current.activeSession && !dataRef.current.pendingSession
    const startedAt = Date.now()
    const sessionId = crypto.randomUUID()
    const compact = timerView(dataRef.current) === 'compact'
    const saved = update(current => {
      const configured = applyFocusPreset(current, id)
      if (!idle || configured.activeSession || configured.pendingSession) return configured
      return {
        ...configured,
        activeSession: {
          id: sessionId,
          taskId: null,
          taskTitle: preset.label,
          startedAt: new Date(startedAt).toISOString(),
          silenceBreakReminders: preset.silenceBreakReminders,
        },
      }
    })
    if (saved && idle) {
      if (compact) {
        try { localStorage.setItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`, sessionId) } catch { setStorageError(true) }
        setMinimizedFocusScreen(sessionId)
        navigate(showHome ? 'main' : defaultView)
      } else {
        try { localStorage.removeItem(`${storageKey ?? STORAGE_KEY}.focus-minimized`) } catch { /* Focus still opens. */ }
        setMinimizedFocusScreen(undefined)
      }
      setPausedFocusScreen(undefined)
      setNow(startedAt)
    }
    return saved
  }

  const returnLabel = showHome ? 'Back to Hub' : serviceMode === 'time' ? language === 'ru' ? 'Домой' : 'Back to Home' : 'Back to Settings'
  const returnFromSection = () => navigate(showHome ? 'main' : serviceMode === 'time' ? 'time-home' : 'settings')
  const reflectionReturnLabel = reflectionReturnView === 'main' ? 'Back to Hub'
    : reflectionReturnView === 'ask' ? 'Back to Guide'
      : reflectionReturnView === 'journal' ? 'Back to Journal'
        : reflectionReturnView === 'tasks' ? 'Back to Tasks' : 'Back to Settings'

  const openSearchEntry = (id: string) => {
    if (!showJournal) return
    setView('journal')
    setJournalPrompt(false)
    setJournalSearchResult({ id })
  }

  const changeHomeVisibility = (visible: boolean) => update(current => {
    const hidden = (current.hiddenSections ?? []).filter(id => id !== 'main')
    return { ...current, hiddenSections: visible ? hidden : [...hidden, 'main'] }
  })

  const changeShortcut = (id: Shortcut, location: ShortcutLocation, visible: boolean) => update(current => ({
    ...current,
    shortcutPreferences: {
      ...current.shortcutPreferences,
      [id]: { ...current.shortcutPreferences?.[id], [location]: visible },
    },
  }))

  const renderNavigation = (iconSize: number, bottom = false) => <>
    {showHome && <NavButton icon={<House size={iconSize} />} label="Hub" selected={view === 'main'} onClick={() => {
      if (view === 'main') setHomeNavigationKey(key => key + 1)
      navigate('main')
    }} />}
    {serviceMode === 'time' && <NavButton icon={<House size={iconSize} />} label={language === 'ru' ? 'Домой' : 'Home'} selected={view === 'time-home'} onClick={() => navigate('time-home')} />}
    {!bottom && <NavButton icon={<Settings2 size={iconSize} />} label={t('Settings')} selected={view === 'settings'} onClick={() => navigate('settings')} />}
    {visibleShortcuts.filter(({ id }) => inBar(id)).sort((a, b) => bottom ? Number(b.id === 'tasks') - Number(a.id === 'tasks') : 0).map(({ id }) => {
      const Icon = shortcutIcons[id]
      return <NavButton key={id} icon={<Icon size={iconSize} />} label={serviceLabels[id]} selected={view === id}
        onClick={() => {
          if (id !== 'focus') navigate(id)
          else if (data.activeSession) returnToFocus()
          else startFocus()
        }} />
    })}
    {serviceMode === 'time' && <NavButton icon={<History size={iconSize} />} label={t('Focus history')} selected={view === 'focus-history'} onClick={() => navigate('focus-history')} />}
    {showAskLiveOS && <NavButton icon={<MessageCircle size={iconSize} />} label={t('Guide')} selected={view === 'ask'} onClick={() => navigate('ask')} />}
    {bottom && <NavButton icon={<Settings2 size={iconSize} />} label={t('Settings')} selected={view === 'settings'} onClick={() => navigate('settings')} />}
    {serviceMode === 'time' && <a className="nav-button" href={hubUrl} aria-label={language === 'ru' ? 'Вернуться в Hub' : 'Back to Hub'}>
      <ArrowLeft size={iconSize} aria-hidden="true" /><span>{language === 'ru' ? 'Вернуться в Hub' : 'Back to Hub'}</span>
    </a>}
  </>

  const renderBrand = (size: number) => {
    const logo = <><span className="brand-mark"><Leaf size={size} strokeWidth={2.4} /></span><span>{serviceName}<span className="brand-dot">.</span></span></>
    return showHome || serviceMode === 'time'
      ? <button className="brand" onClick={() => navigate(showHome ? 'main' : 'time-home')} aria-label={`${serviceName} home`}>{logo}</button>
      : <div className="brand">{logo}</div>
  }

  const openTaskHistory = (taskId: string) => setTaskHistoryId(taskId)
  const historyTask = data.tasks.find(task => task.id === taskHistoryId)
  const linkedTaskTitle = journalTaskId === undefined ? undefined
    : data.tasks.find(task => task.id === journalTaskId)?.title ?? 'Deleted task'

  const pausedSession = data.activeSession?.pausedAt ? data.activeSession : null
  const reminderMinutes = data.breakReminderMinutes ?? 0
  const reminderDueAt = pausedSession?.pausedAt && reminderMinutes > 0 && !pausedSession.breakReminderDismissed && !pausedSession.silenceBreakReminders
    ? Date.parse(pausedSession.pausedAt) + reminderMinutes * 60_000
    : null

  const breakReminder = reminderDueAt !== null && <BreakReminder dueAt={reminderDueAt}
    onResume={resumeSession} onDismiss={dismissBreakReminder} />

  const clearOnboardingPreviewUrl = () => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('onboarding')) return
    url.searchParams.delete('onboarding')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }

  const finishOnboarding = (name: string, destination: OnboardingDestination) => {
    if (onboardingMode === 'first-run') {
      if (!update(current => ({ ...current, displayName: name || undefined }))) return false
      try { localStorage.setItem(completionKey(storageKey), 'done') } catch { /* Saved data itself marks an existing user. */ }
    }
    clearOnboardingPreviewUrl()
    setOnboardingMode(null)
    navigate(destination === 'focus' ? defaultView : destination)
    return true
  }

  if (showTimeIntro && !data.activeSession && !data.pendingSession) {
    const russian = language === 'ru'
    return <div className="lifeos-onboarding" style={{ insetBlock: 0, height: '100dvh' }}>
      <div className="lifeos-onboarding__header" aria-hidden="true" />
      <main className="lifeos-onboarding__content">
        <p className="lifeos-onboarding__eyebrow">{serviceName}</p>
        <h1>{russian ? 'Время для фокуса' : 'Make time to focus'}</h1>
        <p className="lifeos-onboarding__description">{russian
          ? 'Запускайте таймер, выбирайте пресеты и просматривайте историю сессий.'
          : 'Start a timer, choose a preset, and revisit your focus sessions.'}</p>
      </main>
      <footer className="lifeos-onboarding__footer">
        <button type="button" className="lifeos-onboarding__primary" onClick={() => {
          try { localStorage.setItem('livetime:intro-seen', 'true') } catch { /* Continue for this visit. */ }
          setShowTimeIntro(false)
          navigate('time-home')
        }}>{russian ? 'Открыть таймер' : 'Open timer'}</button>
        <a className="nav-button" href={hubUrl} style={{ width: 'fit-content', marginInlineStart: 'auto' }}>
          <ArrowLeft size={19} aria-hidden="true" />
          <span>{russian ? 'Вернуться в Hub' : 'Back to Hub'}</span>
        </a>
      </footer>
    </div>
  }

  if (onboardingMode) return <WebOnboarding mode={onboardingMode} displayName={data.displayName ?? ''} language={language}
    account={account && !existingAccount ? mode => account(language, mode) : undefined}
    onComplete={finishOnboarding} onClose={() => { clearOnboardingPreviewUrl(); setOnboardingMode(null) }} />

  if (data.activeSession && ((!pausedSession && minimizedFocusScreen !== data.activeSession.id) ||
    (pausedSession !== null && pausedFocusScreen === pausedSession.id))) return <>
    <MainFocus
      language={language}
      session={data.activeSession}
      showTime={showTime}
      now={now}
      storageError={storageError}
      checkinEnabled={data.focusCheckinEnabled !== false}
      showCheckinToggle={!data.postFocusAction}
      onToggleCheckin={() => update(current => ({ ...current, focusCheckinEnabled: current.focusCheckinEnabled === false }))}
      onToggleTime={toggleFocusTime}
      onToggleSilence={toggleFocusSilence}
      onPause={() => pauseSession(true)}
      onResume={() => resumeSession()}
      onLeave={() => pauseSession(false)}
      onMinimize={minimizeFocus}
      returnDestination={serviceMode === 'time' ? 'Home' : showHome ? 'Hub' : shortcuts.find(({ id }) => id === defaultView)?.label ?? 'Settings'}
      onFinish={endSession}
    >
      {breakReminder}
    </MainFocus>
    {undoNotice}
  </>

  if (data.pendingSession && !checkingIn) return <PostFocusChoice
    language={language}
    taskTitle={data.pendingSession.taskTitle}
    storageError={storageError}
    preferred={data.postFocusAction}
    onChoose={choosePostFocusAction}
    onSkip={skipPostFocus}
  />

  if (data.pendingSession) return (<>
    <main className="checkin-screen page-container">
      {storageError && <div className="storage-error" role="alert">{t('Your browser could not save the check-in. Your answers are still here. Check available storage and try again.')}</div>}
      <div className="focus-top"><div className="brand-mark"><Leaf size={18} strokeWidth={2.3} /></div><span>{t('LiveOS Portable / Check-in')}</span></div>
      <div className="checkin-card">
        <div className="section-icon"><Sparkles size={20} /></div>
        <p className="eyebrow">{t('A MOMENT TO REFLECT')}</p>
        <h1>{t('How did it feel?')}</h1>
        <p className="muted">{data.pendingSession.taskId === null
          ? t('Your focus session is complete.')
          : language === 'ru' ? `Сессия «${data.pendingSession.taskTitle}» завершена.` : `Your time with “${data.pendingSession.taskTitle}” is complete.`} {t('A few quick answers help you notice what works.')}</p>
        <button type="button" className="checkin-turn-off" onClick={() => setCheckingIn(false)}>{t('Back to choices')}</button>
        <form onSubmit={saveCheckin}>
          <Rating language={language} label="Interest in the process" value={interest} onChange={setInterest} />
          <Rating language={language} label="Desire to continue" value={continueDesire} onChange={setContinueDesire} />
          <Rating language={language} label="Sense of progress" value={progress} onChange={setProgress} />
          <div className="factor-field"><span className="field-label">{t('What helped?')} <span className="optional">{t('Optional')}</span></span><div className="factor-options">{factors.map(factor => <button type="button" key={factor} className={`factor-chip ${selectedFactors.includes(factor) ? 'selected' : ''}`} onClick={() => setSelectedFactors(current => current.includes(factor) ? current.filter(item => item !== factor) : [...current, factor])}>{t(factor)}</button>)}</div></div>
          <button className="button button-dark checkin-submit" disabled={!interest || !continueDesire || !progress}>{t('Save check-in')} <ArrowRight size={18} /></button>
        </form>
      </div>
    </main>
    {undoNotice}
  </>)

  const visibleNavCount = Number(showHome) + visibleShortcuts.filter(({ id }) => inBar(id)).length + Number(serviceMode === 'time') * 3 + Number(showAskLiveOS) + 1
  const mobileNavLayout = mobileNavigationLayout(visibleNavCount)
  const extraNavHeight = (mobileNavLayout.rows - 1) * 66
  const mobileNavStyle = {
    '--life-mobile-nav-height': `calc(${78 + extraNavHeight}px + env(safe-area-inset-bottom))`,
    '--life-mobile-nav-extra': `${extraNavHeight}px`,
    '--life-mobile-nav-columns': mobileNavLayout.columns,
  } as CSSProperties

  return (
    <div className={view === 'flow' || view === 'focus-history' ? 'app-shell flow-shell' : 'app-shell'} style={mobileNavStyle}>
      <aside className="sidebar">
        {renderBrand(20)}
        <nav aria-label="Main navigation">{renderNavigation(19)}</nav>
        <div className="sidebar-foot"><div className="sidebar-quote"><span>✳</span><p>{t('A little space for what matters.')}</p></div><span>{serviceName} v0.1</span></div>
      </aside>

      <div className="main-area">
        <header className="mobile-header">{renderBrand(18)}<span>v0.1</span></header>
        {(storageError || loadResult.error) && <div className="storage-error" role="alert">{loadResult.error ?? 'Your browser could not save changes locally. Your unsaved text is still here. Check available storage, then try again.'} {loadResult.error && 'Import a valid backup below to recover. Existing saved content will not be changed until recovery succeeds.'}</div>}
        {backupMessage && <div className="storage-error" role="status">{backupMessage}</div>}
        {reflectionNotice && <div className="lifeos-reflection-confirmation" role="status">{reflectionNotice}</div>}
        {breakReminder}
        {view === 'time-home' && <main className="life-time-home">
          <div className="life-time-home-content">
            <p className="life-time-home-eyebrow">LiveTime</p>
            <h1>{language === 'ru' ? 'Таймер' : 'Timer'}</h1>
            <div className="life-time-home-clock" role="timer" aria-label={language === 'ru' ? 'Время фокуса' : 'Focus time'}>
              {data.activeSession ? elapsedClock(focusedDuration(data.activeSession, now)) : '00:00'}
            </div>
            <p className="life-time-home-caption">{data.activeSession
              ? data.activeSession.taskTitle
              : language === 'ru' ? 'Начните, когда будете готовы.' : 'Start when you are ready.'}</p>
            <button type="button" className="life-time-home-start" onClick={data.activeSession ? returnToFocus : () => { startFocus() }}>
              <Play size={19} aria-hidden="true" /> {data.activeSession
                ? language === 'ru' ? 'Открыть таймер' : 'Open timer'
                : language === 'ru' ? 'Запустить таймер' : 'Start timer'}
            </button>
            <button type="button" className="life-time-home-presets" onClick={openPresets}>
              {language === 'ru' ? 'Пресеты' : 'Presets'}
            </button>
          </div>
        </main>}
        {(view === 'main' || view === 'tasks') && <MainDashboard key={`${view}:${homeNavigationKey}`}
          initialScreen={view === 'tasks' ? 'tasks' : 'home'}
          hideBack={serviceMode === 'tasks'}
          onReturnHome={view === 'tasks' ? returnFromSection : undefined}
          returnLabel={returnLabel}
          showTasksShortcut={onHome('tasks')}
          showFocusShortcut={onHome('focus')}
          searchIncludesJournal={showJournal}
          repoUrl={repoUrl}
          tasks={data.tasks}
          focusTaskTitle={data.activeSession?.taskTitle}
          focusRunning={Boolean(data.activeSession && !pausedSession)}
          pausedActiveTime={data.activeSession ? elapsedClock(focusedDuration(data.activeSession, now)) : undefined}
          showPausedTime={showTime}
          displayName={data.displayName}
          language={data.language ?? 'en'}
          onPauseFocus={() => pauseSession(false, false)}
          onContinueFocus={() => resumeSession(true)}
          onReturnToFocus={returnToFocus}
          onFinishPaused={endSession}
          onCancelFocus={cancelSession}
          onUpdate={update}
          onOpenTask={openTaskHistory}
          onDeleteTask={deleteTask}
          onStart={startFocus}
          onStartOpenFocus={() => startFocus()}
          onJournal={onHome('journal') ? () => navigate('journal') : undefined}
          onFocusHistory={() => navigate('focus-history')}
          onSettings={() => navigate('settings')}
          onSearch={() => setSearchOpen(true)}
        />}

        {view === 'ask' && <main className="life-main life-main-guide-page">
          <h1>{t('Guide')}</h1>
          <AskLiveOS language={language} actions={{
            tasks: () => navigate('tasks'),
            journal: showJournal ? () => navigate('journal') : undefined,
            focus: data.activeSession ? returnToFocus : () => { startFocus() },
            settings: () => navigate('settings'),
          }} />
        </main>}

        {view === 'presets' && <FocusPresets
          language={data.language ?? 'en'}
          appliedPresetId={data.focusPresetId}
          sessionState={data.pendingSession ? 'pending' : data.activeSession ? 'active' : 'idle'}
          onApply={applyPreset}
          onBack={() => navigate(presetsReturnView)}
        />}

        {(view === 'flow' || view === 'focus-history') && <FlowEnginePage key={view}
          timeFormat={timeFormat}
          language={language}
          data={data} onUpdate={update}
          onReturn={view === 'flow' ? () => navigate(reflectionReturnView) : returnFromSection}
          returnLabel={view === 'flow' ? reflectionReturnLabel : returnLabel}
          onReflectionSaved={() => {
            setReflectionNotice('Reflection saved.')
            navigate(reflectionReturnView)
          }}
          sessionsOnly={view === 'focus-history'} />}

        {view === 'journal' && (
          <JournalPage language={language} timeFormat={timeFormat} entries={data.journal} folders={data.journalFolders ?? []} draft={journalDraft} onDraftChange={changeJournalDraft}
            hideBack={serviceMode === 'journal'}
            draftSaveError={journalDraftError}
            draftStorageKey={storageKey} onDraftStorageError={() => setStorageError(true)}
            cloudStatus={cloudEnabled ? journalCloudStatus : undefined}
            guestImportCount={cloudEnabled ? guestNotesAvailable : 0} onImportGuest={cloudEnabled && !guestCloud ? importGuestJournal : undefined}
            onReturn={returnFromSection} returnLabel={returnLabel}
            onSaveFolder={saveJournalFolder} onReorderFolders={reorderJournalFolders} onDeleteFolder={deleteJournalFolder} onMoveEntry={moveJournalEntry}
            linkedTaskTitle={linkedTaskTitle} onUnlinkTask={() => setJournalTaskId(undefined)}
            sessionPrompt={journalPrompt} onDismissPrompt={() => setJournalPrompt(false)}
            searchResult={journalSearchResult} onSelectSearchEntry={openSearchEntry}
            onCreate={createJournalEntry} onEdit={editJournalEntry} onDelete={deleteJournalEntry} />
        )}

        {view === 'settings' && (
          <SettingsPage
            timeCloud={canUseTimeCloud ? <TimeCloudPanel cloud={timeCloud} ru={language === 'ru'} /> : undefined}
            account={accountContent}
            journalSync={{ available: Boolean(journalCloudToken), enabled: cloudEnabled, guest: guestCloud, code: recoveryCode, status: journalCloudStatus,
              error: journalCloudError, lastSavedAt: journalLastSavedAt,
              onRetry: () => void journalCloud.current?.sync(), onEnable: enableJournalCloud,
              onVerifyRecovery: verifyRecoveryCode, onRecover: recoverJournalCloud }}
            theme={data.theme}
            language={data.language ?? 'en'}
            timeFormat={timeFormat}
            onTimeFormatChange={timeFormat => update(current => ({ ...current, timeFormat }))}
            onLanguageChange={language => update(current => ({ ...current, language }))}
            onThemeChange={theme => update(current => ({ ...current, theme }))}
            interactiveTips={data.interactiveTips !== false}
            onInteractiveTipsChange={interactiveTips => update(current => ({ ...current, interactiveTips }))}
            showHome={showHome}
            onHomeVisibilityChange={changeHomeVisibility}
            showAskLiveOS={showAskLiveOS}
            onAskLiveOSVisibilityChange={askLiveOSInBar => update(current => ({ ...current, askLiveOSInBar }))}
            shortcutVisible={(id, location) => location === 'home' ? onHome(id) : inBar(id)}
            onShortcutChange={changeShortcut}
            onExport={exportData}
            onImport={importBackup}
            repoUrl={repoUrl}
            displayName={data.displayName ?? ''}
            onDisplayNameChange={displayName => update(current => ({ ...current, displayName: displayName || undefined }))}
            reminderMinutes={reminderMinutes}
            timerDefaultView={timerView(data)}
            onTimerDefaultViewChange={timerDefaultView => update(current => ({ ...current, timerDefaultView }))}
            onReminderMinutesChange={breakReminderMinutes => update(current => ({ ...current, breakReminderMinutes, focusPresetId: undefined }))}
            focusCheckin={{
              enabled: data.focusCheckinEnabled !== false,
              onChange: focusCheckinEnabled => update(current => ({ ...current, focusCheckinEnabled })),
            }}
            postFocusAction={{
              value: data.postFocusAction,
              onChange: postFocusAction => update(current => ({ ...current, postFocusAction })),
            }}
            onOpenPresets={openPresets}
          />
        )}
      </div>
      {historyTask && <TaskHistory
        timeFormat={timeFormat}
        language={language}
        key={historyTask.id}
        task={historyTask}
        sessions={data.sessions.filter(session => session.taskId === historyTask.id).sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))}
        entries={data.journal.filter(entry => entry.taskId === historyTask.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))}
        availableEntries={data.journal.filter(entry => entry.taskId === undefined).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))}
        linksExistingDraft={Boolean((journalDraft.text.trim() || journalDraft.photo) && journalTaskId !== historyTask.id)}
        focusAction={data.activeSession?.pausedAt && data.activeSession.taskId === historyTask.id ? 'resume' : data.activeSession || data.pendingSession ? 'unavailable' : 'start'}
        focusMessage={data.activeSession?.pausedAt && data.activeSession.taskId !== historyTask.id ? 'Finish or resume your current focus before starting this task.' : data.pendingSession ? 'Finish your focus check-in first.' : undefined}
        onClose={() => setTaskHistoryId(null)}
        onFocus={() => {
          if (dataRef.current.activeSession?.pausedAt && dataRef.current.activeSession.taskId === historyTask.id) resumeSession()
          else if (!dataRef.current.activeSession && !dataRef.current.pendingSession) startFocus(historyTask)
          else return
          setTaskHistoryId(null)
        }}
        onLinkNote={id => {
          if (!dataRef.current.journal.some(entry => entry.id === id && entry.taskId === undefined)) return false
          return update(current => ({
            ...current,
            journal: current.journal.map(entry => entry.id === id ? { ...entry, taskId: historyTask.id } : entry),
          }))
        }}
        onWriteReflection={showJournal ? () => {
          setTaskHistoryId(null)
          setJournalTaskId(historyTask.id)
          navigate('journal')
        } : undefined}
      />}
      <UnifiedSearch language={language} open={searchOpen} tasks={data.tasks} tasksOnly={!showJournal} entries={showJournal ? data.journal : []}
        onClose={() => setSearchOpen(false)} onSelectTask={openTaskHistory} onSelectEntry={openSearchEntry} />
      <nav className="mobile-nav" aria-label="Main navigation">{renderNavigation(21, true)}</nav>
      {undoNotice}
    </div>
  )
}

function NavButton({ icon, label, selected, onClick }: { icon: React.ReactNode; label: string; selected: boolean; onClick: () => void }) {
  const button = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (selected && button.current?.closest('.mobile-nav')) {
      button.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  })

  return <button ref={button} className={`nav-button ${selected ? 'selected' : ''}`} onClick={onClick}
    aria-current={selected ? 'page' : undefined}>{icon}<span>{label}</span></button>
}
function Rating({ label, value, onChange, language }: { label: string; value: number; onChange: (value: number) => void; language: AppLanguage }) {
  const t = (text: string) => translate(language, text)
  return <fieldset className="rating-field"><legend>{t(label)}</legend><div className="rating-buttons">{[1, 2, 3, 4, 5].map(number => <button type="button" className={value === number ? 'selected' : ''} key={number} onClick={() => onChange(number)} aria-label={language === 'ru' ? `${t(label)}: ${number} из 5` : `${label}: ${number} out of 5`} aria-pressed={value === number}>{number}</button>)}</div><div className="rating-ends"><span>{t('Not much')}</span><span>{t('Very much')}</span></div></fieldset>
}

export default App
