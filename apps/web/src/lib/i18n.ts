export type Locale = 'en' | 'ar';

const en = {
  'app.name': 'Murshid',
  'nav.home': 'Dashboard', 'nav.chat': 'Ask Murshid', 'nav.academics': 'Academics', 'nav.extracurriculars': 'Extracurriculars',
  'nav.goals': 'Goals', 'nav.planner': 'Planner', 'nav.opportunities': 'Opportunities', 'nav.profile': 'Profile & links',
  'nav.insights': 'Insights', 'nav.settings': 'Settings', 'nav.collapse': 'Collapse sidebar', 'nav.expand': 'Expand sidebar',
  'top.student': 'Demo student', 'top.language': 'العربية', 'top.theme': 'Toggle theme', 'top.search': 'Ask Murshid…',
  'dash.streak': 'day streak', 'dash.best': 'Best', 'dash.today': "Today's tasks", 'dash.todayDone': 'All done for today. Nice work.',
  'dash.progress': 'Progress', 'dash.academics': 'Academics', 'dash.extracurriculars': 'Extracurriculars', 'dash.goals': 'Goals',
  'dash.upcoming': 'Coming up', 'dash.academicsCard': 'Academics', 'dash.avg': 'Average', 'dash.ec': 'Extracurriculars',
  'dash.hours28': 'h in last 4 weeks', 'dash.ask': 'Ask Murshid', 'dash.askPh': 'Ask about your progress, tasks, or opportunities…',
  'dash.links': 'Resume & profiles', 'dash.opps': 'Opportunities for you', 'dash.apps': 'Applications', 'dash.badges': 'Badges',
  'dash.viewAll': 'View all', 'dash.add': 'Add task', 'dash.left': 'left', 'dash.match': 'match', 'dash.due': 'Due',
  'dash.highlights': 'This week', 'dash.goalsCard': 'Goals',
  'chat.title': 'Ask Murshid', 'chat.hello': 'What would you like to know?', 'chat.sub': 'Charts, tasks and opportunities from your own data.',
  'chat.send': 'Send', 'chat.mic': 'Voice input', 'chat.stop': 'Stop', 'chat.new': 'New chat', 'chat.disclaimer': 'Answers come from free AI models or Murshid\'s rules. Check important details.',
  'chat.s1': "How's my gym progress?", 'chat.s2': 'Show my hackathon progress', 'chat.s3': 'Compare my maths and physics', 'chat.s4': 'What should I do today?', 'chat.s5': 'Find opportunities for me',
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.connect': 'Connect', 'common.disconnect': 'Disconnect',
  'common.connected': 'Connected', 'common.open': 'Open', 'common.log': 'Log session', 'common.minutes': 'minutes', 'common.hours': 'hours',
  'common.edit': 'Edit', 'common.delete': 'Delete', 'common.done': 'Done', 'common.add': 'Add', 'common.apply': 'Start application', 'common.saved': 'Saved',
  'common.demo': 'Demo data', 'common.live': 'Live API',
  'range.4w': '4 weeks', 'range.12w': '12 weeks', 'range.term': 'Term', 'range.year': 'Year',
} as const;

export type MsgKey = keyof typeof en;

const ar: Record<MsgKey, string> = {
  'app.name': 'مرشد',
  'nav.home': 'لوحة التحكم', 'nav.chat': 'اسأل مرشد', 'nav.academics': 'الدراسة', 'nav.extracurriculars': 'الأنشطة',
  'nav.goals': 'الأهداف', 'nav.planner': 'المخطط', 'nav.opportunities': 'الفرص', 'nav.profile': 'الملف والروابط',
  'nav.insights': 'الرؤى', 'nav.settings': 'الإعدادات', 'nav.collapse': 'طي الشريط', 'nav.expand': 'توسيع الشريط',
  'top.student': 'طالب تجريبي', 'top.language': 'English', 'top.theme': 'تبديل المظهر', 'top.search': 'اسأل مرشد…',
  'dash.streak': 'يوماً متتالياً', 'dash.best': 'الأفضل', 'dash.today': 'مهام اليوم', 'dash.todayDone': 'أنجزت كل مهام اليوم. عمل رائع.',
  'dash.progress': 'التقدّم', 'dash.academics': 'الدراسة', 'dash.extracurriculars': 'الأنشطة', 'dash.goals': 'الأهداف',
  'dash.upcoming': 'القادم', 'dash.academicsCard': 'الدراسة', 'dash.avg': 'المعدل', 'dash.ec': 'الأنشطة',
  'dash.hours28': 'ساعة في آخر ٤ أسابيع', 'dash.ask': 'اسأل مرشد', 'dash.askPh': 'اسأل عن تقدمك أو مهامك أو الفرص…',
  'dash.links': 'السيرة والحسابات', 'dash.opps': 'فرص مناسبة لك', 'dash.apps': 'الطلبات', 'dash.badges': 'الشارات',
  'dash.viewAll': 'عرض الكل', 'dash.add': 'إضافة مهمة', 'dash.left': 'متبقية', 'dash.match': 'ملاءمة', 'dash.due': 'الموعد',
  'dash.highlights': 'هذا الأسبوع', 'dash.goalsCard': 'الأهداف',
  'chat.title': 'اسأل مرشد', 'chat.hello': 'ماذا تريد أن تعرف؟', 'chat.sub': 'رسوم ومهام وفرص من بياناتك.',
  'chat.send': 'إرسال', 'chat.mic': 'إدخال صوتي', 'chat.stop': 'إيقاف', 'chat.new': 'محادثة جديدة', 'chat.disclaimer': 'تأتي الإجابات من نماذج ذكاء اصطناعي مجانية أو من قواعد مرشد. تحقّق من التفاصيل المهمة.',
  'chat.s1': 'كيف تقدمي في الجيم؟', 'chat.s2': 'اعرض تقدمي في الهاكاثون', 'chat.s3': 'قارن الرياضيات والفيزياء', 'chat.s4': 'ما هي مهامي اليوم؟', 'chat.s5': 'ابحث لي عن فرص',
  'common.save': 'حفظ', 'common.cancel': 'إلغاء', 'common.close': 'إغلاق', 'common.connect': 'ربط', 'common.disconnect': 'فصل',
  'common.connected': 'مرتبط', 'common.open': 'فتح', 'common.log': 'تسجيل جلسة', 'common.minutes': 'دقائق', 'common.hours': 'ساعات',
  'common.edit': 'تعديل', 'common.delete': 'حذف', 'common.done': 'تم', 'common.add': 'إضافة', 'common.apply': 'بدء الطلب', 'common.saved': 'محفوظ',
  'common.demo': 'بيانات تجريبية', 'common.live': 'واجهة حية',
  'range.4w': '٤ أسابيع', 'range.12w': '١٢ أسبوعاً', 'range.term': 'الفصل', 'range.year': 'العام',
};

export const messages: Record<Locale, Record<MsgKey, string>> = { en, ar };

export function translate(locale: Locale, key: MsgKey): string {
  return messages[locale][key] ?? messages.en[key];
}

export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', opts).format(n);
}
