export const HOUSE_POINT_RULES = {
  SUNNAH_DAILY_SUBMISSION: { points: 5, label: "Daily Sunnah tracker submission" },
  SUNNAH_TASK_COMPLETED: { points: 10, label: "Completed Sunnah tracker task" },
  FARDH_FAJR_ISHA: { points: 25, label: "Completed Fajr or Isha prayer" },
  FARDH_OTHER_PRAYER: { points: 15, label: "Completed Dhuhr, Asr or Maghrib prayer" },
  ATTENDANCE_ON_TIME: { points: 25, label: "Joined class early or on time" },
  ATTENDANCE_LATE: { points: 5, label: "Joined class after the on-time window" },
  HOMEWORK_SUBMITTED: { points: 15, label: "Submitted homework" },
  CAMERA_STUDY_READY: { points: 10, label: "Camera on with a prepared study corner" },
  LIVE_QUIZ_ANSWER: { points: 10, label: "Strong live quiz answer" },
  POSITIVE_PARTICIPATION: { points: 10, label: "Positive and focused class participation" },
} as const;