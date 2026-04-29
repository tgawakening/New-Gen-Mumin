const LESSON_PREFIX = "__GENM_LESSON__:";
const TASK_PREFIX = "__GENM_TASK__:";

type LessonPayload = {
  topic: string;
  summary: string;
  homework?: string | null;
  resourceLinks?: string[];
  parentPrompt?: string | null;
  weekLabel?: string | null;
  termId?: string | null;
  contentType?: string | null;
  materials?: string | null;
};

type TaskPayload = {
  title: string;
  instructions: string;
  resourceLinks?: string[];
  evidenceMode?: string | null;
  weekLabel?: string | null;
  termId?: string | null;
  familyNote?: string | null;
};

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function buildLessonPayload(payload: LessonPayload) {
  return `${LESSON_PREFIX}${JSON.stringify(payload)}`;
}

export function parseLessonPayload(value: string, fallbackHomework?: string | null) {
  if (!value.startsWith(LESSON_PREFIX)) {
    return {
      topic: "",
      summary: value,
      homework: fallbackHomework ?? null,
      resourceLinks: [] as string[],
      parentPrompt: null,
      weekLabel: null,
      termId: null,
      contentType: null,
      materials: null,
    };
  }

  const parsed = safeJsonParse<LessonPayload>(value.slice(LESSON_PREFIX.length));

  if (!parsed) {
    return {
      topic: "",
      summary: value,
      homework: fallbackHomework ?? null,
      resourceLinks: [] as string[],
      parentPrompt: null,
      weekLabel: null,
      termId: null,
      contentType: null,
      materials: null,
    };
  }

  return {
    topic: parsed.topic ?? "",
    summary: parsed.summary ?? "",
    homework: parsed.homework ?? fallbackHomework ?? null,
    resourceLinks: Array.isArray(parsed.resourceLinks) ? parsed.resourceLinks : [],
    parentPrompt: parsed.parentPrompt ?? null,
    weekLabel: parsed.weekLabel ?? null,
    termId: parsed.termId ?? null,
    contentType: parsed.contentType ?? null,
    materials: parsed.materials ?? null,
  };
}

export function buildTaskPayload(payload: TaskPayload) {
  return `${TASK_PREFIX}${JSON.stringify(payload)}`;
}

export function parseTaskPayload(value: string | null) {
  if (!value || !value.startsWith(TASK_PREFIX)) {
    return {
      instructions: value,
      resourceLinks: [] as string[],
      evidenceMode: null as string | null,
      weekLabel: null as string | null,
      termId: null as string | null,
      familyNote: null as string | null,
    };
  }

  const parsed = safeJsonParse<TaskPayload>(value.slice(TASK_PREFIX.length));

  if (!parsed) {
    return {
      instructions: value,
      resourceLinks: [] as string[],
      evidenceMode: null as string | null,
      weekLabel: null as string | null,
      termId: null as string | null,
      familyNote: null as string | null,
    };
  }

  return {
    instructions: parsed.instructions ?? null,
    resourceLinks: Array.isArray(parsed.resourceLinks) ? parsed.resourceLinks : [],
    evidenceMode: parsed.evidenceMode ?? null,
    weekLabel: parsed.weekLabel ?? null,
    termId: parsed.termId ?? null,
    familyNote: parsed.familyNote ?? null,
  };
}
