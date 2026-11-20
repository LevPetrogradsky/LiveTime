// server/livetime-history.ts
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// src/journal/photo.ts
var photoPrefix = "data:image/jpeg;base64,";
var maxPhotoBytes = 18e4;
var maxPhotoEdge = 960;
var maxInputBytes = 12 * 1024 * 1024;
function hasBoundedJpegFrame(bytes) {
  const byte = (index) => bytes.charCodeAt(index);
  if (bytes.length < 8 || byte(0) !== 255 || byte(1) !== 216 || byte(bytes.length - 2) !== 255 || byte(bytes.length - 1) !== 217) return false;
  let offset = 2;
  let boundedFrame = false;
  while (offset < bytes.length) {
    if (byte(offset++) !== 255) return false;
    while (byte(offset) === 255) offset++;
    const marker = byte(offset++);
    const size = byte(offset) * 256 + byte(offset + 1);
    if (!Number.isFinite(size) || size < 2 || offset + size > bytes.length) return false;
    if (marker === 192 || marker === 193 || marker === 194) {
      if (boundedFrame || size < 8) return false;
      const height = byte(offset + 3) * 256 + byte(offset + 4);
      const width = byte(offset + 5) * 256 + byte(offset + 6);
      if (!width || !height || width > maxPhotoEdge || height > maxPhotoEdge) return false;
      boundedFrame = true;
    }
    if (marker === 218) return boundedFrame && size >= 8 && offset + size < bytes.length - 2;
    if (marker === 217) return false;
    offset += size;
  }
  return false;
}
function isJournalPhoto(value) {
  if (typeof value !== "string" || !value.startsWith(photoPrefix) || value.length > photoPrefix.length + Math.ceil(maxPhotoBytes / 3) * 4) return false;
  try {
    const base64 = value.slice(photoPrefix.length);
    const bytes = atob(base64);
    return bytes.length <= maxPhotoBytes && btoa(bytes) === base64 && hasBoundedJpegFrame(bytes);
  } catch {
    return false;
  }
}

// src/journal/location.ts
function validApproximateLocation(value) {
  if (!value || typeof value !== "object" || !("latitude" in value) || !("longitude" in value)) return false;
  const { latitude, longitude } = value;
  return typeof latitude === "number" && typeof longitude === "number" && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && Math.abs(latitude * 10 - Math.round(latitude * 10)) < 1e-8 && Math.abs(longitude * 10 - Math.round(longitude * 10)) < 1e-8;
}

// src/journal/device.ts
var journalDevices = ["iphone", "ipad", "android", "windows", "mac", "unknown"];

// src/data.ts
var navigationSections = [
  { id: "main", label: "Hub" },
  { id: "flow", label: "3 questions" },
  { id: "journal", label: "Journal" }
];
var shortcuts = [
  { id: "journal", label: "Journal" },
  { id: "tasks", label: "Tasks" },
  { id: "focus", label: "Focus" },
  { id: "flow", label: "3 questions" }
];
var visibleShortcuts = shortcuts.filter((shortcut) => shortcut.id !== "flow");
var breakReminderMinutes = [0, 5, 10, 15, 20];
var postFocusActions = ["reflection", "check-in"];
var focusPresetIds = ["work", "creativity", "grounding", "bible-reading"];
var maxDisplayNameLength = 40;
var taskLists = ["today", "someday"];
var maxJournalFolderNameLength = 60;
var journalFolderColors = ["blue", "green", "purple", "amber", "pink", "slate"];
var journalFolderIcons = ["folder", "briefcase", "book", "heart", "star", "lightbulb", "leaf", "camera"];
var emptyData = () => ({
  version: 1,
  tasks: [],
  sessions: [],
  journal: [],
  importedNotes: [],
  activeSession: null,
  pendingSession: null,
  theme: "system",
  language: "en",
  askLiveOSInBar: true,
  shortcutPreferences: { tasks: { bar: false }, journal: { bar: false } }
});
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isString(value) {
  return typeof value === "string";
}
function isTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function decodeCanonicalBase64(value) {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    let encoded = "";
    for (let index = 0; index < bytes.length; index += 8192) encoded += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return btoa(encoded) === value ? bytes : null;
  } catch {
    return null;
  }
}
function validNoteBlocks(value, byteLength) {
  if (!Array.isArray(value) || value.length === 0 || byteLength === 0) return false;
  let expectedStart = 0;
  const orders = /* @__PURE__ */ new Set();
  for (const block of value) {
    if (!isRecord(block) || !Number.isSafeInteger(block.order) || block.order < 1 || orders.has(block.order) || !isString(block.title) || !block.title.trim() || !Number.isSafeInteger(block.startByte) || !Number.isSafeInteger(block.endByte)) return false;
    if (block.startByte !== expectedStart || block.endByte <= block.startByte || block.endByte > byteLength) return false;
    orders.add(block.order);
    expectedStart = block.endByte;
  }
  return expectedStart === byteLength;
}
function validImportedNote(value) {
  if (!isRecord(value) || !isString(value.id) || !isString(value.sourceName) || !isString(value.sourceType) || !isTimestamp(value.importedAt) || !isString(value.sha256) || !/^[a-f0-9]{64}$/.test(value.sha256) || value.id !== value.sha256 || !Number.isSafeInteger(value.byteLength) || value.byteLength < 0 || !isString(value.rawSource) || !isString(value.rawBytesBase64)) return false;
  const bytes = decodeCanonicalBase64(value.rawBytesBase64);
  if (!bytes || bytes.byteLength !== value.byteLength) return false;
  if (new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) !== value.rawSource) return false;
  return value.noteBlocks === void 0 || validNoteBlocks(value.noteBlocks, bytes.byteLength);
}
function validateLiveOSData(value) {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.tasks) || !Array.isArray(value.sessions) || !Array.isArray(value.journal) || !Array.isArray(value.importedNotes)) return false;
  const validActiveSession = (item) => isRecord(item) && isString(item.id) && (item.taskId === null || isString(item.taskId)) && isString(item.taskTitle) && isTimestamp(item.startedAt) && (item.pausedAt === void 0 || isTimestamp(item.pausedAt)) && (item.breakReminderDismissed === void 0 || typeof item.breakReminderDismissed === "boolean") && (item.silenceBreakReminders === void 0 || typeof item.silenceBreakReminders === "boolean") && (item.pausedDurationMs === void 0 || typeof item.pausedDurationMs === "number" && Number.isSafeInteger(item.pausedDurationMs) && item.pausedDurationMs >= 0);
  if (value.activeSession !== null && !validActiveSession(value.activeSession)) return false;
  if (value.pendingSession !== null && !(validActiveSession(value.pendingSession) && isTimestamp(value.pendingSession.endedAt))) return false;
  if (value.focusCheckinEnabled !== void 0 && typeof value.focusCheckinEnabled !== "boolean") return false;
  if (value.postFocusAction !== void 0 && !postFocusActions.some((action) => action === value.postFocusAction)) return false;
  if (value.focusPresetId !== void 0 && !focusPresetIds.some((id) => id === value.focusPresetId)) return false;
  if (value.timerDefaultView !== void 0 && value.timerDefaultView !== "full" && value.timerDefaultView !== "compact") return false;
  if (value.displayName !== void 0 && (!isString(value.displayName) || value.displayName.length > maxDisplayNameLength)) return false;
  if (value.breakReminderMinutes !== void 0 && !breakReminderMinutes.some((minutes) => minutes === value.breakReminderMinutes)) return false;
  if (value.theme !== "light" && value.theme !== "dark" && value.theme !== "system") return false;
  if (value.language !== void 0 && value.language !== "en" && value.language !== "ru") return false;
  if (value.timeFormat !== void 0 && value.timeFormat !== "12" && value.timeFormat !== "24") return false;
  if (value.interactiveTips !== void 0 && typeof value.interactiveTips !== "boolean") return false;
  if (value.hiddenSections !== void 0 && (!Array.isArray(value.hiddenSections) || !value.hiddenSections.every((id) => navigationSections.some((section) => section.id === id)))) return false;
  if (value.askLiveOSInBar !== void 0 && typeof value.askLiveOSInBar !== "boolean") return false;
  if (value.shortcutPreferences !== void 0 && (!isRecord(value.shortcutPreferences) || !Object.entries(value.shortcutPreferences).every(([id, options]) => shortcuts.some((shortcut) => shortcut.id === id) && isRecord(options) && Object.entries(options).every(([location, enabled]) => (location === "home" || location === "bar") && typeof enabled === "boolean")))) return false;
  const validTask = (item) => isRecord(item) && isString(item.id) && isString(item.title) && isTimestamp(item.createdAt) && (item.completedAt === null || isTimestamp(item.completedAt)) && (item.list === void 0 || taskLists.some((list) => list === item.list));
  const validSessionRatings = (item) => {
    const ratings = [item.interest, item.continueDesire, item.progress];
    return ratings.every((value2) => value2 === null) || ratings.every((value2) => typeof value2 === "number" && Number.isFinite(value2));
  };
  const validSession = (item) => isRecord(item) && isString(item.id) && (item.taskId === null || isString(item.taskId)) && isString(item.taskTitle) && isTimestamp(item.startedAt) && isTimestamp(item.endedAt) && typeof item.durationMs === "number" && Number.isFinite(item.durationMs) && validSessionRatings(item) && Array.isArray(item.factors) && item.factors.every((factor) => ["Meaningful Goal", "Personal Control", "Fast Feedback", "Other"].includes(factor));
  const folderIds = /* @__PURE__ */ new Set();
  const folderNames = /* @__PURE__ */ new Set();
  if (value.journalFolders !== void 0) {
    if (!Array.isArray(value.journalFolders)) return false;
    for (const folder of value.journalFolders) {
      if (!isRecord(folder) || !isString(folder.id) || !folder.id || folderIds.has(folder.id) || !isString(folder.name) || !folder.name.trim() || folder.name !== folder.name.trim() || folder.name.length > maxJournalFolderNameLength || folder.order !== void 0 && (!Number.isSafeInteger(folder.order) || folder.order < 0) || folder.color !== void 0 && !journalFolderColors.some((color) => color === folder.color) || folder.icon !== void 0 && !journalFolderIcons.some((icon) => icon === folder.icon)) return false;
      const name = folder.name.toLowerCase();
      if (folderNames.has(name)) return false;
      folderIds.add(folder.id);
      folderNames.add(name);
    }
  }
  const validJournal = (item) => isRecord(item) && isString(item.id) && isString(item.text) && isTimestamp(item.createdAt) && (item.createdOn === void 0 || journalDevices.some((device) => device === item.createdOn)) && (item.updatedAt === void 0 || isTimestamp(item.updatedAt)) && (item.photo === void 0 || isJournalPhoto(item.photo)) && (item.taskId === void 0 || isString(item.taskId)) && (item.linkedEntryId === void 0 || isString(item.linkedEntryId) && item.linkedEntryId.length > 0 && item.linkedEntryId.length <= 200 && item.linkedEntryId !== item.id) && (item.location === void 0 || validApproximateLocation(item.location)) && (item.folderId === void 0 || isString(item.folderId) && folderIds.has(item.folderId));
  const flowEngine = value.flowEngine;
  let validFlowEngine = flowEngine === void 0;
  if (isRecord(flowEngine)) {
    const sessions = new Set(value.sessions.filter(isRecord).map((session) => session.id).filter(isString));
    const discoveries = flowEngine.discoveries;
    const hypotheses = flowEngine.hypotheses;
    const experiments = flowEngine.experiments;
    const principles = flowEngine.principles;
    if (Array.isArray(discoveries) && Array.isArray(hypotheses) && Array.isArray(experiments) && Array.isArray(principles)) {
      const validSignals = (signals) => signals === void 0 || Array.isArray(signals) && new Set(signals).size === signals.length && signals.every((signal) => signal === "Meaningful Goal" || signal === "Fast Feedback" || signal === "Personal Control");
      const validDiscovery = (item) => isRecord(item) && isString(item.id) && isTimestamp(item.createdAt) && isString(item.enjoyableWork) && isString(item.motivation) && isString(item.desireToReturn) && validSignals(item.signals);
      const validHypothesis = (item) => isRecord(item) && isString(item.id) && isTimestamp(item.createdAt) && isString(item.statement) && item.statement.trim().length > 0 && (item.sourceDiscoveryId === null || discoveries.some((discovery) => isRecord(discovery) && discovery.id === item.sourceDiscoveryId)) && (item.status === "active" || item.status === "rejected");
      const validExperiment = (item) => isRecord(item) && isString(item.id) && isTimestamp(item.createdAt) && hypotheses.some((hypothesis) => isRecord(hypothesis) && hypothesis.id === item.hypothesisId) && isString(item.condition) && item.condition.trim().length > 0 && Array.isArray(item.sessionIds) && item.sessionIds.every((id) => isString(id) && sessions.has(id)) && new Set(item.sessionIds).size === item.sessionIds.length && (item.status === "active" || item.status === "completed");
      const validPrinciple = (item) => isRecord(item) && isString(item.id) && isTimestamp(item.createdAt) && isTimestamp(item.updatedAt) && hypotheses.some((hypothesis) => isRecord(hypothesis) && hypothesis.id === item.hypothesisId) && experiments.some((experiment) => isRecord(experiment) && experiment.id === item.experimentId && experiment.hypothesisId === item.hypothesisId) && isString(item.text) && item.text.trim().length > 0 && Array.isArray(item.evidenceSessionIds) && item.evidenceSessionIds.every((id) => isString(id) && sessions.has(id)) && (item.status === "active" || item.status === "rejected");
      validFlowEngine = discoveries.every(validDiscovery) && hypotheses.every(validHypothesis) && experiments.every(validExperiment) && principles.every(validPrinciple);
    }
  }
  return value.tasks.every(validTask) && value.sessions.every(validSession) && value.journal.every(validJournal) && value.importedNotes.every(validImportedNote) && validFlowEngine;
}

// server/livetime-history.ts
var livetime_history_default = { async fetch(request) {
  const reply = (status, body = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const url = process.env.LIVETIME_HISTORY_DATABASE_URL;
  if (!url) return reply(503);
  const match = /^LiveTime (lt-[0-9a-f]{64})$/.exec(request.headers.get("Authorization") ?? "");
  if (!match) return reply(401);
  const owner = createHash("sha256").update("livetime-history/v1:" + match[1]).digest("hex");
  try {
    const sql = neon(url);
    if (request.method === "PUT") {
      await sql`INSERT INTO livetime_guest_vaults (owner) VALUES (${owner}) ON CONFLICT DO NOTHING`;
      return reply(200);
    }
    if (request.method !== "GET" && request.method !== "POST") return reply(405);
    if (!(await sql`SELECT 1 FROM livetime_guest_vaults WHERE owner = ${owner}`).length) return reply(404);
    if (request.method === "GET") {
      const after = new URL(request.url).searchParams.get("after") ?? "";
      const rows = await sql`SELECT id, payload FROM livetime_guest_sessions WHERE owner = ${owner} AND id > ${after} ORDER BY id LIMIT 101`;
      return reply(200, { sessions: rows.slice(0, 100).map((row) => row.payload), next: rows.length > 100 ? rows[99].id : null });
    }
    const raw = await request.text();
    if (raw.length > 25e4) return reply(413);
    let sessions;
    try {
      sessions = JSON.parse(raw);
    } catch {
      return reply(400);
    }
    const data = { ...emptyData(), sessions };
    if (!Array.isArray(sessions) || sessions.length > 100 || !validateLiveOSData(data) || !data.sessions.every((session) => session.id.length > 0 && session.id.length <= 200)) return reply(400);
    await sql`INSERT INTO livetime_guest_sessions (owner, id, payload)
      SELECT ${owner}, entry->>'id', entry FROM jsonb_array_elements(${JSON.stringify(data.sessions)}::jsonb) AS entry
      ON CONFLICT (owner, id) DO UPDATE SET payload = EXCLUDED.payload
      WHERE livetime_guest_sessions.payload->'interest' = 'null'::jsonb AND EXCLUDED.payload->'interest' <> 'null'::jsonb`;
    return reply(200);
  } catch {
    return reply(503);
  }
} };
export {
  livetime_history_default as default
};
