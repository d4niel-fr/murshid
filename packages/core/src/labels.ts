// Human display labels (English + Arabic) for every enum in enums.ts, so no UI ever shows a raw
// value such as "abu_dhabi" or "summer_program". Pure data; safe to import anywhere.
import {
  ACHIEVEMENT_CATEGORIES, AI_USE_LEVELS, APPLICATION_STATUSES, CONNECTION_STATUSES, CONSENT_STATUSES, CURRICULA, CV_TARGETS,
  DATA_SOURCES, EMIRATES, GOAL_CATEGORIES, GOAL_STATUSES, LMS_PROVIDERS, MATERIAL_KINDS, NOTIFICATION_CHANNELS,
  OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES, TASK_KINDS, TASK_STATUSES,
} from "./enums.js";
import { ACTIVITY_KINDS, ASSESSMENT_KINDS, PROGRESS_RANGES } from "./v1.js";

export type Lang = "en" | "ar";
export interface Label { en: string; ar: string }
type LabelMap<T extends readonly string[]> = Record<T[number], Label>;

const l = (en: string, ar: string): Label => ({ en, ar });

export const EMIRATE_LABELS: LabelMap<typeof EMIRATES> = {
  abu_dhabi: l("Abu Dhabi", "أبوظبي"),
  dubai: l("Dubai", "دبي"),
  sharjah: l("Sharjah", "الشارقة"),
  ajman: l("Ajman", "عجمان"),
  umm_al_quwain: l("Umm Al Quwain", "أم القيوين"),
  ras_al_khaimah: l("Ras Al Khaimah", "رأس الخيمة"),
  fujairah: l("Fujairah", "الفجيرة"),
};

export const OPPORTUNITY_TYPE_LABELS: LabelMap<typeof OPPORTUNITY_TYPES> = {
  competition: l("Competition", "مسابقة"),
  internship: l("Internship", "تدريب"),
  scholarship: l("Scholarship", "منحة دراسية"),
  summer_program: l("Summer programme", "برنامج صيفي"),
  volunteering: l("Volunteering", "تطوع"),
  olympiad: l("Olympiad", "أولمبياد"),
  mun: l("Model UN", "نموذج الأمم المتحدة"),
  hackathon: l("Hackathon", "هاكاثون"),
  course: l("Course", "دورة"),
};

export const CURRICULUM_LABELS: LabelMap<typeof CURRICULA> = {
  british: l("British", "البريطاني"),
  indian_cbse: l("Indian (CBSE)", "الهندي (CBSE)"),
  indian_icse: l("Indian (ICSE)", "الهندي (ICSE)"),
  american: l("American", "الأمريكي"),
  ib: l("IB", "البكالوريا الدولية"),
  uae_moe: l("UAE MoE", "وزارة التربية الإماراتية"),
  other: l("Other", "أخرى"),
};

export const LMS_LABELS: LabelMap<typeof LMS_PROVIDERS> = {
  google_classroom: l("Google Classroom", "Google Classroom"),
  teams: l("Microsoft Teams", "Microsoft Teams"),
  phoenix: l("Phoenix", "Phoenix"),
  managebac: l("ManageBac", "ManageBac"),
  toddle: l("Toddle", "Toddle"),
  other: l("Other", "أخرى"),
};

export const DATA_SOURCE_LABELS: LabelMap<typeof DATA_SOURCES> = {
  google_classroom: l("Google Classroom", "Google Classroom"),
  google_calendar: l("Google Calendar", "تقويم Google"),
  teams: l("Microsoft Teams", "Microsoft Teams"),
  outlook: l("Outlook", "Outlook"),
  phoenix: l("Phoenix", "Phoenix"),
  managebac: l("ManageBac", "ManageBac"),
  toddle: l("Toddle", "Toddle"),
  manual: l("Added by you", "أضفته بنفسك"),
  other: l("Other", "أخرى"),
};

export const CONSENT_STATUS_LABELS: LabelMap<typeof CONSENT_STATUSES> = {
  pending: l("Pending", "قيد الانتظار"),
  granted: l("Granted", "تمت الموافقة"),
  revoked: l("Revoked", "تم السحب"),
};

export const GOAL_CATEGORY_LABELS: LabelMap<typeof GOAL_CATEGORIES> = {
  academic: l("Academic", "أكاديمي"),
  university: l("University", "الجامعة"),
  career: l("Career", "المهنة"),
  sport: l("Sport", "رياضة"),
  skill: l("Skill", "مهارة"),
  personal: l("Personal", "شخصي"),
};

export const GOAL_STATUS_LABELS: LabelMap<typeof GOAL_STATUSES> = {
  active: l("Active", "نشط"),
  done: l("Done", "مكتمل"),
  paused: l("Paused", "متوقف مؤقتًا"),
};

export const MATERIAL_KIND_LABELS: LabelMap<typeof MATERIAL_KINDS> = {
  note: l("Notes", "ملاحظات"),
  assignment: l("Assignment", "واجب"),
  announcement: l("Announcement", "إعلان"),
  exam: l("Exam", "امتحان"),
};

export const TASK_KIND_LABELS: LabelMap<typeof TASK_KINDS> = {
  study: l("Study", "مذاكرة"),
  assignment: l("Assignment", "واجب"),
  application: l("Application", "طلب تقديم"),
  activity: l("Activity", "نشاط"),
  habit: l("Habit", "عادة"),
};

export const TASK_STATUS_LABELS: LabelMap<typeof TASK_STATUSES> = {
  todo: l("To do", "للإنجاز"),
  doing: l("In progress", "قيد التنفيذ"),
  done: l("Done", "تم"),
  skipped: l("Skipped", "تم تخطيه"),
};

export const AI_USE_LEVEL_LABELS: LabelMap<typeof AI_USE_LEVELS> = {
  none: l("No AI", "بدون ذكاء اصطناعي"),
  support: l("AI-supported", "بمساعدة الذكاء الاصطناعي"),
  led: l("AI-led", "بقيادة الذكاء الاصطناعي"),
};

export const OPPORTUNITY_STATUS_LABELS: LabelMap<typeof OPPORTUNITY_STATUSES> = {
  open: l("Open", "مفتوح"),
  closed: l("Closed", "مغلق"),
  unknown: l("Check dates", "تحقق من المواعيد"),
};

export const APPLICATION_STATUS_LABELS: LabelMap<typeof APPLICATION_STATUSES> = {
  saved: l("Saved", "محفوظ"),
  preparing: l("Preparing", "قيد التحضير"),
  submitted: l("Submitted", "تم التقديم"),
  accepted: l("Accepted", "مقبول"),
  rejected: l("Not selected", "لم يتم الاختيار"),
};

export const ACHIEVEMENT_CATEGORY_LABELS: LabelMap<typeof ACHIEVEMENT_CATEGORIES> = {
  academic: l("Academic", "أكاديمي"),
  award: l("Award", "جائزة"),
  sport: l("Sport", "رياضة"),
  project: l("Project", "مشروع"),
  volunteering: l("Volunteering", "تطوع"),
  work: l("Work experience", "خبرة عملية"),
  certificate: l("Certificate", "شهادة"),
  leadership: l("Leadership", "قيادة"),
};

export const CV_TARGET_LABELS: LabelMap<typeof CV_TARGETS> = {
  general: l("General", "عام"),
  university: l("University", "الجامعة"),
  internship: l("Internship", "تدريب"),
};

export const NOTIFICATION_CHANNEL_LABELS: LabelMap<typeof NOTIFICATION_CHANNELS> = {
  push: l("Push", "إشعار"),
  email: l("Email", "بريد إلكتروني"),
  whatsapp: l("WhatsApp", "واتساب"),
  in_app: l("In app", "داخل التطبيق"),
};

export const CONNECTION_STATUS_LABELS: LabelMap<typeof CONNECTION_STATUSES> = {
  pending: l("Pending", "قيد الانتظار"),
  active: l("Connected", "متصل"),
  error: l("Needs attention", "يحتاج إلى مراجعة"),
  revoked: l("Disconnected", "غير متصل"),
};

export const ACTIVITY_KIND_LABELS: LabelMap<typeof ACTIVITY_KINDS> = {
  athletics: l("Athletics", "ألعاب القوى"),
  gym: l("Gym", "النادي الرياضي"),
  hackathon: l("Hackathons", "الهاكاثونات"),
  robotics: l("Robotics", "الروبوتات"),
  music: l("Music", "الموسيقى"),
  football: l("Football", "كرة القدم"),
  swimming: l("Swimming", "السباحة"),
};

export const ASSESSMENT_KIND_LABELS: LabelMap<typeof ASSESSMENT_KINDS> = {
  quiz: l("Quiz", "اختبار قصير"),
  test: l("Test", "اختبار"),
  assignment: l("Assignment", "واجب"),
  exam: l("Exam", "امتحان"),
  project: l("Project", "مشروع"),
};

export const PROGRESS_RANGE_LABELS: LabelMap<typeof PROGRESS_RANGES> = {
  "4w": l("Last 4 weeks", "آخر 4 أسابيع"),
  "12w": l("Last 12 weeks", "آخر 12 أسبوعًا"),
  term: l("This term", "هذا الفصل"),
  year: l("Past year", "العام الماضي"),
};

/** Every label map by enum name. */
export const ENUM_LABELS = {
  emirate: EMIRATE_LABELS,
  opportunityType: OPPORTUNITY_TYPE_LABELS,
  curriculum: CURRICULUM_LABELS,
  lms: LMS_LABELS,
  dataSource: DATA_SOURCE_LABELS,
  consentStatus: CONSENT_STATUS_LABELS,
  goalCategory: GOAL_CATEGORY_LABELS,
  goalStatus: GOAL_STATUS_LABELS,
  materialKind: MATERIAL_KIND_LABELS,
  taskKind: TASK_KIND_LABELS,
  taskStatus: TASK_STATUS_LABELS,
  aiUseLevel: AI_USE_LEVEL_LABELS,
  opportunityStatus: OPPORTUNITY_STATUS_LABELS,
  applicationStatus: APPLICATION_STATUS_LABELS,
  achievementCategory: ACHIEVEMENT_CATEGORY_LABELS,
  cvTarget: CV_TARGET_LABELS,
  notificationChannel: NOTIFICATION_CHANNEL_LABELS,
  connectionStatus: CONNECTION_STATUS_LABELS,
  activityKind: ACTIVITY_KIND_LABELS,
  assessmentKind: ASSESSMENT_KIND_LABELS,
  progressRange: PROGRESS_RANGE_LABELS,
} as const;
export type EnumName = keyof typeof ENUM_LABELS;

/** "summer_program" → "Summer program"; last-resort fallback for values without a label. */
export function humanizeEnum(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Display label for an enum value. Unknown values (e.g. a free-text emirate "Dubai" from older
 * rows, or a value added later) fall back to a humanized string, never the raw snake_case.
 */
export function enumLabel(name: EnumName, value: string | null | undefined, lang: Lang = "en"): string {
  if (value == null || value === "") return "";
  const map = ENUM_LABELS[name] as Record<string, Label>;
  const hit = map[value] ?? map[value.toLowerCase().replace(/[\s-]+/g, "_")];
  return hit ? hit[lang] : humanizeEnum(value);
}

/** [{ value, label }] for a select / filter chip row. */
export function enumOptions(name: EnumName, lang: Lang = "en"): { value: string; label: string }[] {
  return Object.entries(ENUM_LABELS[name] as Record<string, Label>).map(([value, lb]) => ({ value, label: lb[lang] }));
}
