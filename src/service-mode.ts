// Each extracted service keeps the shared data model but opens its own workspace.
export const serviceMode: 'hub' | 'tasks' | 'journal' | 'time' = 'time'
export const serviceName = { hub: 'LifeHub', tasks: 'LifeTasks', journal: 'LifeJournal', time: 'LifeTime' }[serviceMode]
const repositoryName = { hub: 'LiveHub', tasks: 'LiveTasks', journal: 'LiveJournal', time: 'LiveTime' }[serviceMode]
export const repositoryUrl = `https://github.com/LevPetrogradsky/${repositoryName}`
