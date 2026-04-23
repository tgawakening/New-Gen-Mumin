export type ProgramSlug = "arabic" | "seerah" | "tajweed" | "life-lessons";

export type CurriculumKind = "stages" | "quarters";

export type ProgramCurriculumItem = {
  title: string;
  points: string[];
};

export type ProgramPageContent = {
  slug: ProgramSlug;
  route: `/programs/${ProgramSlug}`;
  pageTitle: string;
  breadcrumbLabel: string;
  trackLabel: string;
  headline: string;
  intro: string;
  methodsTitle: string;
  methods: programMethod[];
  parentInfoTitle: string;
  parentInfo: programMethod[];
  goalsTitle: string;
  goals: string[];
  curriculumTitle: string;
  curriculumKind: CurriculumKind;
  curriculumItems: ProgramCurriculumItem[];
};

export type programMethod = {
  title: string;
  icon: string;
};

export type ProgramPriceCard = {
  title: string;
  subtitle: string;
  originalPrice: string;
  discountedPrice: string;
  frequency: string;
  bullets: string[];
  href: `/programs/${ProgramSlug}`;
};

export type ProgramsListingContent = {
  title: string;
  subtitle: string;
  bundle: {
    badge: string;
    title: string;
    subtitle: string;
    originalPrice: string;
    discountedPrice: string;
    frequency: string;
    bullets: string[];
  };
  sectionTitle: string;
  cards: ProgramPriceCard[];
};

export const PROGRAM_PAGES: Record<ProgramSlug, ProgramPageContent> = {
  arabic: {
    slug: "arabic",
    route: "/programs/arabic",
    pageTitle: "Arabic Program",
    breadcrumbLabel: "Arabic Program",
    trackLabel: "PROGRAM #1 — ARABIC TRACK",
    headline: "Arabic for Understanding the Qur'an",
    intro:
      "A long-term Arabic program designed to help kids build a strong foundation in reading, writing, vocabulary, and basic grammar — all taught in a fun and interactive way.",
    methodsTitle: "Teaching Methods",
    methods: [
      {
        title: "Games & activities",
        icon: "/svgexport-29.svg",
      },
      {
        title: "Flashcards",
        icon: "/svgexport-21.svg",
      },
      {
        title: "Mini-stories",
        icon: "/svgexport-31.svg",
      },
      {
        title: "Writing sheets",
        icon: "/svgexport-32.svg",
      },
      {
        title: "Weekly homework sheets",
        icon: "/svgexport-33.svg",
      },
      {
        title: "End-of-term quizzes",
        icon: "/svgexport-23.svg",
      },
    ],
    parentInfoTitle: "Parent Information",
    parentInfo: [
      {
        title: "2 classes per week (60-90 mins)",
        icon: "/svgexport-21.svg",
      },
      {
        title: "All materials provided",
        icon: "/svgexport-32.svg",
      },
    ],
    goalsTitle: "Learning Goals",
    goals: [
      "Recognize & write Arabic letters confidently",
      "Read simple Arabic words & sentences",
      "Understand 300+ essential vocabulary words",
      "Learn basic grammar (nouns, verbs, simple sentences)",
      "Connect Arabic to the Qur'an",
    ],
    curriculumTitle: "Student Growth by Stages",
    curriculumKind: "stages",
    curriculumItems: [
      {
        title: "Stage 01",
        points: [
          "Book: 1 + 2 العربية بين يدي أولادنا",
          "Self, friends & family introduction, meetups, 16 dialogues",
          "Arabic letters, days' names, counting (1-10) & ordinal numbers",
          "147 vocabulary words, adjectives, pronouns & verbs",
          "4 short paragraphs & 4 Arabic nasheeds",
          "16 games, speaking, listening & writing practice",
        ],
      },
      {
        title: "Stage 02",
        points: [
          "Book: 3 + 4 العربية بين يدي أولادنا",
          "Colors, home & classroom, pets & birds, guest & travel, village, rain & market",
          "Third person, ages & weight, Umrah travel, months' names, counting (11-20)",
          "Questions, masculine & feminine forms",
          "200 words & 300 phrases, speaking, listening & writing practice",
          "16 dialogues, 16 paragraphs, 4 Arabic nasheeds, 12 games",
        ],
      },
      {
        title: "Stage 03",
        points: [
          "Book: 5 العربية بين يدي أولادنا",
          "Drinks & foods, diseases, wearing clothes, absentees",
          "15 Surahs of Quran & 15 Ahadees",
          "Verbal & nominal sentences",
          "100 words & 200 phrases, speaking, listening & writing practice",
          "8 dialogues, 8 paragraphs, 2 Arabic nasheeds, 6 games",
        ],
      },
      {
        title: "Stage 04",
        points: [
          "Book: 6 العربية بين يدي أولادنا",
          "Buildings & directions, cleaning, school & hospital, Ramadan",
          "20 Surahs of Quran, 25 Ahadees & a storybook",
          "Verbal & nominal sentences",
          "125 words & 250 phrases, speaking, listening & writing practice",
          "8 dialogues, 22 paragraphs, 2 Arabic nasheeds, 6 games",
        ],
      },
    ],
  },
  seerah: {
    slug: "seerah",
    route: "/programs/seerah",
    pageTitle: "Seerah Program",
    breadcrumbLabel: "Seerah Program",
    trackLabel: "PROGRAM #2 — SEERAH TRACK",
    headline: "Seerah Stories for Young Hearts",
    intro:
      "A storytelling-based Seerah journey that introduces children to the life of the Prophet ﷺ and the first generation of Muslims through interactive stories, crafts, maps, timelines, and role-play.",
    methodsTitle: "Interactive Elements",
    methods: [
      {
        title: "Coloring maps",
        icon: "/svgexport-25.svg",
      },
      {
        title: "Seerah timeline poster",
        icon: "/svgexport-10.svg",
      },
      {
        title: "Role-play storytelling",
        icon: "/svgexport-22.svg",
      },
      {
        title: "End-of-year Seerah Fair presentation",
        icon: "/svgexport-23.svg",
      },
    ],
    parentInfoTitle: "Parent Information",
    parentInfo: [
      {
        title: "Weekly stories + worksheets",
        icon: "/svgexport-12.svg",
      },
      {
        title: "Quizzes every 8 weeks",
        icon: "/svgexport-19.svg",
      },
    ],
    goalsTitle: "Learning Goals",
    goals: [
      "Understand the major events in the Prophet's life",
      "Learn the values of courage, patience, kindness, and honesty",
      "Know the 10 major battles",
      "Know the names and stories of 15+ companions",
      "Build love for the Prophet ﷺ",
    ],
    curriculumTitle: "Curriculum Breakdown",
    curriculumKind: "quarters",
    curriculumItems: [
      {
        title: "Quarter 1: Before Prophethood",
        points: [
          "Coming of Abraha",
          "Birth of Rasulullah ﷺ",
          "Halimah",
          "Rebuilding of the Ka'bah",
          "Early life lessons & character",
        ],
      },
      {
        title: "Quarter 2: Prophethood & Early Muslims",
        points: [
          "First revelation",
          "Early Da'wah",
          "Boycott",
          "Ta'if",
          "Lessons: resilience, truthfulness",
        ],
      },
      {
        title: "Quarter 3: Hijrah to Madinah",
        points: [
          "The cave",
          "Brotherhood in Madinah",
          "Major companions",
          "Masjid-building",
        ],
      },
      {
        title: "Quarter 4: Key Events & Final Days",
        points: ["Badr, Uhud, Khandaq", "Hudaybiyyah", "Fath Makkah", "Final sermon", "Lessons for modern life"],
      },
    ],
  },
  tajweed: {
    slug: "tajweed",
    route: "/programs/tajweed",
    pageTitle: "Qur'anic Tajweed Program",
    breadcrumbLabel: "Qur'anic Tajweed Program",
    trackLabel: "PROGRAM #3 — QUR'ANIC TAJWEED TRACK",
    headline: "Beautiful Recitation, One Step at a Time",
    intro:
      "A gentle, structured, kid-friendly introduction to Tajweed focused on improving pronunciation, confidence, and love of Qur'anic recitation.",
    methodsTitle: "Teaching Methods",
    methods: [
      {
        title: "Teacher demonstration",
        icon: "/svgexport-15.svg",
      },
      {
        title: "Pair recitations",
        icon: "/svgexport-16.svg",
      },
      {
        title: "Tajweed games",
        icon: "/svgexport-17.svg",
      },
      {
        title: "Weekly audio homework",
        icon: "/svgexport-18.svg",
      },
      {
        title: "Monthly progress reports",
        icon: "/svgexport-19.svg",
      },
    ],
    parentInfoTitle: "Parent Information",
    parentInfo: [
      {
        title: "1-2 surahs memorized per quarter",
        icon: "/svgexport-20.svg",
      },
      {
        title: "Weekly Tajweed practice sheet",
        icon: "/svgexport-21.svg",
      },
    ],
    goalsTitle: "Learning Goals",
    goals: [
      "Correct makharij (letter pronunciation)",
      "Learn rules of noon sakinah & meem sakinah",
      "Master basic madd rules",
      "Improve fluency & rhythm",
      "Memorize selected surahs",
      "Build consistent recitation habits",
    ],
    curriculumTitle: "Curriculum Breakdown",
    curriculumKind: "quarters",
    curriculumItems: [
      {
        title: "Quarter 1: Foundations",
        points: ["Makharij: throat, tongue, lips", "Harakat & basic reading correction", "Small surah memorization"],
      },
      {
        title: "Quarter 2: Tajweed Rules (Level 1)",
        points: ["Idgham", "Ikhfaa", "Izhar", "Qalqalah"],
      },
      {
        title: "Quarter 3: Tajweed Rules (Level 2)",
        points: ["Madd rules", "Stopping & starting rules", "Fluency practice"],
      },
      {
        title: "Quarter 4: Application",
        points: ["Weekly guided recitation", "Error correction", "Confidence-building recitation circles"],
      },
    ],
  },
  "life-lessons": {
    slug: "life-lessons",
    route: "/programs/life-lessons",
    pageTitle: "Life Lessons & Leadership Program",
    breadcrumbLabel: "Life Lessons & Leadership Program",
    trackLabel: "PROGRAM #4 — LIFE LESSONS & LEADERSHIP",
    headline: "Growing Leaders with Islamic Character",
    intro:
      "A unique Islamic leadership program teaching practical life skills, emotional intelligence, manners, teamwork, Islamic character, and real-world problem solving.",
    methodsTitle: "Activities",
    methods: [
      {
        title: "Journaling",
        icon: "/svgexport-24.svg",
      },
      {
        title: "Debates",
        icon: "/svgexport-25.svg",
      },
      {
        title: "Real-life scenario role-plays",
        icon: "/svgexport-15.svg",
      },
      {
        title: "Simple chores & responsibility tasks",
        icon: "/svgexport-33.svg",
      },
      {
        title: "Year-end leadership presentation",
        icon: "/svgexport-28.svg",
      },
    ],
    parentInfoTitle: "Parent Information",
    parentInfo: [
      {
        title: "Monthly feedback",
        icon: "/svgexport-22.svg",
      },
      {
        title: "Kids receive a Leadership Badge every quarter",
        icon: "/svgexport-23.svg",
      },
    ],
    goalsTitle: "Learning Goals",
    goals: [
      "Confidence in speaking & presenting",
      "Teamwork & collaboration",
      "Adab with parents, teachers, and community",
      "Emotional regulation",
      "Time management",
      "Goal-setting",
      "Islamic leadership principles",
    ],
    curriculumTitle: "Curriculum Breakdown",
    curriculumKind: "quarters",
    curriculumItems: [
      {
        title: "Quarter 1: Self-Leadership",
        points: ["Identity & purpose", "Akhlaaq basics", "Managing emotions", "Daily habits"],
      },
      {
        title: "Quarter 2: Communication",
        points: ["Speaking confidently", "Listening skills", "Conflict resolution", "Respectful disagreement"],
      },
      {
        title: "Quarter 3: Community Leadership",
        points: ["Helping others", "Team projects", "Classroom roles", "Service assignments"],
      },
      {
        title: "Quarter 4: World Leadership",
        points: ["Decision-making", "Vision & planning", "Final project: My Leadership Portfolio"],
      },
    ],
  },
};

export const PROGRAMS_LISTING_CONTENT: ProgramsListingContent = {
  title: "Gen-Mumins Programs",
  subtitle: "Shaping confident Muslim leaders of tomorrow",
  bundle: {
    badge: "Featured",
    title: "Gen Mu'min bundle",
    subtitle: "All four programmes in a bundle",
    originalPrice: "£150",
    discountedPrice: "£80",
    frequency: "/per month",
    bullets: [
      "6 classes per week",
      "Arabic Program (2 classes per week)",
      "Tajweed Program (2 classes per week)",
      "Seerah Program (1 class per week)",
      "Leadership Program (1 class per week)",
    ],
  },
  sectionTitle: "Skill-Focused Programs",
  cards: [
    {
      title: "Arabic Program",
      subtitle: "Understand the language of the Qur'an",
      originalPrice: "£50",
      discountedPrice: "£40",
      frequency: "/per month",
      bullets: ["2 Classes per week", "45 mins per class"],
      href: "/programs/arabic",
    },
    {
      title: "Qur'anic Tajweed Program",
      subtitle: "Recite the Qur'an with confidence",
      originalPrice: "£50",
      discountedPrice: "£40",
      frequency: "/per month",
      bullets: ["2 Classes per week", "45 mins per class"],
      href: "/programs/tajweed",
    },
    {
      title: "Seerah Program",
      subtitle: "Learn from the life of Prophet ﷺ",
      originalPrice: "£30",
      discountedPrice: "£25",
      frequency: "/per month",
      bullets: ["One class per week", "One hour per class"],
      href: "/programs/seerah",
    },
    {
      title: "Leadership Program",
      subtitle: "Building confident Muslim leaders",
      originalPrice: "£30",
      discountedPrice: "£25",
      frequency: "/per month",
      bullets: ["One class per week", "One hour per class"],
      href: "/programs/life-lessons",
    },
  ],
};

export function getProgramContent(slug: ProgramSlug): ProgramPageContent {
  return PROGRAM_PAGES[slug];
}
