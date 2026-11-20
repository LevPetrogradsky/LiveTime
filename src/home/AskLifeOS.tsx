import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, KeyRound, MessageCircle, Settings2, Sparkles } from 'lucide-react'
import { answerLiveOS, starterQuestions, type GuideAnswer, type GuideTopic } from './lifeosGuide'
import type { AppLanguage } from '../language'
import './ask-lifeos.css'

type Provider = 'claude' | 'openai' | 'grok'
type VerifyResult = 'connected' | 'invalid_key' | 'permission_denied' | 'model_unavailable' | 'quota_exhausted' | 'rate_limited' | 'temporary_failure' | 'api_unavailable' | 'empty_answer' | 'invalid_request'
type Exchange = { question: string; answer: GuideAnswer; cloud?: Provider }
type Actions = Partial<Record<GuideTopic, () => void>>
const providerNames: Record<Provider, string> = { claude: 'Claude', openai: 'GPT', grok: 'Grok' }
const actionLabels: Record<GuideTopic, string> = {
  tasks: 'Open Tasks', journal: 'Open Journal', focus: 'Start Focus', reflect: 'Answer 3 questions', settings: 'Open Settings',
}
const russianActionLabels: Record<GuideTopic, string> = {
  tasks: 'Открыть задачи', journal: 'Открыть журнал', focus: 'Начать фокус', reflect: 'Ответить на 3 вопроса', settings: 'Открыть настройки',
}
const russianStarters = ['Как сохранить заметку в папке?', 'Как начать фокус-сессию?', 'Как настроить нижнюю панель?', 'Как планировать задачи?']
const resultLabels: Record<VerifyResult, { en: string; ru: string }> = {
  connected: { en: 'Key accepted. Answer generation has not been tested.', ru: 'Ключ принят. Генерация ответа ещё не проверена.' },
  invalid_key: { en: 'Invalid API key. Check it and try again.', ru: 'Неверный API-ключ. Проверьте его и повторите.' },
  permission_denied: { en: 'This key cannot use the API from this project or location.', ru: 'У этого ключа нет доступа к API из данного проекта или региона.' },
  model_unavailable: { en: 'The selected model is unavailable to this key.', ru: 'Выбранная модель недоступна этому ключу.' },
  quota_exhausted: { en: 'API credits or spending limit exhausted. Check provider billing.', ru: 'Закончились средства API или достигнут лимит расходов. Проверьте оплату у провайдера.' },
  rate_limited: { en: 'Too many API requests. Try again later.', ru: 'Слишком много запросов к API. Повторите позже.' },
  temporary_failure: { en: 'Temporary connection problem. Try again later.', ru: 'Временный сбой подключения. Попробуйте позже.' },
  api_unavailable: { en: 'This API is unavailable right now.', ru: 'Этот API сейчас недоступен.' },
  empty_answer: { en: 'The provider returned no text. Try again later.', ru: 'Провайдер не вернул текст ответа. Повторите позже.' },
  invalid_request: { en: 'Could not check this connection.', ru: 'Не удалось проверить подключение.' },
}

export default function AskLiveOS({ actions, language = 'en' }: { actions: Actions; language?: AppLanguage }) {
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [provider, setProvider] = useState<Provider>('claude')
  const [keys, setKeys] = useState<Record<Provider, string>>({ claude: '', openai: '', grok: '' })
  const [connected, setConnected] = useState<Provider | null>(null)
  const [cloudEnabled, setCloudEnabled] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState('')
  const messages = useRef<HTMLDivElement>(null)
  const prompts = exchanges.at(-1)?.answer.followUps ?? (language === 'ru' ? russianStarters : starterQuestions)

  useEffect(() => {
    if (messages.current) messages.current.scrollTop = messages.current.scrollHeight
  }, [exchanges])

  const changeProvider = (next: Provider) => {
    setProvider(next)
    setConnected(null)
    setCloudEnabled(false)
    setVerifyResult(null)
    setNotice('')
  }

  const changeKey = (value: string) => {
    setKeys(current => ({ ...current, [provider]: value }))
    setConnected(null)
    setCloudEnabled(false)
    setVerifyResult(null)
  }

  const verify = async () => {
    const apiKey = keys[provider].trim()
    if (!apiKey || checking) return
    setChecking(true)
    setVerifyResult(null)
    setConnected(null)
    setCloudEnabled(false)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', provider, apiKey }),
      })
      const value = await response.json() as { result?: VerifyResult }
      const result = value.result && resultLabels[value.result] ? value.result : 'api_unavailable'
      setVerifyResult(result)
      if (result === 'connected') setConnected(provider)
    } catch { setVerifyResult('temporary_failure') }
    finally { setChecking(false) }
  }

  async function ask(value: string) {
    const trimmed = value.trim()
    if (!trimmed || asking) return
    setQuestion('')
    setNotice('')
    const localAnswer = () => answerLiveOS(trimmed, exchanges.at(-1)?.answer.context)
    if (!cloudEnabled || connected !== provider || !keys[provider].trim()) {
      setExchanges(current => [...current.slice(-4), { question: trimmed, answer: localAnswer() }])
      return
    }
    setAsking(true)
    try {
      const context = exchanges.slice(-4).flatMap(exchange => [
        { role: 'user', content: exchange.question.slice(0, 500) },
        { role: 'assistant', content: exchange.answer.text.slice(0, 500) },
      ])
      const response = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer', provider, apiKey: keys[provider].trim(), messages: [...context, { role: 'user', content: trimmed }] }),
      })
      const result = await response.json() as { result?: VerifyResult | 'answered'; answer?: string }
      if (!response.ok || result.result !== 'answered' || !result.answer?.trim()) {
        const reason = result.result && resultLabels[result.result as VerifyResult] ? result.result as VerifyResult : 'api_unavailable'
        setNotice(`${resultLabels[reason][language]} ${language === 'ru' ? 'Показана локальная подсказка.' : 'Showing local help instead.'}`)
        setExchanges(current => [...current.slice(-4), { question: trimmed, answer: localAnswer() }])
        return
      }
      setExchanges(current => [...current.slice(-4), {
        question: trimmed, cloud: provider,
        answer: { text: result.answer!.trim(), followUps: language === 'ru' ? russianStarters : starterQuestions, context: { topic: 'navigation', step: 'cloud' } },
      }])
    } catch {
      setNotice(language === 'ru' ? 'Облачный ответ недоступен. Показана локальная подсказка.' : 'Cloud answer unavailable. Showing local help instead.')
      setExchanges(current => [...current.slice(-4), { question: trimmed, answer: localAnswer() }])
    } finally { setAsking(false) }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(question)
    event.currentTarget.querySelector('input')?.blur()
  }

  return <section className="life-main-guide" aria-labelledby="life-main-guide-title">
    <div className="life-main-guide-heading">
      <span className="life-main-guide-icon"><MessageCircle size={20} aria-hidden="true" /></span>
      <div>
        <h2 id="life-main-guide-title">{language === 'ru' ? 'Гид' : 'Guide'}</h2>
        <p>{language === 'ru' ? 'Подсказки по приложению, когда они нужны.' : 'A little help finding your way around.'}</p>
      </div>
      <button type="button" className="life-main-ai-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(open => !open)}>
        <Settings2 size={16} aria-hidden="true" /> {language === 'ru' ? 'Настройки ИИ' : 'AI settings'}
      </button>
    </div>

    {settingsOpen && <div className="life-main-ai-settings" aria-label={language === 'ru' ? 'Настройки гида' : 'Guide settings'}>
      <div className="life-main-ai-settings-title"><Sparkles size={18} aria-hidden="true" /><strong>{language === 'ru' ? 'Облачные ответы' : 'Cloud answers'}</strong></div>
      <p>{language === 'ru' ? 'Локальные подсказки работают без ключа. Выберите провайдера и подключите его только по желанию.' : 'Local tips work without a key. Connect a provider only if you want cloud answers.'}</p>
      <fieldset className="life-main-ai-providers" disabled={checking || asking}>
        <legend>{language === 'ru' ? 'Провайдер' : 'Provider'}</legend>
        {(['claude', 'openai', 'grok'] as const).map(value => <label key={value} className={provider === value ? 'selected' : ''}>
          <input type="radio" name="ask-lifeos-provider" value={value} checked={provider === value} onChange={() => changeProvider(value)} /> {providerNames[value]}
        </label>)}
      </fieldset>
      <label className="life-main-ai-key"><span><KeyRound size={16} aria-hidden="true" /> {language === 'ru' ? 'Свой API-ключ' : 'Your API key'}</span>
        <input type="password" autoComplete="off" spellCheck={false} value={keys[provider]} disabled={checking || asking}
          onChange={event => changeKey(event.target.value)} placeholder={language === 'ru' ? 'Введите ключ' : 'Enter key'} />
      </label>
      <button type="button" className="life-main-ai-verify" disabled={!keys[provider].trim() || checking || asking} onClick={() => void verify()}>
        {checking ? (language === 'ru' ? 'Проверка…' : 'Checking…') : (language === 'ru' ? 'Проверить подключение' : 'Check connection')}
      </button>
      {verifyResult && <p className={`life-main-ai-result ${verifyResult}`} role="status">{resultLabels[verifyResult][language]}</p>}
      {connected === provider && <label className="life-main-ai-enable">
        <input type="checkbox" role="switch" checked={cloudEnabled} onChange={event => setCloudEnabled(event.target.checked)} />
        <span>{language === 'ru' ? `Использовать ответы ${providerNames[provider]} (провайдер может взимать плату)` : `Use ${providerNames[provider]} answers (provider charges may apply)`}</span>
      </label>}
      <p className="life-main-ai-privacy">{language === 'ru' ? 'Ключ хранится только в памяти этого экрана и исчезает после выхода или перезагрузки. Проверка ключа не отправляет текст диалога. При облачном ответе передаются только вопрос и текущий диалог; Journal и другие данные приложения не читаются.' : 'The key stays only in this screen’s memory and disappears when you leave or reload. Key checks send no conversation. Cloud answers send only your question and this conversation; Journal and other app data are never read.'}</p>
    </div>}

    {cloudEnabled && <p className="life-main-ai-active" role="status"><Sparkles size={15} aria-hidden="true" /> {language === 'ru' ? `Ответы ${providerNames[provider]} включены` : `${providerNames[provider]} answers enabled`}</p>}
    {notice && <p className="life-main-ai-result temporary_failure" role="status">{notice}</p>}
    {exchanges.length > 0 && <div className="life-main-guide-conversation">
      <div ref={messages} className="life-main-guide-messages" role="log" aria-label="LifePortable help answers" aria-live="polite">
        {exchanges.map((exchange, index) => <div className="life-main-guide-exchange" key={index}>
          <p className="life-main-guide-question">{exchange.question}</p>
          <div className="life-main-guide-reply">
            {exchange.cloud && <span className="life-main-guide-source">{providerNames[exchange.cloud]}</span>}
            <p className="life-main-guide-answer">{exchange.answer.text}</p>
            {exchange.answer.steps && exchange.answer.steps.length > 0 && <ol>
              {exchange.answer.steps.map(step => <li key={step}>{step}</li>)}
            </ol>}
          </div>
          {exchange.answer.topic && actions[exchange.answer.topic] && <button type="button" className="life-main-guide-link"
            onClick={actions[exchange.answer.topic]}>{language === 'ru' ? russianActionLabels[exchange.answer.topic] : actionLabels[exchange.answer.topic]} <ArrowRight size={15} aria-hidden="true" /></button>}
        </div>)}
      </div>
    </div>}
    <div className="life-main-guide-prompts" aria-label="Suggested questions">
      <p>{exchanges.length ? (language === 'ru' ? 'Можно также спросить:' : 'You could also ask:') : (language === 'ru' ? 'Попробуйте спросить:' : 'Try one of these:')}</p>
      <div>{prompts.map(prompt => <button type="button" key={prompt} disabled={asking} onClick={() => void ask(prompt)}>{prompt}<ArrowRight size={15} aria-hidden="true" /></button>)}</div>
    </div>
    <form className="life-main-guide-form" onSubmit={submit}>
      <label className="journal-sr-only" htmlFor="life-main-guide-question">{language === 'ru' ? 'Вопрос о LifePortable' : 'Ask about LifePortable'}</label>
      <input id="life-main-guide-question" value={question} maxLength={160} placeholder={language === 'ru' ? 'Спросите о LifePortable…' : 'Ask about LifePortable…'}
        onChange={event => setQuestion(event.target.value)} />
      <button type="submit" aria-label={language === 'ru' ? 'Спросить LifePortable' : 'Ask LifePortable'} disabled={!question.trim() || asking}><ArrowRight size={18} aria-hidden="true" /></button>
    </form>
    <p className="life-main-guide-disclaimer">{asking ? (language === 'ru' ? 'Ожидаем ответ…' : 'Waiting for an answer…') : cloudEnabled ? (language === 'ru' ? 'Подключённый провайдер · только этот диалог' : 'Connected provider · this conversation only') : (language === 'ru' ? 'Локальные подсказки · без аккаунта' : 'Local guide · no account needed')}</p>
  </section>
}
