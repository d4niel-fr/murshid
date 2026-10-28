import type { Dict } from './en';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

// Arabic STUB: key UI strings only; anything missing falls back to English.
// TODO(i18n): professional translation + review by Arabic-speaking students.
export const ar: DeepPartial<Dict> = {
  appName: 'مرشد',
  tagline: 'لكل رياضي مدير. والآن لكل طالب أيضاً.',
  common: { continue: 'متابعة', back: 'رجوع', save: 'حفظ', saved: 'تم الحفظ', cancel: 'إلغاء', loading: 'جارٍ التحميل…', error: 'حدث خطأ ما', retry: 'إعادة المحاولة', seeAll: 'عرض الكل', open: 'فتح', done: 'تم', none: 'لا يوجد شيء بعد', free: 'مجاني', mockBadge: 'بيانات تجريبية' },
  welcome: { title: 'مديرك الشخصي للمدرسة والأهداف والفرص', getStarted: 'ابدأ', dobLabel: 'تاريخ ميلادك' },
  signIn: { title: 'تسجيل الدخول', google: 'المتابعة باستخدام Google', microsoft: 'المتابعة باستخدام Microsoft', demo: 'استكشف بحساب تجريبي' },
  consent: { title: 'مطلوب موافقة ولي الأمر', send: 'إرسال طلب الموافقة', continueLimited: 'المتابعة الآن' },
  tabs: { home: 'الرئيسية', planner: 'المخطط', opportunities: 'الفرص', chat: 'المحادثة', more: 'المزيد' },
  home: { greeting: 'مرحباً {{name}}', thisWeek: 'هذا الأسبوع', tasks: 'المهام', deadlines: 'المواعيد النهائية', newOpps: 'فرص جديدة لك', goalProgress: 'تقدم الأهداف' },
  goals: { title: 'الأهداف', milestones: 'المراحل' },
  planner: { title: 'المخطط', today: 'اليوم' },
  classes: { title: 'الصفوف والمواد', upload: 'رفع' },
  opportunities: { title: 'الفرص', save: 'حفظ', saved: 'محفوظ' },
  applications: { title: 'الطلبات' },
  cv: { title: 'السيرة الذاتية', generate: 'إنشاء السيرة الذاتية', achievements: 'الإنجازات' },
  connections: { title: 'الحسابات المرتبطة', connect: 'ربط', disconnect: 'إلغاء الربط', uae_pass: 'الهوية الرقمية UAE PASS' },
  notifications: { title: 'الإشعارات' },
  privacy: { title: 'الخصوصية والبيانات', export: 'تصدير بياناتي', delete: 'حذف حسابي' },
  chat: { title: 'وكيل مرشد', coming: 'وكيل مرشد قادم قريباً' },
  more: { title: 'المزيد', language: 'اللغة', appearance: 'المظهر', signOut: 'تسجيل الخروج' },
};
