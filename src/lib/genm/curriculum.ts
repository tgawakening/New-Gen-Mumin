export type GenMProgramSlug = "seerah" | "life-lessons" | "arabic" | "tajweed";

export type GenMTeacherProfile = {
  slug: string;
  name: string;
  title: string;
  credential: string;
  bio: string;
  dummyEmail: string;
  specialties: string[];
  programSlugs: GenMProgramSlug[];
};

export type GenMTermPlan = {
  id: string;
  title: string;
  window: string;
  level: string;
  highlights: string[];
  arabic: string[];
  tajweed: string[];
  seerah: string[];
  lifeSkills: string[];
};

export type GenMProgramContent = {
  slug: GenMProgramSlug;
  title: string;
  strapline: string;
  description: string;
  outcomes: string[];
  uploadIdeas: string[];
  keyMaterials: string[];
  weeklyFlow: string[];
  focusTerms: string[];
};

export const genMProgrammeSchedule = [
  "Monday: Arabic reading, vocabulary, conversations, plus Tajweed rules and practice circles.",
  "Tuesday: Arabic speaking, grammar, games, plus makharij and guided Qur'an recitation.",
  "Wednesday: Arabic speaking and writing, plus tilawat and tajweed fluency practice.",
  "Thursday: Seerah story, reflection, and an activity linked to the weekly theme.",
  "Friday: Life skills, leadership, debate, confidence building, and practical projects.",
];

export const genMCoreOutcomes = [
  "Speak and understand basic Arabic confidently.",
  "Recite Qur'an with proper Tajweed habits and fluency.",
  "Know the Seerah of the Prophet in a child-friendly sequence.",
  "Demonstrate leadership, teamwork, and confidence.",
  "Apply first-aid, gardening, problem-solving, and critical-thinking skills.",
];

export const genMPolicies = [
  "Parents stay actively involved throughout the programme and help create an Arabic-friendly home routine.",
  "Parent-teacher conferences are expected at the end of each term to review progress and next steps.",
  "Students should join classes 5 minutes early with camera on, a quiet study space, and all required books ready.",
  "Homework and LMS tasks should be completed within one week and uploaded before the deadline.",
  "Regular attendance is required. Repeated unexplained absences may trigger an academic review.",
  "Monthly fees should be paid before the 5th of each month. Late payment can restrict class and LMS access.",
  "Scholarship students who withdraw early become liable for the full course fee.",
];

export const genMTeachers: GenMTeacherProfile[] = [
  {
    slug: "abubakar-sadique",
    name: "Abubakar Sadique",
    title: "GenM Supervisor",
    credential: "CEO – Al Ummah Leaders Institute",
    bio: "Oversees Arabic, Islamic studies, and mentoring direction across the full two-year Gen-Mumins journey.",
    dummyEmail: "abubakar.sadique@genmumin-teachers.local",
    specialties: ["Mentoring", "Arabic supervision", "Islamic studies"],
    programSlugs: ["seerah", "arabic", "life-lessons", "tajweed"],
  },
  {
    slug: "mehran",
    name: "Ustadh Mehran",
    title: "Arabic & Islamic Content Specialist",
    credential: "Dars-e-Nizami Graduate",
    bio: "Supports Arabic language progression, Fiqh and Hadith context, and digital presentation of the learning material.",
    dummyEmail: "ustadh.mehran@genmumin-teachers.local",
    specialties: ["Arabic content", "Fiqh", "Hadith", "Web resources"],
    programSlugs: ["arabic", "seerah"],
  },
  {
    slug: "abubakar-saeed",
    name: "Ustadh Abubakar Saeed",
    title: "Tajweed Trainer",
    credential: "15 Years Teaching Experience",
    bio: "Leads Qur'anic accent, tajweed precision, and structured recitation routines for learners.",
    dummyEmail: "abubakar.saeed@genmumin-teachers.local",
    specialties: ["Tajweed", "Arabic language", "Recitation coaching"],
    programSlugs: ["tajweed", "arabic"],
  },
  {
    slug: "afira",
    name: "Ustaza Afira",
    title: "Arabic Level 1–2 Instructor",
    credential: "7 Years International Teaching Experience",
    bio: "Focuses on beginner Arabic grammar, speaking games, vocabulary growth, and lower-level confidence building.",
    dummyEmail: "ustaza.afira@genmumin-teachers.local",
    specialties: ["Arabic grammar", "Beginner Arabic", "Conversation practice"],
    programSlugs: ["arabic"],
  },
  {
    slug: "zainab",
    name: "Ustaza Zainab",
    title: "Tajweed Lead",
    credential: "Master's in Islamic Studies",
    bio: "Guides tajweed mastery, recitation quality, and long-term fluency development.",
    dummyEmail: "ustaza.zainab@genmumin-teachers.local",
    specialties: ["Tajweed rules", "Recitation fluency", "Islamic studies"],
    programSlugs: ["tajweed"],
  },
  {
    slug: "zeba",
    name: "Ustaza Zeba",
    title: "Seerah Lead",
    credential: "Child-friendly Seerah Instructor",
    bio: "Shapes the story-based Seerah path with crafts, reflection prompts, and leadership lessons from the Prophet's life.",
    dummyEmail: "ustaza.zeba@genmumin-teachers.local",
    specialties: ["Seerah", "Story-led learning", "Reflection activities"],
    programSlugs: ["seerah"],
  },
  {
    slug: "jaweria",
    name: "Dr. Jaweria Riaz",
    title: "First Aid Instructor",
    credential: "MBBS",
    bio: "Leads the practical first-aid and safety components inside the life skills track.",
    dummyEmail: "dr.jaweria@genmumin-teachers.local",
    specialties: ["First aid", "Health", "Safety routines"],
    programSlugs: ["life-lessons"],
  },
  {
    slug: "mussab",
    name: "Sir Mussab",
    title: "Gardening Instructor",
    credential: "Agriculture Officer (UAE)",
    bio: "Leads the gardening stream, plant growth tracking, and nature-based life skills projects.",
    dummyEmail: "sir.mussab@genmumin-teachers.local",
    specialties: ["Kitchen gardening", "Nature studies", "Project learning"],
    programSlugs: ["life-lessons"],
  },
];

export const genMTerms: GenMTermPlan[] = [
  {
    id: "term-1",
    title: "Term 1",
    window: "Months 1–6",
    level: "Beginner Level",
    highlights: [
      "Arabic alphabet mastery, short and long vowels, and 50 essential words.",
      "Makharij foundations, Surah Al-Fatihah, and the last 3 surahs.",
      "Seerah beginnings: birth, childhood, honesty, kindness, and bravery.",
      "First-aid introduction, safety routines, and how to call for help.",
    ],
    arabic: ["العربية بين يدي أولادنا 1–2", "Alphabet mastery", "8 dialogues", "10 speaking games"],
    tajweed: ["Introduction to Tajweed", "Makharij of 28 letters", "Surah Al-Fatihah + last 3 surahs"],
    seerah: ["Birth of the Prophet", "Childhood", "His honesty, kindness, and bravery", "Build the Ka'bah craft"],
    lifeSkills: ["Introduction to first aid", "Safety rules", "Emergency response basics"],
  },
  {
    id: "term-2",
    title: "Term 2",
    window: "Months 7–12",
    level: "Beginner Level 2",
    highlights: [
      "Home, travel, food, and nature vocabulary expansion with counting 1–20.",
      "Noon saakin, tanween, and qalqalah rules with 5 surahs for memorisation.",
      "Early Prophethood, first revelation, and the first Muslims.",
      "Kitchen gardening, seed planting, and soil preparation projects.",
    ],
    arabic: ["العربية بين يدي أولادنا 3–4", "Masculine/feminine", "16 dialogues", "16 reading paragraphs"],
    tajweed: ["Noon saakin and tanween", "Qalqalah", "5 surahs memorisation"],
    seerah: ["Early Prophethood", "First revelation", "Early Muslims", "Cave Hira model"],
    lifeSkills: ["Kitchen gardening", "Soil preparation", "Planting seeds and tracking growth"],
  },
  {
    id: "term-3",
    title: "Term 3",
    window: "Months 13–18",
    level: "Intermediate Level 1",
    highlights: [
      "Verbal and nominal sentences with health, food, and clothing vocabulary.",
      "Madd rules, stopping rules, and 10 surahs in memorisation.",
      "Migration to Madinah, battles, bravery, and leadership lessons.",
      "Computers, internet safety, logic games, and debate foundations.",
    ],
    arabic: ["العربية بين يدي أولادنا 5", "Paragraph writing", "Food, health, and clothing vocabulary"],
    tajweed: ["Madd rules", "Stopping rules", "10 surahs memorisation"],
    seerah: ["Migration to Madinah", "Battles", "Bravery and leadership lessons"],
    lifeSkills: ["Computers", "Internet safety", "Logic & strategy games", "How to debate"],
  },
  {
    id: "term-4",
    title: "Term 4",
    window: "Months 19–24",
    level: "Intermediate Level 2",
    highlights: [
      "Stories, paragraphs, 250 Arabic phrases, and student presentations.",
      "Complete tajweed rule set, tarteel, and final recitation testing.",
      "Final years in Madinah, farewell sermon, and leadership lessons.",
      "Web/app basics, self-esteem, public speaking, and group leadership projects.",
    ],
    arabic: ["العربية بين يدي أولادنا 6", "Stories and paragraphs", "250 phrases", "Presentations in Arabic"],
    tajweed: ["Complete rule set", "Fluency & tarteel", "Final recitation test"],
    seerah: ["Final years in Madinah", "Farewell sermon", "Seerah timeline final project"],
    lifeSkills: ["Web & app development basics", "Personal hygiene", "Self-esteem", "Public speaking", "Decision making"],
  },
];

export const genMProgrammes: GenMProgramContent[] = [
  {
    slug: "seerah",
    title: "The Prophet's Seerah",
    strapline: "Story, reflection, and leadership lessons from the Prophet's life.",
    description: "Children move through the Prophet's blessed life in a gentle sequence, with stories, crafts, maps, reflections, and behaviour goals linked to everyday life.",
    outcomes: [
      "Understand major Seerah milestones in a child-friendly sequence.",
      "Reflect on honesty, bravery, mercy, and leadership from each story.",
      "Build confidence through speaking, projects, and timeline activities.",
    ],
    uploadIdeas: [
      "Weekly story slide or video link",
      "Craft worksheet or reflection prompt",
      "Map/timeline activity",
      "Parent discussion question",
    ],
    keyMaterials: ["Seerah storybooks", "Ka'bah craft set", "Cave Hira model resources", "Timeline posters", "Approved children's videos"],
    weeklyFlow: ["Story warm-up", "Main Seerah event", "Hands-on activity", "Reflection and duas"],
    focusTerms: ["Birth and childhood", "Prophethood in Makkah", "Hijrah and Madinah", "Farewell sermon and final timeline"],
  },
  {
    slug: "life-lessons",
    title: "Life Lessons & Leadership",
    strapline: "Confidence, first aid, gardening, debate, and practical child leadership.",
    description: "The life skills stream helps children grow habits of responsibility, service, confidence, and problem-solving through real-life projects.",
    outcomes: [
      "Apply first-aid and safety basics appropriately.",
      "Track gardening or nature-based projects over time.",
      "Build debate, speech, self-esteem, and team-leading habits.",
    ],
    uploadIdeas: [
      "Project brief or challenge card",
      "Drive folder for worksheets or plant logs",
      "Badge challenge checklist",
      "Parent practice routine or extension task",
    ],
    keyMaterials: ["First-aid kit", "Training worksheets", "Soil and seed trays", "Plant growth notebook", "Logic game resources"],
    weeklyFlow: ["Demo or challenge", "Hands-on practice", "Reflection", "Home extension task"],
    focusTerms: ["First-aid and safety", "Kitchen gardening", "Computers and logic", "Public speaking and app basics"],
  },
  {
    slug: "arabic",
    title: "Arabic",
    strapline: "Structured Arabic growth through books, games, speaking, and writing.",
    description: "The Arabic track builds from alphabet mastery and word recognition to confident phrases, paragraphs, and simple presentations.",
    outcomes: [
      "Read and recognise Arabic accurately.",
      "Speak basic phrases and short dialogues with confidence.",
      "Write words, paragraphs, and simple story-based responses.",
    ],
    uploadIdeas: [
      "Vocabulary deck or flashcard sheet",
      "Dialogue practice audio/video",
      "Speaking game prompt",
      "Writing task or mini presentation brief",
    ],
    keyMaterials: ["العربية بين يدي أولادنا books 1–6", "Flashcards", "Alphabet posters", "Writing notebooks", "Mini whiteboards"],
    weeklyFlow: ["Warm-up game", "Review and repetition", "Main language target", "Speaking or writing task"],
    focusTerms: ["Alphabet and 50 core words", "Travel/home/food vocabulary", "Sentences and paragraphs", "Stories, phrases, and presentations"],
  },
  {
    slug: "tajweed",
    title: "Qur'anic Tajweed",
    strapline: "Makharij, fluency, recitation confidence, and proper Qur'an habits.",
    description: "The tajweed track takes learners from basic makharij and short surahs into a fuller rule set, tarteel, and confident recitation routines.",
    outcomes: [
      "Recite with clearer articulation and confidence.",
      "Apply core tajweed rules in guided recitation.",
      "Track surah memorisation and pronunciation progress.",
    ],
    uploadIdeas: [
      "Listening assignment or recitation target",
      "Makharij practice prompt",
      "Tajweed rule poster or worksheet",
      "Flipped listening/home practice link",
    ],
    keyMaterials: ["Qaida/pen Quran", "Madani Mushaf", "Tajweed posters", "Audio recitations", "Surah tracking sheets"],
    weeklyFlow: ["Rule review", "Teacher modelling", "Recitation circles", "Home listening practice"],
    focusTerms: ["Makharij foundations", "Noon saakin and qalqalah", "Madd and stopping rules", "Complete rule set and final recitation"],
  },
];

function normalizeProgramKey(value: string) {
  return value.toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

const programTitleMap = new Map(
  genMProgrammes.flatMap((programme) => [
    [normalizeProgramKey(programme.slug), programme],
    [normalizeProgramKey(programme.title), programme],
  ]),
);

export function getGenMProgrammeByTitle(title: string) {
  return programTitleMap.get(normalizeProgramKey(title)) ?? null;
}

export function getGenMTeachersForProgramme(title: string) {
  const programme = getGenMProgrammeByTitle(title);
  if (!programme) return [];
  return genMTeachers.filter((teacher) => teacher.programSlugs.includes(programme.slug));
}

