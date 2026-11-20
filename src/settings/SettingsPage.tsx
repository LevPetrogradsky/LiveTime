import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { ChevronRight, Compass, Copy, Download, ExternalLink, Github, HardDrive, Info, Monitor, Moon, Palette, Search, Sun, Timer, Upload, UserRound, X } from 'lucide-react'
import { breakReminderMinutes, maxDisplayNameLength, visibleShortcuts, type BreakReminderMinutes, type PostFocusAction, type Shortcut, type ShortcutLocation, type Theme } from '../data'
import { translate, type AppLanguage } from '../language'
import InteractiveTip from '../InteractiveTip'
import JournalCloudPanel, { type JournalCloudControls } from './JournalCloudPanel'
import TimeSettingsPage from './TimeSettingsPage'
import { serviceMode } from '../service-mode'
import './settings.css'

const shortcutNames = { tasks: 'LifeTasks', journal: 'LifeJournal', focus: 'LifeTime', flow: '3 questions' }

interface SettingsPageProps {
  account?: ReactNode
  journalSync: JournalCloudControls
  theme: Theme
  language: 'en' | 'ru'
  timeFormat: '12' | '24'
  onTimeFormatChange: (format: '12' | '24') => void
  onLanguageChange: (language: 'en' | 'ru') => void
  onThemeChange: (theme: Theme) => void
  interactiveTips: boolean
  onInteractiveTipsChange: (enabled: boolean) => void
  showHome: boolean
  onHomeVisibilityChange: (visible: boolean) => void
  showAskLiveOS: boolean
  onAskLiveOSVisibilityChange: (visible: boolean) => void
  shortcutVisible: (id: Shortcut, location: ShortcutLocation) => boolean
  onShortcutChange: (id: Shortcut, location: ShortcutLocation, visible: boolean) => void
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  repoUrl: string
  reminderMinutes: BreakReminderMinutes
  onReminderMinutesChange: (minutes: BreakReminderMinutes) => void
  displayName: string
  onDisplayNameChange: (name: string) => boolean
  focusCheckin?: { enabled: boolean; onChange: (enabled: boolean) => void }
  postFocusAction?: { value?: PostFocusAction; onChange: (action: PostFocusAction) => void }
  onOpenPresets?: () => void
  timerDefaultView: 'full' | 'compact'
  onTimerDefaultViewChange: (view: 'full' | 'compact') => void
}

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

type SettingsSection = 'account' | 'profile' | 'focus' | 'focusOptions' | 'backups' | 'more' | 'navigation' | 'about' | 'advanced'

function SettingsGroup({ id, title, icon, summary, open, onOpenChange, children }: {
  id?: string
  title: string
  icon: ReactNode
  summary?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details id={id} className="settings-page__group" open={open}>
      <summary className="settings-page__row" onClick={event => { event.preventDefault(); onOpenChange(!open) }}>
        <span className="settings-page__icon" aria-hidden="true">{icon}</span>
        <span className="settings-page__label">{title}</span>
        {summary && <span className="settings-page__value">{summary}</span>}
        <ChevronRight className="settings-page__chevron" size={18} aria-hidden="true" />
      </summary>
      <div className="settings-page__panel">{children}</div>
    </details>
  )
}

function DisplayNameForm({ name, onSave, language }: { name: string; onSave: (name: string) => boolean; language: AppLanguage }) {
  const [draft, setDraft] = useState(name)
  const t = (text: string) => translate(language, text)
  return (
    <form className="settings-page__name-form" onSubmit={event => {
      event.preventDefault()
      const value = draft.trim()
      if (onSave(value)) setDraft(value)
    }}>
      <label className="settings-page__field">
        <strong>{t('Display name')}</strong>
        <input type="text" value={draft} maxLength={maxDisplayNameLength} autoComplete="nickname"
          placeholder={t('Optional')} onChange={event => setDraft(event.currentTarget.value)} />
      </label>
      <button type="submit" className="settings-page__action" disabled={draft.trim() === name}>{t('Save name')}</button>
    </form>
  )
}

const demoUrl = 'https://lifeos-demo-kappa.vercel.app/'

function AboutLiveOS({ repoUrl, language }: { repoUrl: string; language: AppLanguage }) {
  const [message, setMessage] = useState('')
  const t = (text: string) => translate(language, text)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(demoUrl)
      setMessage('Demo link copied.')
    } catch {
      setMessage('Select the demo link to copy it.')
    }
  }

  return (
    <>
      <label className="settings-page__field">
        <strong>{t('Demo link')}</strong>
        <input type="url" readOnly value={demoUrl} onFocus={event => event.currentTarget.select()} />
      </label>
      <div className="settings-page__actions">
        <button type="button" className="settings-page__action" onClick={copyLink}>
          <Copy size={17} aria-hidden="true" /> {t('Copy demo link')}
        </button>
        <a id="settings-target-github-link" className="settings-page__action" href={repoUrl} target="_blank" rel="noreferrer">
          <Github size={17} aria-hidden="true" /> {t('View on GitHub')}
          <ExternalLink className="settings-page__external" size={15} aria-hidden="true" />
        </a>
      </div>
      <p className="settings-page__description">
        © 2026 LevPetrogradsky. {language === 'ru' ? 'Для личного и иного некоммерческого использования.' : 'For personal and other noncommercial use.'}{' '}
        <a href={`${repoUrl}/blob/main/LICENSE.md`} target="_blank" rel="noopener noreferrer">
          {language === 'ru' ? 'Условия лицензии' : 'License terms'}
        </a>
      </p>
      {message && <p role="status" className="settings-page__description">{t(message)}</p>}
    </>
  )
}

export default function SettingsPage({
  account,
  journalSync,
  theme, onThemeChange, language, onLanguageChange, timeFormat, onTimeFormatChange, interactiveTips, onInteractiveTipsChange, showHome, onHomeVisibilityChange, showAskLiveOS, onAskLiveOSVisibilityChange, shortcutVisible, onShortcutChange, onExport, onImport, repoUrl, focusCheckin, postFocusAction, onOpenPresets,
  reminderMinutes, onReminderMinutesChange, displayName, onDisplayNameChange, timerDefaultView, onTimerDefaultViewChange,
}: SettingsPageProps) {
  if (serviceMode === 'time') return <TimeSettingsPage
    account={account} language={language} onLanguageChange={onLanguageChange}
    theme={theme} onThemeChange={onThemeChange} timeFormat={timeFormat} onTimeFormatChange={onTimeFormatChange}
    timerDefaultView={timerDefaultView} onTimerDefaultViewChange={onTimerDefaultViewChange}
    reminderMinutes={reminderMinutes} onReminderMinutesChange={onReminderMinutesChange}
    focusCheckin={focusCheckin} postFocusAction={postFocusAction} onOpenPresets={onOpenPresets}
    onExport={onExport} onImport={onImport}
  />
  const t = (text: string) => translate(language, text)
  const [openSections, setOpenSections] = useState<Record<SettingsSection, boolean>>({
    account: false, profile: false, focus: false, focusOptions: false,
    backups: false, more: false, navigation: false, about: false, advanced: false,
  })
  const sectionIds: SettingsSection[] = [
    'account', 'profile', 'focus',
    ...(focusCheckin && !postFocusAction?.value ? ['focusOptions' as const] : []),
    'more', 'backups', 'navigation', 'about', 'advanced',
  ]
  const allOpen = sectionIds.every(id => openSections[id])
  const setSection = (id: SettingsSection, open: boolean) =>
    setOpenSections(current => current[id] === open ? current : { ...current, [id]: open })
  const toggleAll = () => setOpenSections(current => ({ ...current,
    ...Object.fromEntries(sectionIds.map(id => [id, !allOpen])),
  }))
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scrollTarget, setScrollTarget] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const jumpTo = (section: SettingsSection, target: string = section) => {
    setOpenSections(current => ({ ...current, [section]: true,
      ...(section === 'backups' || section === 'navigation' || section === 'about' ? { more: true } : {}),
      ...(section === 'focusOptions' ? { focus: true } : {}),
    }))
    setSearchOpen(false)
    setSearchQuery('')
    setScrollTarget(target)
  }
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus()
  }, [searchOpen])
  useEffect(() => {
    if (!scrollTarget) return
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`settings-target-${scrollTarget}`)
      element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      const focusable = element?.matches('input, select, button, summary, a') ? element : element?.querySelector('summary, input, select, button, a')
      if (focusable instanceof HTMLElement) focusable.focus({ preventScroll: true })
      setScrollTarget('')
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollTarget, openSections])
  const searchItems: { title: string; section: SettingsSection; target: string; keywords?: string }[] = [
    { title: t('Account'), section: 'account', target: 'account', keywords: 'sign in register email password аккаунт вход пароль' },
    { title: language === 'ru' ? 'Сохранение Journal' : 'Journal storage', section: 'account', target: 'journal-storage', keywords: 'sync backup журнал синхронизация' },
    { title: t('Profile & appearance'), section: 'profile', target: 'profile', keywords: 'profile appearance профиль оформление' },
    { title: t('Theme'), section: 'profile', target: 'theme', keywords: 'light dark system светлая темная системная' },
    { title: language === 'ru' ? 'Формат времени' : 'Time format', section: 'profile', target: 'time-format', keywords: '12 24 часы clock' },
    { title: t('Language / Язык'), section: 'profile', target: 'language', keywords: 'english русский перевод' },
    { title: t('Display name'), section: 'profile', target: 'display-name', keywords: 'name имя' },
    { title: t('Focus'), section: 'focus', target: 'focus', keywords: 'фокус timer таймер' },
    { title: language === 'ru' ? 'Вид таймера по умолчанию' : 'Default timer view', section: 'focus', target: 'timer-view', keywords: 'compact full screen компактный экран' },
    { title: t('Interactive tips'), section: 'focus', target: 'interactive-tips', keywords: 'hints подсказки' },
    ...(onOpenPresets ? [{ title: t('Presets'), section: 'focus' as const, target: 'presets', keywords: 'режимы фокуса work rest' }] : []),
    ...(postFocusAction ? [{ title: t('After focus'), section: 'focus' as const, target: 'after-focus', keywords: 'reflection rating рефлексия оценка' }] : []),
    ...(focusCheckin && !postFocusAction?.value ? [{ title: t('More focus options'), section: 'focusOptions' as const, target: 'focus-options', keywords: 'quick rating оценка' }] : []),
    { title: t('Break reminder'), section: 'focus', target: 'break-reminder', keywords: 'break pause перерыв напоминание' },
    { title: t('Backups'), section: 'backups', target: 'backups', keywords: 'export import restore копия восстановить' },
    { title: t('Save a copy'), section: 'backups', target: 'save-copy', keywords: 'export backup экспорт скачать' },
    { title: t('Restore from a copy'), section: 'backups', target: 'restore-copy', keywords: 'import backup импорт json' },
    { title: t('More options'), section: 'more', target: 'more', keywords: 'additional settings дополнительно' },
    { title: t('Hub & navigation'), section: 'navigation', target: 'navigation', keywords: 'shortcuts bar главная панель ярлыки' },
    { title: t('Hub in bottom bar'), section: 'navigation', target: 'home-bar', keywords: 'navigation навигация' },
    { title: t('Guide in bottom bar'), section: 'navigation', target: 'ask-bar', keywords: 'navigation навигация' },
    ...visibleShortcuts.map(({ id }) => ({ title: shortcutNames[id], section: 'navigation' as const, target: `shortcut-${id}`, keywords: 'shortcut home bar ярлык главная панель' })),
    { title: t('About'), section: 'about', target: 'about', keywords: 'version приложение версия' },
    { title: t('Demo link'), section: 'about', target: 'demo-link', keywords: 'share ссылка поделиться' },
    { title: t('View on GitHub'), section: 'about', target: 'github-link', keywords: 'source code исходный код' },
    { title: t('Advanced Options'), section: 'advanced', target: 'advanced', keywords: 'fork github расширенные' },
    { title: t('Fork on GitHub'), section: 'advanced', target: 'fork-link', keywords: 'source code исходный код' },
  ]
  const sectionTitle = (section: SettingsSection) => t({
    account: 'Account', profile: 'Profile & appearance', focus: 'Focus', focusOptions: 'Focus',
    more: 'More options', backups: 'Backups', navigation: 'Hub & navigation', about: 'About', advanced: 'Advanced Options',
  }[section])
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const results = normalizedQuery ? searchItems.filter(item =>
    `${item.title} ${sectionTitle(item.section)} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)) : []
  return (
    <main className="settings-page" aria-labelledby="settings-page-title">
      <div className="settings-page__header">
        <h1 id="settings-page-title">{t('Settings')}</h1>
        <div className="settings-page__header-actions">
          <button type="button" className="settings-page__search-toggle" aria-label={language === 'ru' ? 'Поиск по настройкам' : 'Search settings'}
            aria-expanded={searchOpen} aria-controls="settings-search" onClick={() => { setSearchOpen(value => !value); setSearchQuery('') }}>
            {searchOpen ? <X size={19} aria-hidden="true" /> : <Search size={19} aria-hidden="true" />}
          </button>
        <div className="settings-page__toggle-all-wrap">
          <button type="button" className="settings-page__toggle-all" onClick={toggleAll}>
            {t(allOpen ? 'Collapse All' : 'Expand All')}
          </button>
          {interactiveTips && <InteractiveTip className="settings-page__toggle-tip"
            label={t(allOpen ? 'Collapse all sections' : 'Expand all sections')} />}
        </div>
        </div>
      </div>

      <nav className="settings-page__quick-nav" aria-label={language === 'ru' ? 'Быстрый переход по настройкам' : 'Settings quick links'}>
        <button type="button" onClick={() => jumpTo('account')}><UserRound size={16} aria-hidden="true" />{t('Account')}</button>
        <button type="button" onClick={() => jumpTo('focus')}><Timer size={16} aria-hidden="true" />{t('Focus')}</button>
        <button type="button" onClick={() => jumpTo('more')}><Compass size={16} aria-hidden="true" />{t('More options')}</button>
      </nav>

      {searchOpen && <div id="settings-search" className="settings-page__search" role="search" onKeyDown={event => {
        if (event.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
      }}>
        <label htmlFor="settings-search-input">{language === 'ru' ? 'Найти настройку' : 'Find a setting'}</label>
        <input ref={searchInput} id="settings-search-input" type="search" value={searchQuery}
          placeholder={language === 'ru' ? 'Например, тема или резервная копия' : 'Try theme or backup'}
          onChange={event => setSearchQuery(event.currentTarget.value)} />
        {normalizedQuery ? <div className="settings-page__search-results" aria-live="polite">
          {results.length ? results.map(item => <button type="button" key={`${item.section}-${item.target}-${item.title}`}
            onClick={() => jumpTo(item.section, item.target)}>
            <span>{item.title}</span>{sectionTitle(item.section) !== item.title && <small>{sectionTitle(item.section)}</small>}
          </button>) : <p>{language === 'ru' ? 'Ничего не найдено. Попробуйте другое слово.' : 'No settings found. Try another word.'}</p>}
        </div> : <p className="settings-page__search-hint">{language === 'ru' ? 'Поиск охватывает и свернутые разделы.' : 'Search includes collapsed sections.'}</p>}
      </div>}

      <div className="settings-page__groups">
        <SettingsGroup id="settings-target-account" title={t('Account')} icon={<UserRound size={18} />} open={openSections.account} onOpenChange={open => setSection('account', open)}>
          {account}
          <div id="settings-target-journal-storage"><JournalCloudPanel cloud={journalSync} language={language} onSaveCopy={onExport} /></div>
        </SettingsGroup>
        <SettingsGroup id="settings-target-profile" title={t('Profile & appearance')} icon={<Palette size={18} />} open={openSections.profile} onOpenChange={open => setSection('profile', open)}
          summary={t(themes.find(option => option.value === theme)?.label ?? '')}>
          <fieldset id="settings-target-theme" className="settings-page__themes">
            <legend>{t('Theme')}</legend>
            <div className="settings-page__theme-options">
              {themes.map(({ value, label, Icon }) => (
                <label className="settings-page__theme" key={value}>
                  <input type="radio" name="lifeos-theme" checked={theme === value}
                    onChange={() => onThemeChange(value)} />
                  <span><Icon size={17} aria-hidden="true" />{t(label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset id="settings-target-time-format" className="settings-page__themes">
            <legend>{language === 'ru' ? 'Формат времени' : 'Time format'}</legend>
            <div className="settings-page__theme-options">
              {(['12', '24'] as const).map(value => <label className="settings-page__theme" key={value}>
                <input type="radio" name="lifeos-time-format" checked={timeFormat === value} onChange={() => onTimeFormatChange(value)} />
                <span>{value === '12' ? (language === 'ru' ? '12 часов' : '12-hour') : (language === 'ru' ? '24 часа' : '24-hour')}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset id="settings-target-language" className="settings-page__themes">
            <legend>{t('Language / Язык')}</legend>
            <div className="settings-page__theme-options">
              {(['en', 'ru'] as const).map(value => <label className="settings-page__theme" key={value}>
                <input type="radio" name="lifeos-language" checked={language === value} onChange={() => onLanguageChange(value)} />
                <span>{value === 'en' ? 'English' : 'Русский'}</span>
              </label>)}
            </div>
          </fieldset>
          <div id="settings-target-display-name"><DisplayNameForm key={displayName} name={displayName} onSave={onDisplayNameChange} language={language} /></div>
        </SettingsGroup>

        <SettingsGroup id="settings-target-focus" title={t('Focus')} icon={<Timer size={18} />} open={openSections.focus} onOpenChange={open => setSection('focus', open)}>
          <fieldset id="settings-target-timer-view" className="settings-page__themes">
            <legend>{language === 'ru' ? 'Вид таймера по умолчанию' : 'Default timer view'}</legend>
            <div className="settings-page__theme-options">
              {(['full', 'compact'] as const).map(value => <label className="settings-page__theme" key={value}>
                <input type="radio" name="lifeos-timer-view" checked={timerDefaultView === value}
                  onChange={() => onTimerDefaultViewChange(value)} />
                <span>{value === 'compact' ? (language === 'ru' ? 'Компактный' : 'Compact') : (language === 'ru' ? 'На весь экран' : 'Full screen')}</span>
              </label>)}
            </div>
          </fieldset>
          <label id="settings-target-interactive-tips" className="settings-page__toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Interactive tips')}</strong><span>{t('Show hints for focus actions on Home and Tasks.')}</span></span>
            <input type="checkbox" role="switch" aria-label={t('Interactive tips')} checked={interactiveTips}
              onChange={event => onInteractiveTipsChange(event.currentTarget.checked)} />
          </label>
          {onOpenPresets && <button id="settings-target-presets" type="button" className="settings-page__action" onClick={onOpenPresets}>
            {t('Presets')} <ChevronRight size={17} aria-hidden="true" />
          </button>}
          {postFocusAction && <fieldset id="settings-target-after-focus" className="settings-page__post-focus">
            <legend>{t('After focus')}</legend>
            {([
              { value: 'reflection', title: 'Reflection', description: 'Think about what helped.' },
              { value: 'check-in', title: 'Quick rating', description: 'Rate how the session went.' },
            ] as const).map(option => <label key={option.value} className="settings-page__post-focus-option">
              <input type="radio" name="lifeos-post-focus" value={option.value}
                checked={postFocusAction.value === option.value}
                onChange={() => postFocusAction.onChange(option.value)} />
              <span><strong>{t(option.title)}</strong><small>{t(option.description)}</small></span>
            </label>)}
          </fieldset>}
          {focusCheckin && !postFocusAction?.value && <details id="settings-target-focus-options" className="settings-page__submore" open={openSections.focusOptions}>
            <summary onClick={event => { event.preventDefault(); setSection('focusOptions', !openSections.focusOptions) }}>{t('More focus options')}</summary>
            <label className="settings-page__toggle">
              <span className="settings-page__toggle-copy"><strong>{t('Offer a quick rating')}</strong></span>
              <input type="checkbox" role="switch" aria-label={t('Offer a quick rating')} checked={focusCheckin.enabled}
                onChange={event => focusCheckin.onChange(event.currentTarget.checked)} />
            </label>
          </details>}
          <label id="settings-target-break-reminder" className="settings-page__field">
            <strong>{t('Break reminder')}</strong>
            <select value={reminderMinutes} onChange={event => {
              const selected = breakReminderMinutes.find(minutes => String(minutes) === event.currentTarget.value)
              if (selected !== undefined) onReminderMinutesChange(selected)
            }}>
              {breakReminderMinutes.map(minutes => (
                <option key={minutes} value={minutes}>{minutes ? `${minutes} ${language === 'ru' ? 'мин' : 'min'}` : t('Off')}</option>
              ))}
            </select>
          </label>
        </SettingsGroup>

        <details id="settings-target-more" className="settings-page__more" open={openSections.more}>
          <summary onClick={event => { event.preventDefault(); setSection('more', !openSections.more) }}>{t('More options')} <ChevronRight size={18} aria-hidden="true" /></summary>
          <div className="settings-page__more-content">
        <SettingsGroup id="settings-target-backups" title={t('Backups')} icon={<HardDrive size={18} />} open={openSections.backups} onOpenChange={open => setSection('backups', open)}>
          <div className="settings-page__actions">
            <button id="settings-target-save-copy" type="button" className="settings-page__action" onClick={onExport}>
              <Download size={17} aria-hidden="true" />{t('Save a copy')}
            </button>
            <label id="settings-target-restore-copy" className="settings-page__action settings-page__upload">
              <Upload size={17} aria-hidden="true" />{t('Restore from a copy')}
              <input type="file" accept="application/json,.json" onChange={onImport} />
            </label>
          </div>
        </SettingsGroup>
        <SettingsGroup id="settings-target-navigation" title={t('Hub & navigation')} icon={<Compass size={18} />} open={openSections.navigation} onOpenChange={open => setSection('navigation', open)}>
          <label id="settings-target-home-bar" className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Hub in bottom bar')}</strong></span>
            <input type="checkbox" role="switch" aria-label={t('Hub in navigation bar')} checked={showHome}
              onChange={event => onHomeVisibilityChange(event.currentTarget.checked)} />
          </label>
          <label id="settings-target-ask-bar" className="settings-page__toggle settings-page__navigation-toggle">
            <span className="settings-page__toggle-copy"><strong>{t('Guide in bottom bar')}</strong></span>
            <input type="checkbox" role="switch" aria-label={t('Guide in navigation bar')} checked={showAskLiveOS}
              onChange={event => onAskLiveOSVisibilityChange(event.currentTarget.checked)} />
          </label>
          {!showHome && <p className="settings-page__description">{t('Hub shortcuts appear when Hub is visible.')}</p>}
          {visibleShortcuts.map(({ id }) => <fieldset id={`settings-target-shortcut-${id}`} key={id} className="settings-page__shortcut">
            <legend>{shortcutNames[id]}</legend>
            {([['home', 'On Hub'], ['bar', 'In navigation bar']] as const).map(([location, text]) => <label
              className="settings-page__toggle settings-page__shortcut-option" key={location}>
              <span>{t(text)}</span>
              <input type="checkbox" role="switch" aria-label={`${shortcutNames[id]} ${t(text).toLowerCase()}`}
                checked={shortcutVisible(id, location)} onChange={event => onShortcutChange(id, location, event.currentTarget.checked)} />
            </label>)}
          </fieldset>)}
        </SettingsGroup>

        <SettingsGroup id="settings-target-about" title={t('About')} icon={<Info size={18} />} summary="v0.1" open={openSections.about} onOpenChange={open => setSection('about', open)}>
          <div id="settings-target-demo-link"><AboutLiveOS repoUrl={repoUrl} language={language} /></div>
        </SettingsGroup>
          </div>
        </details>
        <SettingsGroup id="settings-target-advanced" title={t('Advanced Options')} icon={<Github size={18} />} open={openSections.advanced} onOpenChange={open => setSection('advanced', open)}>
          <a id="settings-target-fork-link" className="settings-page__action" href={`${repoUrl}/fork`}
            target="_blank" rel="noopener noreferrer">
            <Github size={17} aria-hidden="true" />{t('Fork on GitHub')}
            <ExternalLink className="settings-page__external" size={16} aria-hidden="true" />
          </a>
        </SettingsGroup>
      </div>
    </main>
  )
}
