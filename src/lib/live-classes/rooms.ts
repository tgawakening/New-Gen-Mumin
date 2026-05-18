export type StudentRoomAssignment = {
  subject?: string | null;
  roomName?: string | null;
  roomCode?: string | null;
  teacherName?: string | null;
  level?: string | null;
  instructions?: string | null;
};

const START_MARKER = "[GENM_ROOM_ASSIGNMENTS]";
const END_MARKER = "[/GENM_ROOM_ASSIGNMENTS]";

type RoomAssignmentMap = Record<string, StudentRoomAssignment>;

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function parseRoomAssignments(notes: string | null | undefined): RoomAssignmentMap {
  if (!notes) return {};

  const start = notes.indexOf(START_MARKER);
  const end = notes.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) return {};

  const raw = notes.slice(start + START_MARKER.length, end).trim();
  try {
    const parsed = JSON.parse(raw) as RoomAssignmentMap;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getStudentRoomAssignment(notes: string | null | undefined, programId: string) {
  return parseRoomAssignments(notes)[programId] ?? null;
}

export function updateRoomAssignmentNotes(
  notes: string | null | undefined,
  programId: string,
  assignment: StudentRoomAssignment,
) {
  const existingNotes = notes ?? "";
  const start = existingNotes.indexOf(START_MARKER);
  const end = existingNotes.indexOf(END_MARKER);
  const before = start === -1 ? existingNotes.trim() : existingNotes.slice(0, start).trim();
  const after = start !== -1 && end !== -1 ? existingNotes.slice(end + END_MARKER.length).trim() : "";
  const assignments = parseRoomAssignments(existingNotes);

  assignments[programId] = {
    subject: clean(assignment.subject),
    roomName: clean(assignment.roomName),
    roomCode: clean(assignment.roomCode),
    teacherName: clean(assignment.teacherName),
    level: clean(assignment.level),
    instructions: clean(assignment.instructions),
  };

  const encoded = `${START_MARKER}${JSON.stringify(assignments)}${END_MARKER}`;
  return [before, encoded, after].filter(Boolean).join("\n\n");
}
