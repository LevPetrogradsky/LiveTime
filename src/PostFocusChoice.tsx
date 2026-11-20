import { ArrowRight, Leaf, MessageCircle, Sparkles } from 'lucide-react'
import { translate, type AppLanguage } from './language'
import './post-focus-choice.css'

interface PostFocusChoiceProps {
  language?: AppLanguage
  taskTitle: string
  storageError: boolean
  preferred?: 'reflection' | 'check-in'
  onChoose: (action: 'reflection' | 'check-in') => void
  onSkip: () => void
}

export default function PostFocusChoice({ taskTitle, storageError, preferred, onChoose, onSkip, language = 'en' }: PostFocusChoiceProps) {
  const t = (text: string) => translate(language, text)
  return <main className="checkin-screen page-container post-focus-choice">
    {storageError && <p className="storage-error" role="alert">{t('Your choice could not be saved. Please try again.')}</p>}
    <div className="focus-top"><div className="brand-mark"><Leaf size={18} strokeWidth={2.3} /></div><span>{t('LifePortable / Focus complete')}</span></div>
    <section className="post-focus-choice__card" aria-labelledby="post-focus-choice-title">
      <div className="section-icon"><Sparkles size={20} aria-hidden="true" /></div>
      <p className="eyebrow">{t('FOCUS COMPLETE')}</p>
      <h1 id="post-focus-choice-title">{t('Focus session saved')}</h1>
      <p className="muted">{language === 'ru' ? `Сессия «${taskTitle}» сохранена в истории фокуса. Выберите, как её завершить.` : `Your session with “${taskTitle}” is in Focus history. Choose how to close this session.`}</p>
      <div className="post-focus-choice__options">
        <button type="button" className={`post-focus-choice__option${preferred !== 'check-in' ? ' recommended' : ''}`} onClick={() => onChoose('reflection')}>
          <span className="post-focus-choice__icon"><MessageCircle size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>{t('Write a reflection')} {preferred === 'reflection' && <span className="post-focus-choice__badge">{t('Preferred')}</span>}</strong>
            <span>{t('Answer three questions about what helped.')}</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className={`post-focus-choice__option${preferred === 'check-in' ? ' recommended' : ''}`} onClick={() => onChoose('check-in')}>
          <span className="post-focus-choice__icon"><Sparkles size={22} aria-hidden="true" /></span>
          <span className="post-focus-choice__copy">
            <strong>{t('Quick check-in')} {preferred === 'check-in' && <span className="post-focus-choice__badge">{t('Preferred')}</span>}</strong>
            <span>{t('Rate interest, desire to continue, and progress.')}</span>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <button type="button" className="post-focus-choice__skip" onClick={onSkip}>{language === 'ru' ? 'Пропустить' : 'Skip'}</button>
      </div>
    </section>
  </main>
}
