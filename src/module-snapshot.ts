import { emptyData, validateLiveOSData, type JournalEntry, type JournalFolder, type LiveOSData, type Task } from './data.ts'

export type JournalSnapshot = { format: 'lifeos-journal'; version: 1; entries: JournalEntry[]; folders: JournalFolder[] }
export type TasksSnapshot = { format: 'lifeos-tasks'; version: 1; tasks: Task[] }

const copyEntry = (entry: JournalEntry): JournalEntry => ({
  id: entry.id,
  text: entry.text,
  createdAt: entry.createdAt,
  ...(entry.createdOn !== undefined && { createdOn: entry.createdOn }),
  ...(entry.updatedAt !== undefined && { updatedAt: entry.updatedAt }),
  ...(entry.photo !== undefined && { photo: entry.photo }),
  ...(entry.taskId !== undefined && { taskId: entry.taskId }),
  ...(entry.linkedEntryId !== undefined && { linkedEntryId: entry.linkedEntryId }),
  ...(entry.folderId !== undefined && { folderId: entry.folderId }),
  ...(entry.location !== undefined && { location: { ...entry.location } }),
})

const copyFolder = (folder: JournalFolder): JournalFolder => ({
  id: folder.id,
  name: folder.name,
  ...(folder.order !== undefined && { order: folder.order }),
  ...(folder.color !== undefined && { color: folder.color }),
  ...(folder.icon !== undefined && { icon: folder.icon }),
})

const copyTask = (task: Task): Task => ({
  id: task.id,
  title: task.title,
  createdAt: task.createdAt,
  completedAt: task.completedAt,
  ...(task.list !== undefined && { list: task.list }),
})

export function createJournalSnapshot(data: LiveOSData): JournalSnapshot {
  if (!validateLiveOSData(data)) throw new Error('LifePortable data needs recovery before Journal can be copied.')
  return { format: 'lifeos-journal', version: 1, entries: data.journal.map(copyEntry), folders: (data.journalFolders ?? []).map(copyFolder) }
}

export function createTasksSnapshot(data: LiveOSData): TasksSnapshot {
  if (!validateLiveOSData(data)) throw new Error('LifePortable data needs recovery before Tasks can be copied.')
  return { format: 'lifeos-tasks', version: 1, tasks: data.tasks.map(copyTask) }
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).sort().join(',') === keys.sort().join(',')

export function parseJournalSnapshot(raw: string): JournalSnapshot {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Journal copy is not valid JSON.') }
  if (!object(value) || !exactKeys(value, ['format', 'version', 'entries', 'folders']) ||
    value.format !== 'lifeos-journal' || value.version !== 1 || !Array.isArray(value.entries) || !Array.isArray(value.folders)) {
    throw new Error('Journal copy has an unsupported format.')
  }
  const candidate = { ...emptyData(), journal: value.entries, journalFolders: value.folders }
  if (!validateLiveOSData(candidate) || new Set(value.entries.map(entry => entry.id)).size !== value.entries.length) {
    throw new Error('Journal copy contains invalid entries or folders.')
  }
  return createJournalSnapshot(candidate)
}

export function parseTasksSnapshot(raw: string): TasksSnapshot {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Tasks copy is not valid JSON.') }
  if (!object(value) || !exactKeys(value, ['format', 'version', 'tasks']) ||
    value.format !== 'lifeos-tasks' || value.version !== 1 || !Array.isArray(value.tasks)) {
    throw new Error('Tasks copy has an unsupported format.')
  }
  const candidate = { ...emptyData(), tasks: value.tasks }
  if (!validateLiveOSData(candidate) || new Set(value.tasks.map(task => task.id)).size !== value.tasks.length) {
    throw new Error('Tasks copy contains invalid tasks.')
  }
  return createTasksSnapshot(candidate)
}
