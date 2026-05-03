const LESSON_PREFIX = "__GENM_LESSON__:";
const TASK_PREFIX = "__GENM_TASK__:";

type LessonPayload = {
  topic: string;
  summary: string;
  instructorName?: string | null;
  programmeFocus?: string | null;
  lessonObjective?: string | null;
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
  instructorName?: string | null;
  programmeFocus?: string | null;
  taskCategory?: string | null;
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
      instructorName: null,
      programmeFocus: null,
      lessonObjective: null,
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
      instructorName: null,
      programmeFocus: null,
      lessonObjective: null,
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
      instructorName: parsed.instructorName ?? null,
      programmeFocus: parsed.programmeFocus ?? null,
      lessonObjective: parsed.lessonObjective ?? null,
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
      instructorName: null as string | null,
      programmeFocus: null as string | null,
      taskCategory: null as string | null,
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
      instructorName: null as string | null,
      programmeFocus: null as string | null,
      taskCategory: null as string | null,
      resourceLinks: [] as string[],
      evidenceMode: null as string | null,
      weekLabel: null as string | null,
      termId: null as string | null,
      familyNote: null as string | null,
    };
  }

  return {
    instructions: parsed.instructions ?? null,
    instructorName: parsed.instructorName ?? null,
    programmeFocus: parsed.programmeFocus ?? null,
    taskCategory: parsed.taskCategory ?? null,
    resourceLinks: Array.isArray(parsed.resourceLinks) ? parsed.resourceLinks : [],
    evidenceMode: parsed.evidenceMode ?? null,
    weekLabel: parsed.weekLabel ?? null,
    termId: parsed.termId ?? null,
    familyNote: parsed.familyNote ?? null,
  };
}
