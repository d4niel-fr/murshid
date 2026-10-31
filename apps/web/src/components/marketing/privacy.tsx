'use client';

import { useApp } from '@/components/providers/app-provider';
import { LongForm } from './long-form';

const Li = ({ children }: { children: React.ReactNode }) => <li className="flex gap-[0.75rem]"><span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-[var(--brand)]" /><span>{children}</span></li>;

export function PrivacyView() {
  const { tx } = useApp();
  const sections = [
    { id: 'summary', title: tx('In short', 'باختصار'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('Murshid uses a student’s own data to plan that student’s week. Not for ads, and not to train anyone’s models.', 'يستخدم مرشد بيانات الطالب لتخطيط أسبوعه فقط. لا للإعلانات ولا لتدريب نماذج أحد.')}</Li>
      <Li>{tx('Consent is recorded separately for each purpose and can be withdrawn.', 'تُسجّل الموافقة لكل غرض على حدة ويمكن سحبها.')}</Li>
      <Li>{tx('School data and family accounts are kept apart.', 'تبقى بيانات المدرسة وحسابات العائلات منفصلة.')}</Li>
      <Li>{tx('Nothing leaves Murshid without a person approving that exact item.', 'لا يغادر شيء مرشد دون موافقة شخص على ذلك العنصر بعينه.')}</Li>
      <Li>{tx('This website only keeps essential settings on your device. No tracking cookies.', 'يحتفظ هذا الموقع بالإعدادات الضرورية على جهازك فقط. لا ملفات تتبّع.')}</Li>
    </ul> },
    { id: 'uses', title: tx('What the data is used for', 'فيمَ تُستخدم البيانات'), body: <p>{tx('Timetables, tests, homework, grades, activities and goals are used to build the student’s plan, reminders and insights, and (for school accounts) to show the student’s own teachers who needs support. Each step the assistant takes reads only the data that step needs, capped in size, and never another student’s data.', 'تُستخدم الجداول والاختبارات والواجبات والدرجات والأنشطة والأهداف لبناء خطة الطالب وتذكيراته ورؤاه، و(لحسابات المدارس) لإظهار من يحتاج إلى دعم لمعلمي الطالب أنفسهم. وكل خطوة يتخذها المساعد تقرأ فقط ما تحتاجه من بيانات، بحجم محدود، ولا تقرأ بيانات طالب آخر أبداً.')}</p> },
    { id: 'consent', title: tx('Consent, purpose by purpose', 'الموافقة غرضاً بغرض'), body: <p>{tx('The core service, the school connector, guardian summaries, notifications and sharing with universities each have their own consent. Every consent is versioned, dated and can be withdrawn separately in Settings.', 'للخدمة الأساسية وموصل المدرسة وملخصات وليّ الأمر والإشعارات والمشاركة مع الجامعات موافقة مستقلة لكل منها. وكل موافقة مؤرخة وذات إصدار ويمكن سحبها بشكل منفصل من الإعدادات.')}</p> },
    { id: 'minors', title: tx('Students under 18', 'الطلاب دون 18 عاماً'), body: <p>{tx('A verified parent or guardian confirms consent for students under 18. What a guardian sees depends on age: for Grades 5–6 they can read chat transcripts; from Grade 7 up they get topic summaries and safety alerts, not transcripts.', 'يؤكد وليّ أمر موثّق الموافقة للطلاب دون 18. وما يراه وليّ الأمر يعتمد على العمر: في الصفين 5–6 يمكنه قراءة المحادثات؛ ومن الصف 7 فما فوق يحصل على ملخصات للمواضيع وتنبيهات أمان، دون نصوص المحادثات.')}</p> },
    { id: 'tenancy', title: tx('Schools and families stay apart', 'المدارس والعائلات منفصلة'), body: <p>{tx('Every student belongs to exactly one tenant: a school, or a family. A teacher only sees the classes they teach; a school admin only sees their own school; family accounts never appear to a school.', 'ينتمي كل طالب إلى مستأجر واحد: مدرسة أو عائلة. يرى المعلم الصفوف التي يدرّسها فقط، ويرى مسؤول المدرسة مدرسته فقط، ولا تظهر حسابات العائلات لأي مدرسة.')}</p> },
    { id: 'approval', title: tx('Nothing leaves without a yes', 'لا شيء يغادر دون موافقة'), body: <p>{tx('The assistant can change a student’s own planner, calendar and saved items. It never sends or posts anything outside Murshid on its own: a LinkedIn draft, for example, is blocked in code until the student approves that exact draft, and the approval expires.', 'يمكن للمساعد تغيير مخطط الطالب وتقويمه وعناصره المحفوظة. ولا يرسل أو ينشر أي شيء خارج مرشد من تلقاء نفسه: مسودة LinkedIn مثلاً محظورة برمجياً حتى يوافق الطالب على تلك المسودة بعينها، وتنتهي الموافقة.')}</p> },
    { id: 'audit', title: tx('Every change is logged', 'كل تغيير مسجّل'), body: <p>{tx('Every change made for a student, by a teacher, an admin or Murshid itself, is written to an audit log with who, what and when. School admins can read their school’s log.', 'كل تغيير يُجرى لطالب، من معلم أو مسؤول أو مرشد نفسه، يُكتب في سجل تدقيق مع من وماذا ومتى. ويمكن لمسؤولي المدرسة قراءة سجل مدرستهم.')}</p> },
    { id: 'cookies', title: tx('Cookies and storage on this device', 'ملفات الارتباط والتخزين على هذا الجهاز'), body: <>
      <p>{tx('This site uses one essential cookie, which remembers your language, theme, text size and mascot, and your browser’s local storage, which keeps your demo progress (notes, flashcards, focus sessions, saved pages) on this device. There are no advertising or analytics cookies, so there is nothing to opt out of.', 'يستخدم هذا الموقع ملف ارتباط ضرورياً واحداً يتذكر لغتك ومظهرك وحجم النص وتميمتك، والتخزين المحلي في متصفحك الذي يحفظ تقدّمك التجريبي (الملاحظات والبطاقات وجلسات التركيز والصفحات المحفوظة) على هذا الجهاز. لا توجد ملفات إعلانات أو تحليلات، فلا شيء لإلغاء الاشتراك فيه.')}</p>
      <p className="mt-[1rem]">{tx('To clear it all, use Settings → Your data → Reset, or clear this site’s data in your browser.', 'لمسح كل شيء، استخدم الإعدادات ← بياناتك ← إعادة الضبط، أو امسح بيانات هذا الموقع من متصفحك.')}</p>
    </> },
    { id: 'choices', title: tx('Your choices', 'خياراتك'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('Download everything Murshid holds about you from Settings → Your data.', 'نزّل كل ما يحتفظ به مرشد عنك من الإعدادات ← بياناتك.')}</Li>
      <Li>{tx('Withdraw any consent, switch off the study buddy, or cancel the Single plan at any time.', 'اسحب أي موافقة أو أوقف رفيق الدراسة أو ألغِ الخطة الفردية في أي وقت.')}</Li>
      <Li>{tx('Ask your school (for school accounts) or us (for family accounts) to correct or delete data.', 'اطلب من مدرستك (لحسابات المدارس) أو منا (لحسابات العائلات) تصحيح البيانات أو حذفها.')}</Li>
    </ul> },
    { id: 'demo', title: tx('About this demo', 'عن هذا العرض التجريبي'), body: <p>{tx('This is a demo build. Every student, teacher and school shown is fictional, the Microsoft 365 sign-in is simulated, and no payment is ever taken. A proposed Grade 11 pilot at a Dubai secondary school is subject to that school’s approval.', 'هذه نسخة تجريبية. كل الطلاب والمعلمين والمدارس المعروضين وهميون، وتسجيل الدخول عبر Microsoft 365 محاكى، ولا يُؤخذ أي دفع أبداً. وتجربة الصف 11 المقترحة في مدرسة ثانوية في دبي رهن بموافقة تلك المدرسة.')}</p> },
  ];
  return (
    <LongForm eyebrow={tx('Privacy and cookies', 'الخصوصية وملفات الارتباط')} lines={tx('Your data plans|your week', 'بياناتك تخطط|أسبوعك').split('|')}
      intro={tx('How Murshid uses student data, who can see what, and what this website keeps on your device. In plain words.', 'كيف يستخدم مرشد بيانات الطالب، ومن يرى ماذا، وما يحفظه هذا الموقع على جهازك. بكلمات بسيطة.')}
      updated={tx('Last updated 30 October 2026', 'آخر تحديث 30 أكتوبر 2026')} sections={sections} />
  );
}
