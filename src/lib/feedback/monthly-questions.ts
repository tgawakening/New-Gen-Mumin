export type Answers = Record<string, string | string[]>;
export type Question = { id: string; label: string; kind: "choice" | "multi" | "text" | "number"; options?: string[]; required?: boolean; when?: [string, string] };
const ability = ["Yes", "A little bit", "No", "Not sure"];
const choice = (id: string, label: string, options: string[], required = false): Question => ({ id, label, kind: "choice", options, required });
const text = (id: string, label: string): Question => ({ id, label, kind: "text" });
const multi = (id: string, label: string, options: string[]): Question => ({ id, label, kind: "multi", options });
export const MONTHLY_SECTIONS = [
 { title: "Arabic learning", description: "Tell us what your child can do and how we can support their learning.", questions: [
  choice("arabicParticipation", "Did your child take Arabic lessons this month?", ["Yes", "No"], true),
  choice("arabicLevel", "How would you describe their current Arabic level?", ["Beginner", "Basic", "Intermediate", "Advanced", "Not sure"]),
  choice("readLetters", "Can your child read Arabic letters confidently?", ability),
  choice("readWords", "Can your child join letters and read Arabic words?", ability),
  choice("understandArabic", "Can your child understand basic Arabic words and sentences?", ability),
  choice("introduceSelf", "Can your child introduce themselves in Arabic?", ability),
  choice("dailyRoutine", "Can your child describe their daily routine in Arabic?", ability),
  { id: "newWords", label: "Approximately how many new Arabic words have they learned in the last three months? Leave blank if unsure.", kind: "number" } as Question,
  choice("classDuration", "What Arabic class duration would you prefer?", ["1 hour", "45 minutes", "30 minutes", "No preference"]),
  multi("practiceBarriers", "What makes practising Arabic at home difficult?", ["Limited time", "I do not know Arabic", "Pronunciation confidence", "Keeping my child interested", "My child rarely replies in Arabic", "No difficulties"]),
  multi("arabicSupport", "Where would your child benefit from more help?", ["Reading fluently", "Joining letters / words", "Vocabulary", "Speaking", "Understanding sentences", "Writing", "Confidence", "Revision", "Listening"]),
  choice("practiceGroup", "Would you join Arabic practice activities with teachers, parents and a native speaker?", ["Yes", "Maybe", "No"]),
  choice("otherLearning", "Is your child learning Arabic or Quran elsewhere?", ["With another teacher / institution", "With a parent at home", "No"]),
  multi("tajweedGoals", "What would you like your child to gain from Quran / tajweed lessons?", ["Fluent Quran reading (Nazra)", "Correct pronunciation (makharij)", "Confident, fluent recitation", "Not applicable"]),
  text("practiceDetails", "Please briefly explain how Arabic practice is going at home so we can support you. If there are no difficulties, say what is working well."),
  { ...text("practiceGroupReason", "If you would not like to join Arabic practice activities, please tell us why."), when: ["practiceGroup", "No"] as [string, string] },
  text("teachingFeedback", "How is the Arabic teacher's teaching style working for your child? What could improve?"),
 ] },
 { title: "Seerah, life skills & interests", description: "Share what engages your child and the changes you would find helpful.", questions: [
  choice("seerahExperience", "How has your child found Seerah sessions this month?", ["Very enjoyable", "Good", "Mixed", "Difficult", "Did not attend"], true),
  multi("seerahBarriers", "Are there any challenges in Seerah lessons?", ["Language barrier", "Understanding the stories", "Connecting lessons to everyday life", "Staying engaged", "No challenges"]),
  text("seerahSuggestions", "What would you like your child to gain from Seerah, or what could we improve?"),
  text("lifeSkillsTopics", "Which life skills topics would you or your child like us to cover?"),
  multi("favourites", "Which parts of Gen-Mumin does your child enjoy most?", ["Arabic", "Seerah", "Life skills", "Sunnah tasks", "Qabila activities", "Talking with other children", "Pictures / videos", "Class discussions"]),
  text("childInterests", "What interests or excites your child outside lessons?"),
  text("sunnahFeedback", "Which Sunnah tasks have helped? Are there habits or tracker improvements you would like us to focus on?"),
  text("keepImprove", "What should we keep doing, and what is one thing we could improve?"),
  choice("teachingLanguage", "Which teaching language works best for your child?", ["English", "Urdu", "English and Urdu", "Arabic", "No preference"]),
 ] },
 { title: "Community & family support", description: "Help us make every family feel welcome and connected.", questions: [
  choice("belonging", "Do you and your child feel part of your Qabila / Gen-Mumin community?", ["Very connected", "Somewhat connected", "Disconnected or left out", "Not sure yet"], true),
  text("friendships", "Which other Gen-Mumin children has your child interacted with outside lessons? First names are enough."),
  text("positiveInteraction", "Share a positive community interaction: helping, getting to know, encouraging or celebrating another family or child."),
  text("connectionIdea", "What is one thing that would help your family feel more connected?"),
  choice("parentProgramme", "Would you like a parent programme about children's identity, doubts and questions?", ["Yes", "Maybe", "No"]),
  text("parentProgrammeReason", "Please briefly explain your interest or concerns about a parent-support programme."),
  choice("communityEvents", "Would your family be able to join online community events where children can get to know one another and build bonds of sisterhood and brotherhood?", ["Yes", "Maybe", "Not at the moment"], true),
  { ...text("eventAvailability", "Which days and times would suit your family for online community events? Please include your time zone."), required: true },
  text("supportNeeds", "Is there anything else we should know to support your child's learning? Share only what you are comfortable sharing."),
  choice("contactRequest", "Would you like management to contact you?", ["Yes", "Only if needed", "No"], true),
  choice("childChat", "May we arrange a 5-6 minute chat with your child to hear their feedback?", ["Yes", "No"]),
  { ...text("chatTime", "What day and time would suit you? Please include your time zone."), when: ["childChat", "Yes"] as [string, string], required: true },
 ] },
];
// Match the required fields in the original questionnaire; the unstarred Arabic
// progress questions, teacher feedback and child-chat consent stay optional.
const OPTIONAL_QUESTIONS = new Set(["newWords", "introduceSelf", "dailyRoutine", "classDuration", "teachingFeedback", "childChat"]);
for (const section of MONTHLY_SECTIONS) for (const q of section.questions) q.required = !OPTIONAL_QUESTIONS.has(q.id);
export const MONTHLY_QUESTIONS: Question[] = MONTHLY_SECTIONS.flatMap(s => s.questions);
export function visibleQuestion(q: Question, answers: Answers) {
 if (q.id === "eventAvailability" && !["Yes", "Maybe"].includes(String(answers.communityEvents))) return false;
 if (q.when && answers[q.when[0]] !== q.when[1]) return false;
 if (MONTHLY_SECTIONS[0].questions.includes(q) && q.id !== "arabicParticipation" && answers.arabicParticipation !== "Yes") return false;
 if (q.id === "seerahBarriers" && answers.seerahExperience === "Did not attend") return false;
 return true;
}
export function feedbackMonth(now = new Date()) {
 const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).formatToParts(now);
 return parts.find(p => p.type === "year")!.value + "-" + parts.find(p => p.type === "month")!.value;
}
export function validMonth(value: string, now = new Date()) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(value) && value <= feedbackMonth(now); }
export function validateAnswers(input: unknown): Answers {
 if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Please complete the feedback form.");
 const raw = input as Answers, clean: Answers = {};
 for (const q of MONTHLY_QUESTIONS) {
  if (!visibleQuestion(q, raw)) continue;
  const value = raw[q.id];
  if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) { if (q.required) throw new Error("Please answer: " + q.label); continue; }
  if (q.kind === "multi") {
   if (!Array.isArray(value) || value.length > (q.options?.length ?? 0) || value.some(v => !q.options?.includes(v))) throw new Error("Invalid answer: " + q.label);
   const unique = [...new Set(value)];
   if (unique.length > 1 && unique.some(v => ["No difficulties", "No challenges", "Not applicable"].includes(v))) throw new Error("Choose either none / not applicable or the relevant options.");
   clean[q.id] = unique;
  } else {
   if (typeof value !== "string" || value.length > 2500) throw new Error("Please shorten your answer: " + q.label);
   if (q.required && !value.trim()) throw new Error("Please answer: " + q.label);
   if (q.kind === "choice" && !q.options?.includes(value)) throw new Error("Invalid choice: " + q.label);
   if (q.kind === "number" && (!/^\d{1,5}$/.test(value) || Number(value) > 10000)) throw new Error("Enter a whole number from 0 to 10,000, or leave it blank.");
   clean[q.id] = value.trim();
  }
 }
 return clean;
}
export function answerText(value: unknown) { return Array.isArray(value) ? value.join("; ") : typeof value === "string" ? value : ""; }
export function csvCell(value: unknown) { let s = answerText(value); if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
