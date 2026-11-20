import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, BookText, BriefcaseBusiness, CalendarDays, Check, ChevronRight, Circle, ClipboardList, Code2, Dumbbell, Flag, Github, GripHorizontal, Heart, History, ListTodo, Maximize2, Pause, Pencil, Play, Plus, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react'
import { taskLists, type LiveOSData, type Task, type TaskList } from './data'
import { todayTaskLimit } from './task-rules'
import { translate } from './language'
import { JournalSheet } from './journal/JournalSheet'
import './main-dashboard.css'
import './home-tips.css'

interface MainDashboardProps {
  initialScreen?: 'home' | 'tasks'
  hideBack?: boolean
  onReturnHome?: () => void
  returnLabel: string
  showTasksShortcut: boolean
  showFocusShortcut: boolean
  searchIncludesJournal: boolean
  repoUrl: string
  tasks: Task[]
  focusTaskTitle?: string
  focusRunning?: boolean
  pausedActiveTime?: string
  showPausedTime?: boolean
  displayName?: string
  language?: 'en' | 'ru'
  onPauseFocus: () => void
  onContinueFocus: () => void
  onReturnToFocus: () => void
  onFinishPaused: () => void
  onCancelFocus: () => void
  onUpdate: (change: (current: LiveOSData) => LiveOSData) => boolean
  onOpenTask: (taskId: string) => void
  onDeleteTask: (id: string) => boolean
  onStart: (task: Task) => void
  onStartOpenFocus: () => void
  onJournal?: () => void
  onFocusHistory: () => void
  onSettings: () => void
  onSearch: () => void
}

const listLabels: Record<TaskList, string> = { today: 'Today', someday: 'Someday' }
const taskList = (task: Task): TaskList => task.list ?? 'today'

type TaskEditor = { id: string | null; title: string; list: TaskList }

function BreakCard({ taskTitle, activeTime, showTime, running, language, onPause, onContinue, onReturn, onFinish, onCancel }: {
  taskTitle: string
  activeTime: string
  showTime: boolean
  running: boolean
  language: 'en' | 'ru'
  onPause: () => void
  onContinue: () => void
  onReturn: () => void
  onFinish: () => void
  onCancel: () => void
}) {
  const t = (text: string) => translate(language, text)
  const [confirmCancel, setConfirmCancel] = useState(false)
  return <section className="life-main-today life-main-break" aria-labelledby="life-main-break-title">
    <div className="life-main-break-heading">
      <Pause size={20} aria-hidden="true" />
      <div>
        <h2 id="life-main-break-title">{running ? (language === 'ru' ? 'Фокус идёт' : 'Focus running') : t('On a break')}</h2>
        <p>{taskTitle}</p>
        <p className="life-main-break-time">
          <span>{running ? (language === 'ru' ? 'Активное время' : 'Active time') : (language === 'ru' ? 'Активное время до паузы' : 'Active time before break')}</span>
          <strong>{showTime ? activeTime : t('Time hidden')}</strong>
        </p>
      </div>
    </div>
    <div className="life-main-break-actions">
      <button type="button" className="life-main-break-primary" onClick={running ? onPause : onContinue}>
        {running ? <><Pause size={17} aria-hidden="true" /> {language === 'ru' ? 'Пауза' : 'Pause'}</> : <><Play size={17} aria-hidden="true" /> {language === 'ru' ? 'Продолжить' : 'Continue'}</>}
      </button>
      <button type="button" onClick={onReturn}><Maximize2 size={16} aria-hidden="true" /> {language === 'ru' ? 'К таймеру' : 'Return to timer'}</button>
      <button type="button" onClick={onFinish}><Flag size={16} aria-hidden="true" /> {language === 'ru' ? 'Завершить' : 'Finish'}</button>
      <button type="button" className="life-main-break-cancel" onClick={() => setConfirmCancel(true)}><X size={15} aria-hidden="true" /> {language === 'ru' ? 'Отменить' : 'Cancel'}</button>
    </div>
    {confirmCancel && <div className="life-main-break-confirm">
      <span>{language === 'ru' ? 'Отменить сессию без записи в истории?' : 'Cancel this session without saving it to history?'}</span>
      <button type="button" onClick={() => setConfirmCancel(false)}>{language === 'ru' ? 'Назад' : 'Keep session'}</button>
      <button type="button" onClick={onCancel}>{language === 'ru' ? 'Отменить сессию' : 'Cancel session'}</button>
    </div>}
  </section>
}

export default function MainDashboard({ initialScreen = 'home', hideBack = false, onReturnHome, returnLabel, showTasksShortcut, showFocusShortcut, searchIncludesJournal, repoUrl, tasks, focusTaskTitle, focusRunning = false, pausedActiveTime, showPausedTime = true, displayName, language = 'en', onPauseFocus, onContinueFocus, onReturnToFocus, onFinishPaused, onCancelFocus, onUpdate, onOpenTask, onDeleteTask, onStart, onStartOpenFocus, onJournal, onFocusHistory, onSettings, onSearch }: MainDashboardProps) {
  const t = (text: string) => translate(language, text)
  const [screen, setScreen] = useState(initialScreen)
  const [filter, setFilter] = useState<TaskList | 'completed'>('today')
  const [editor, setEditor] = useState<TaskEditor | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [orderStatus, setOrderStatus] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const editorDialog = useRef<HTMLDialogElement>(null)
  const previousScreen = useRef(screen)
  const editing = editor !== null

  useLayoutEffect(() => {
    const dialog = editorDialog.current
    if (!dialog) return
    if (editing && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('header button')?.focus({ preventScroll: true })
    } else if (!editing && dialog.open) {
      dialog.close()
    }
  }, [screen, editing])

  const now = new Date()
  const today = now.toDateString()
  const active = tasks.filter(task => task.completedAt === null)
  const activeToday = active.filter(task => taskList(task) === 'today')
  const completed = tasks.filter(task => task.completedAt !== null)
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))
  const doneToday = completed.filter(task => taskList(task) === 'today' && new Date(task.completedAt!).toDateString() === today)
  const nextTask = activeToday[0]
  const todayIsFull = activeToday.length >= todayTaskLimit
  const totalToday = activeToday.length + doneToday.length
  const editorTask = editor?.id ? tasks.find(task => task.id === editor.id) : undefined
  const cannotAddToToday = todayIsFull && !(editorTask && (editorTask.completedAt || taskList(editorTask) === 'today'))
  const visibleActive = filter === 'completed' ? [] : active.filter(task => taskList(task) === filter)

  useEffect(() => {
    if (previousScreen.current === screen) return
    previousScreen.current = screen
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (!editor) heading.current?.focus({ preventScroll: true })
  }, [screen, editor])

  const showList = (list: TaskList | 'completed') => {
    setFilter(list)
    setEditor(null)
    setDeleting(null)
    setOrderStatus('')
  }

  const addTo = (list: TaskList) => {
    if (list === 'today' && todayIsFull) return
    showList(list)
    setEditor({ id: null, title: '', list })
  }

  const openTasks = (add = false) => {
    showList('today')
    setScreen('tasks')
    if (add) addTo(todayIsFull ? 'someday' : 'today')
  }

  const saveTask = (event: FormEvent) => {
    event.preventDefault()
    if (!editor || !editor.title.trim() || (editor.list === 'today' && cannotAddToToday)) return
    const { id, list } = editor
    const title = editor.title.trim()
    const saved = onUpdate(current => {
      if (!id) {
        const task = { id: crypto.randomUUID(), title, list, createdAt: new Date().toISOString(), completedAt: null }
        return { ...current, tasks: [task, ...current.tasks] }
      }

      const original = current.tasks.find(task => task.id === id)
      if (!original) return current
      const updated = { ...original, title, list }
      const tasks = taskList(original) === list
        ? current.tasks.map(task => task.id === id ? updated : task)
        : [...current.tasks.filter(task => task.id !== id), updated]
      return { ...current, tasks }
    })
    if (saved) showList(editorTask?.completedAt ? 'completed' : list)
  }

  const cannotReopen = (task: Task) => Boolean(task.completedAt && taskList(task) === 'today' && todayIsFull)

  const toggleTask = (task: Task) => {
    if (cannotReopen(task)) return
    const completedAt = task.completedAt ? null : new Date().toISOString()
    if (onUpdate(current => ({
      ...current,
      tasks: current.tasks.map(item => item.id === task.id ? { ...item, completedAt } : item),
    }))) {
      setDeleting(null)
      if (filter === 'completed') showList(taskList(task))
    }
  }

  const reorder = (from: string, to: string) => {
    const position = visibleActive.findIndex(task => task.id === to)
    const task = visibleActive.find(task => task.id === from)
    if (!task || position < 0 || from === to) return
    if (onUpdate(current => {
      const tasks = [...current.tasks]
      const fromIndex = tasks.findIndex(task => task.id === from)
      const toIndex = tasks.findIndex(task => task.id === to)
      if (fromIndex < 0 || toIndex < 0) return current
      const [moved] = tasks.splice(fromIndex, 1)
      tasks.splice(toIndex, 0, moved)
      return { ...current, tasks }
    })) setOrderStatus(`${task.title} moved to position ${position + 1}.`)
  }

  const moveTask = (task: Task, target: TaskList | 'completed') => {
    if (target === 'today' && (task.completedAt || taskList(task) !== 'today') && todayIsFull) return
    const saved = onUpdate(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id
      ? { ...item, list: target === 'completed' ? taskList(item) : target,
        completedAt: target === 'completed' ? (item.completedAt ?? new Date().toISOString()) : null }
      : item) }))
    if (saved) showList(target)
  }

  const clearDrag = () => {
    setDragging(null)
    setDropTarget(null)
  }

  const removeTask = (id: string) => {
    if (onDeleteTask(id)) setDeleting(null)
  }

  const breakCard = focusTaskTitle !== undefined && <BreakCard taskTitle={focusTaskTitle} activeTime={pausedActiveTime ?? '00:00:00'} showTime={showPausedTime} running={focusRunning} language={language}
    onPause={onPauseFocus} onContinue={onContinueFocus} onReturn={onReturnToFocus} onFinish={onFinishPaused} onCancel={onCancelFocus} />
  const addTaskButton = <button type="button" className={`life-main-add-task${!nextTask && !breakCard ? ' life-main-add-task-inline' : ''}`} onClick={() => openTasks(true)}>
    <span className="life-main-shortcut-icon add"><Plus size={21} aria-hidden="true" /></span>
    <strong>{t('Add a task')}</strong>
  </button>

  if (screen === 'home') return <main className="life-main life-main-home">
    <header className="life-main-hero">
      <div><span className="life-main-hub-name">Hub</span><h1 ref={heading} tabIndex={-1}>{language === 'ru' ? 'Добро пожаловать' : 'Welcome'}{displayName?.trim() ? `, ${displayName.trim()}` : ''}!</h1>
        <p className="life-main-thanks">{language === 'ru' ? 'Спасибо' : 'Thank you'} <Heart size={13} fill="currentColor" aria-hidden="true" /></p>
        <a className="life-main-discord" href="https://discord.gg/y4s67MzZr" target="_blank" rel="noopener noreferrer">
          {language === 'ru' ? 'Вступить в Discord' : 'Join Discord'} <ArrowRight size={15} aria-hidden="true" />
        </a>
        <a className="life-main-github" href={repoUrl} target="_blank" rel="noopener noreferrer">
          <Github size={15} aria-hidden="true" /> {t('View on GitHub')}
        </a>
        <a className="life-main-support" href="https://ko-fi.com/lifeosapp" target="_blank" rel="noopener noreferrer">
          <Heart size={15} aria-hidden="true" /> {language === 'ru' ? 'Поддержать LifePortable' : 'Support LifePortable'}
        </a>
      </div>
      <div className="life-main-hero-actions">
        <span className="home-icon-action">
          <button type="button" className="life-main-icon life-main-settings" aria-label={t(searchIncludesJournal ? 'Search tasks and journal' : 'Search tasks')}
            aria-haspopup="dialog" onClick={onSearch}><Search size={20} aria-hidden="true" /></button>
        </span>
        <span className="home-icon-action">
          <button type="button" className="life-main-icon life-main-settings" aria-label={t('Open settings')} onClick={onSettings}><Settings2 size={20} /></button>
        </span>
      </div>
    </header>

    <div className="life-main-stack">
      {breakCard || <section className="life-main-today" aria-labelledby="life-main-today">
        <div className="life-main-today-heading">
          <h2 id="life-main-today">{t('Today')}</h2>
          {totalToday > 0 && <span>{doneToday.length} / {totalToday} {language === 'ru' ? 'выполнено' : 'done'}</span>}
        </div>
        {totalToday > 0 && <progress max={totalToday} value={doneToday.length} aria-label="Today’s task progress" />}
        {nextTask ? <>
          <div className="life-main-next">
            <button type="button" className="life-main-complete" aria-label={`Complete ${nextTask.title}`} onClick={() => toggleTask(nextTask)}><Circle size={22} /></button>
            <div>
              <button type="button" className="life-main-task-link" aria-haspopup="dialog" onClick={() => onOpenTask(nextTask.id)}>
                <span>{nextTask.title}</span><ChevronRight size={16} aria-hidden="true" />
              </button>
              <p>{t('Next up')}</p>
            </div>
            <button type="button" className="life-main-icon life-main-start-small" aria-label={`Start ${nextTask.title}`} onClick={() => onStart(nextTask)}>
              <Play size={17} fill="currentColor" aria-hidden="true" />
            </button>
          </div>
        </> : <div className="life-main-today-empty-state">
          <p className="life-main-today-empty">{t(doneToday.length ? 'You’re all caught up' : 'No tasks for today')}</p>
          {addTaskButton}
        </div>}
      </section>}

      {(nextTask || breakCard) && addTaskButton}

      <section className="life-main-services" aria-labelledby="life-main-services-title">
      <h2 id="life-main-services-title">Live Services</h2>
      <nav className="life-main-shortcuts" aria-label="Live Services">
        {showTasksShortcut && <button type="button" onClick={() => openTasks()}>
          <span className="life-main-shortcut-icon tasks"><ClipboardList size={21} aria-hidden="true" /></span>
          <strong>LifeTasks</strong>
        </button>}
        {onJournal && <button type="button" onClick={onJournal}>
          <span className="life-main-shortcut-icon journal"><BookOpen size={21} aria-hidden="true" /></span>
          <strong>LifeJournal</strong>
        </button>}
        {showFocusShortcut && <button type="button" onClick={breakCard ? onReturnToFocus : onStartOpenFocus}>
          <span className="life-main-shortcut-icon focus"><Play size={21} aria-hidden="true" /></span>
          <strong>LifeTime</strong>
        </button>}
        <a href="https://gymos-preview.vercel.app/" target="_blank" rel="noopener noreferrer"
          aria-label={language === 'ru' ? 'Открыть LiveGym в новой вкладке' : 'Open LiveGym in a new tab'}>
          <span className="life-main-shortcut-icon gym"><Dumbbell size={21} aria-hidden="true" /></span>
          <strong>LiveGym</strong>
        </a>
        <a href="https://clients-manager-dad-demo.vercel.app/login" target="_blank" rel="noopener noreferrer"
          aria-label={language === 'ru' ? 'Открыть страницу входа LiveClients в новой вкладке' : 'Open LiveClients sign-in in a new tab'}>
          <span className="life-main-shortcut-icon clients"><BriefcaseBusiness size={21} aria-hidden="true" /></span>
          <strong>LiveClients</strong>
        </a>
        <div className="life-main-service-soon">
          <span className="life-main-shortcut-icon future"><BookText size={21} aria-hidden="true" /></span>
          <span className="life-main-service-copy"><strong>LiveBible</strong><small>{language === 'ru' ? 'Скоро' : 'Coming soon'}</small></span>
        </div>
        <div className="life-main-service-soon">
          <span className="life-main-shortcut-icon future"><Code2 size={21} aria-hidden="true" /></span>
          <span className="life-main-service-copy"><strong>LiveCode</strong><small>{language === 'ru' ? 'Скоро' : 'Coming soon'}</small></span>
        </div>
        <div className="life-main-service-soon">
          <span className="life-main-shortcut-icon future"><ShieldCheck size={21} aria-hidden="true" /></span>
          <span className="life-main-service-copy"><strong>LiveSecure</strong><small>{language === 'ru' ? 'Скоро' : 'Coming soon'}</small></span>
        </div>
        <div className="life-main-service-soon">
          <span className="life-main-shortcut-icon future"><CalendarDays size={21} aria-hidden="true" /></span>
          <span className="life-main-service-copy"><strong>LivePlan</strong><small>{language === 'ru' ? 'Скоро' : 'Coming soon'}</small></span>
        </div>
      </nav>
      </section>
      <button type="button" className="life-main-text life-main-history-link" onClick={onFocusHistory}>
        <History size={17} aria-hidden="true" /> {t('Focus history')} <ChevronRight size={15} aria-hidden="true" />
      </button>
    </div>
  </main>

  const draggedIndex = visibleActive.findIndex(task => task.id === dragging)
  const visible = filter === 'completed' ? completed : filter === 'today' ? [...visibleActive, ...doneToday] : visibleActive
  const addList = filter === 'completed' ? (todayIsFull ? 'someday' : 'today') : filter
  const canAdd = filter !== 'today' || !todayIsFull

  return <main className="life-main life-main-tasks">
    <header className="life-main-tasks-header">
      {!hideBack && <button type="button" className="life-main-icon" aria-label={t(returnLabel)} onClick={() => {
        if (onReturnHome) onReturnHome()
        else { setScreen('home'); showList('today') }
      }}><ArrowLeft size={21} /></button>}
      <h1 ref={heading} tabIndex={-1}>LifeTasks</h1>
      <button type="button" className="life-main-icon" aria-label={t('Add task')} aria-haspopup="dialog" disabled={!canAdd} onClick={() => addTo(addList)}><Plus size={23} /></button>
    </header>

    {breakCard}

    <div className="life-main-filters" role="group" aria-label="Filter tasks">
      {taskLists.map(list => <button type="button" key={list} aria-pressed={filter === list} onClick={() => showList(list)}>{t(listLabels[list])}</button>)}
      <button type="button" aria-pressed={filter === 'completed'} onClick={() => showList('completed')}>{t('Done')}</button>
    </div>

    <JournalSheet dialog={editorDialog} label={t(editor?.id ? 'Edit task' : 'New task')} closeLabel={t('Close task editor')}
      className="journal-sheet--centered"
      onClose={() => { if (!editorDialog.current?.open) setEditor(null) }}>
    {editor && <form className="life-main-editor" onSubmit={saveTask}>
      <label htmlFor="life-main-task-title" className="journal-sr-only">{t('Task name')}</label>
      <input id="life-main-task-title" placeholder={t('Task name')} maxLength={140} value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} />
      <span id="life-main-task-list-label" className="life-main-editor-label">{t('List')}</span>
      <div className="life-main-filters life-main-editor-lists" role="group" aria-labelledby="life-main-task-list-label">
        {taskLists.map(list => {
          const full = list === 'today' && cannotAddToToday
          return <button type="button" key={list} aria-pressed={editor.list === list} disabled={full}
            onClick={() => setEditor({ ...editor, list })}>
            {t(listLabels[list])}{full ? (language === 'ru' ? ' (полный)' : ' (full)') : ''}
          </button>
        })}
      </div>
      <div className="life-main-editor-actions">
        <button type="button" className="life-main-text" onClick={() => editorDialog.current?.close()}>{t('Cancel')}</button>
        <button type="submit" className="life-main-primary" disabled={!editor.title.trim() || (editor.list === 'today' && cannotAddToToday)}>{t(editor.id ? 'Save task' : 'Add task')}</button>
      </div>
    </form>}
    </JournalSheet>

    <p className="life-main-task-status" role="status">{orderStatus}</p>
    {visible.length ? <ul className="life-main-task-list">
      {visible.map(task => {
        const index = visibleActive.findIndex(item => item.id === task.id)
        const previous = index > 0 ? visibleActive[index - 1] : undefined
        const next = index >= 0 ? visibleActive[index + 1] : undefined
        const canReorder = index >= 0 && visibleActive.length > 1
        return <li className="life-main-task" key={task.id}
          data-drop-target={dropTarget === task.id ? (draggedIndex < index ? 'after' : 'before') : undefined}
          onDragOver={event => {
            if (!dragging) return
            if (dragging === task.id || index < 0) {
              setDropTarget(null)
              return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget(task.id)
          }}
          onDrop={event => {
            if (!dragging || index < 0) return
            event.preventDefault()
            reorder(dragging, task.id)
            clearDrag()
          }}>
          <div className="life-main-task-row">
            <button type="button" className="life-main-complete" disabled={cannotReopen(task)}
              title={cannotReopen(task) ? 'Move the task to another list or make space in Today' : undefined}
              aria-label={task.completedAt ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
              onClick={() => toggleTask(task)}>{task.completedAt ? <Check size={19} /> : <Circle size={22} />}</button>
            <span className="life-main-task-title">
              <button type="button" className="life-main-task-link" aria-haspopup="dialog" onClick={() => onOpenTask(task.id)}>
                <span>{task.title}</span><ChevronRight size={16} aria-hidden="true" />
              </button>
              {task.completedAt && <small>{t(listLabels[taskList(task)])} · {new Date(task.completedAt).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}</small>}
            </span>
            {!task.completedAt && !breakCard && <button type="button" className="life-main-icon life-main-start-small" aria-label={`Start ${task.title}`} onClick={() => onStart(task)}><Play size={17} fill="currentColor" /></button>}
            {canReorder && <button type="button" className="life-main-icon life-main-task-drag" aria-label={`${language === 'ru' ? 'Изменить порядок:' : 'Reorder:'} ${task.title}`}
              title={language === 'ru' ? 'Перетащите или используйте стрелки вверх/вниз' : 'Drag or use up/down arrows'} draggable
              onKeyDown={event => {
                const neighbor = event.key === 'ArrowUp' ? previous : event.key === 'ArrowDown' ? next : undefined
                if (neighbor) { event.preventDefault(); reorder(task.id, neighbor.id) }
              }}
              onDragStart={event => {
                event.dataTransfer.setData('text/plain', task.id)
                event.dataTransfer.effectAllowed = 'move'
                setDragging(task.id)
              }}
              onDragEnd={clearDrag}><GripHorizontal size={21} /></button>}
          </div>
          <div className="life-main-task-actions">
            <button type="button" className="life-main-text" aria-haspopup="dialog" onClick={() => {
              setEditor({ id: task.id, title: task.title, list: taskList(task) })
            }}><Pencil size={15} /> {language === 'ru' ? 'Редактировать' : 'Edit'}</button>
            <details className="life-main-task-move">
              <summary className="life-main-text"><ArrowRight size={15} /> {language === 'ru' ? 'Переместить' : 'Move'}</summary>
              <div className="life-main-task-move-options">
                {(['today', 'someday', 'completed'] as const).filter(target => task.completedAt ? target !== 'completed' : target !== taskList(task)).map(target =>
                  <button type="button" key={target} disabled={target === 'today' && todayIsFull && (Boolean(task.completedAt) || taskList(task) !== 'today')}
                    onClick={event => {
                      event.currentTarget.closest('details')?.removeAttribute('open')
                      moveTask(task, target)
                    }}>{t(target === 'completed' ? 'Done' : listLabels[target])}</button>)}
              </div>
            </details>
            <button type="button" className="life-main-text life-main-task-delete" onClick={() => setDeleting(task.id)}><Trash2 size={15} /> {t('Delete')}</button>
          </div>
          {deleting === task.id && <div className="life-main-delete">
            <span>{t('Delete this task?')}</span>
            <button type="button" className="life-main-icon" aria-label="Cancel deletion" onClick={() => setDeleting(null)}><X size={16} /></button>
            <button type="button" className="life-main-text" onClick={() => removeTask(task.id)}>{t('Delete task')}</button>
          </div>}
        </li>
      })}
    </ul> : <div className="life-main-tasks-empty">
      <ListTodo size={25} />
      <p>{filter === 'completed' ? t('Completed tasks will appear here.') : filter === 'today' ? t('No tasks for today.') : language === 'ru' ? `В списке «${t(listLabels[filter])}» пока нет задач.` : `No tasks in ${listLabels[filter]}.`}</p>
    </div>}

    {filter === 'today' && todayIsFull && <p className="life-main-limit">{t('Today has five active tasks. Complete or move one to make space.')}</p>}
    {filter !== 'completed' && <div className="life-main-tasks-footer">
      {canAdd && <button type="button" className="life-main-text" aria-haspopup="dialog" onClick={() => addTo(filter)}><Plus size={18} /> {t('Add a task')} <ArrowRight size={16} /></button>}
    </div>}
  </main>
}
