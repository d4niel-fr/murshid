/** School subject names in the student's language (teachers name classes in English). */
const AR: [RegExp, string][] = [
  [/^english/i, 'اللغة الإنجليزية'], [/^arabic/i, 'اللغة العربية'], [/^french/i, 'اللغة الفرنسية'],
  [/^(math|maths|mathematics)\b/i, 'الرياضيات'], [/^physics/i, 'الفيزياء'], [/^chem/i, 'الكيمياء'], [/^bio/i, 'الأحياء'],
  [/^(computer|computing|cs\b|ict\b)/i, 'علوم الحاسوب'], [/^econ/i, 'الاقتصاد'], [/^business/i, 'إدارة الأعمال'],
  [/^islamic/i, 'التربية الإسلامية'], [/^(social|moral)/i, 'الدراسات الاجتماعية'], [/^history/i, 'التاريخ'],
  [/^geo/i, 'الجغرافيا'], [/^(pe\b|physical)/i, 'التربية البدنية'], [/^(art|design)\b/i, 'الفنون'],
];
export function subjectName(subject: string, locale: 'en' | 'ar'): string {
  if (locale !== 'ar') return subject;
  return AR.find(([re]) => re.test(subject.trim()))?.[1] ?? subject;
}
