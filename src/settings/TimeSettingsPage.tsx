import type { ReactNode } from 'react'
import { ChevronRight, HardDrive, Monitor, Moon, Palette, Sun, Timer, UserRound } from 'lucide-react'
import { breakReminderMinutes, type BreakReminderMinutes, type PostFocusAction, type Theme } from '../data'
import { translate, type AppLanguage } from '../language'
import './settings.css'

interface TimeSettingsPageProps {
  timeCloud?: ReactNode
  account?: ReactNode
  language: AppLanguage
  onLanguageChange: (language: AppLanguage) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  timeFormat: '12' | '24'
  onTimeFormatChange: (format: '12' | '24') => void
  timerDefaultView: 'full' | 'compact'
  onTimerDefaultViewChange: (view: 'full' | 'compact') => void
  reminderMinutes: BreakReminderMinutes
  onReminderMinutesChange: (minutes: BreakReminderMinutes) => void
  focusCheckin?: { enabled: boolean; onChange: (enabled: boolean) => void }
  postFocusAction?: { value?: PostFocusAction; onChange: (action: PostFocusAction) => void }
  onOpenPresets?: () => void
}

const themes = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <details className="settings-page__group">
    <summary className="settings-page__row">
      <span className="settings-page__icon" aria-hidden="true">{icon}</span>
      <span className="settings-page__label">{title}</span>
      <ChevronRight className="settings-page__chevron" size={18} aria-hidden="true" />
    </summary>
    <div className="settings-page__panel">{children}</div>
  </details>
}

export default function TimeSettingsPage({
  timeCloud, account, language, onLanguageChange, theme, onThemeChange, timeFormat, onTimeFormatChange,
  timerDefaultView, onTimerDefaultViewChange, reminderMinutes, onReminderMinutesChange,
  focusCheckin, postFocusAction, onOpenPresets,
}: TimeSettingsPageProps) {
  const t = (text: string) => translate(language, text)

  return <main className="settings-page" aria-labelledby="settings-page-title">
    <div className="settings-page__header"><h1 id="settings-page-title">{t('Settings')}</h1></div>
    <div className="settings-page__groups">
      <Group title={language === 'ru' ? 'Таймер' : 'Timer'} icon={<Timer size={18} />}>
        <fieldset className="settings-page__themes">
          <legend>{language === 'ru' ? 'Вид таймера по умолчанию' : 'Default timer view'}</legend>
          <div className="settings-page__theme-options">
            {(['full', 'compact'] as const).map(value => <label className="settings-page__theme" key={value}>
              <input type="radio" name="lifeos-timer-view" checked={timerDefaultView === value}
                onChange={() => onTimerDefaultViewChange(value)} />
              <span>{value === 'compact' ? language === 'ru' ? 'Компактный' : 'Compact' : language === 'ru' ? 'На весь экран' : 'Full screen'}</span>
            </label>)}
          </div>
        </fieldset>
        {onOpenPresets && <button type="button" className="settings-page__action" onClick={onOpenPresets}>
          {t('Presets')} <ChevronRight size={17} aria-hidden="true" />
        </button>}
        {postFocusAction && <fieldset className="settings-page__post-focus">
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
        {focusCheckin && !postFocusAction?.value && <label className="settings-page__toggle">
          <span className="settings-page__toggle-copy"><strong>{t('Offer a quick rating')}</strong></span>
          <input type="checkbox" role="switch" aria-label={t('Offer a quick rating')} checked={focusCheckin.enabled}
            onChange={event => focusCheckin.onChange(event.currentTarget.checked)} />
        </label>}
        <label className="settings-page__field">
          <strong>{t('Break reminder')}</strong>
          <select value={reminderMinutes} onChange={event => {
            const selected = breakReminderMinutes.find(minutes => String(minutes) === event.currentTarget.value)
            if (selected !== undefined) onReminderMinutesChange(selected)
          }}>
            {breakReminderMinutes.map(minutes => <option key={minutes} value={minutes}>
              {minutes ? `${minutes} ${language === 'ru' ? 'мин' : 'min'}` : t('Off')}
            </option>)}
          </select>
        </label>
      </Group>

      <Group title={language === 'ru' ? 'Оформление' : 'Appearance'} icon={<Palette size={18} />}>
        <fieldset className="settings-page__themes">
          <legend>{t('Theme')}</legend>
          <div className="settings-page__theme-options">
            {themes.map(({ value, label, Icon }) => <label className="settings-page__theme" key={value}>
              <input type="radio" name="lifeos-theme" checked={theme === value} onChange={() => onThemeChange(value)} />
              <span><Icon size={17} aria-hidden="true" />{t(label)}</span>
            </label>)}
          </div>
        </fieldset>
        <fieldset className="settings-page__themes">
          <legend>{language === 'ru' ? 'Формат времени' : 'Time format'}</legend>
          <div className="settings-page__theme-options">
            {(['12', '24'] as const).map(value => <label className="settings-page__theme" key={value}>
              <input type="radio" name="lifeos-time-format" checked={timeFormat === value} onChange={() => onTimeFormatChange(value)} />
              <span>{value === '12' ? language === 'ru' ? '12 часов' : '12-hour' : language === 'ru' ? '24 часа' : '24-hour'}</span>
            </label>)}
          </div>
        </fieldset>
        <fieldset className="settings-page__themes">
          <legend>{t('Language / Язык')}</legend>
          <div className="settings-page__theme-options">
            {(['en', 'ru'] as const).map(value => <label className="settings-page__theme" key={value}>
              <input type="radio" name="lifeos-language" checked={language === value} onChange={() => onLanguageChange(value)} />
              <span>{value === 'en' ? 'English' : 'Русский'}</span>
            </label>)}
          </div>
        </fieldset>
      </Group>

      {account && <Group title={t('Account')} icon={<UserRound size={18} />}>{account}</Group>}

      {timeCloud && <Group title="LifeTime Storage" icon={<HardDrive size={18} />}>{timeCloud}</Group>}
    </div>
  </main>
}
