'use client';

import { useApp } from '@/components/providers/app-provider';
import { Pill } from '@/components/marketing/chrome';
import { LongForm } from './long-form';

const Li = ({ children }: { children: React.ReactNode }) => <li className="flex gap-[0.75rem]"><span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-[var(--brand)]" /><span>{children}</span></li>;
const CONTACT = 'security@murshid.ae';

/** The trust page: what protects people's data, in plain words, and what is not covered. Keep it true to the code. */
export function SecurityView() {
  const { tx } = useApp();
  const sections = [
    { id: 'summary', title: tx('In short', 'باختصار'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('Everything travels encrypted over HTTPS, and browsers are told to never use plain HTTP with Murshid.', 'كل شيء ينتقل مشفّراً عبر HTTPS، ويُطلب من المتصفحات ألا تستخدم HTTP العادي مع مرشد أبداً.')}</Li>
      <Li>{tx('Every request checks who you are and what your role allows. The database adds row-level security on every table.', 'كل طلب يتحقق من هويتك ومما يسمح به دورك. وتضيف قاعدة البيانات أماناً على مستوى الصفوف في كل جدول.')}</Li>
      <Li>{tx('Limits on how fast anyone can send requests, and lockouts after repeated wrong codes.', 'حدود لسرعة إرسال الطلبات، وإيقاف مؤقت بعد تكرار الرموز الخاطئة.')}</Li>
      <Li>{tx('Uploaded files are checked: only allowed types, up to 3 MB, and the content must match the type.', 'تُفحص الملفات المرفوعة: أنواع مسموحة فقط، حتى 3 ميغابايت، ويجب أن يطابق المحتوى النوع.')}</Li>
      <Li>{tx('Keys with the least power needed: the key in your browser cannot read any table on its own.', 'مفاتيح بأقل صلاحية لازمة: المفتاح في متصفحك لا يستطيع قراءة أي جدول وحده.')}</Li>
      <Li>{tx('You can download everything we keep about you, or delete your account, from Settings.', 'يمكنك تنزيل كل ما نحتفظ به عنك أو حذف حسابك من الإعدادات.')}</Li>
    </ul> },
    { id: 'transit', title: tx('Encryption', 'التشفير'), body: <>
      <p>{tx('Every page, sign-in and request to Murshid uses HTTPS (TLS). The site sends a Strict-Transport-Security header, so a browser that has visited once will refuse an unencrypted connection, even if someone tries to trick it.', 'كل صفحة وتسجيل دخول وطلب إلى مرشد يستخدم HTTPS (TLS). ويرسل الموقع ترويسة Strict-Transport-Security، فيرفض المتصفح الذي زاره مرة أي اتصال غير مشفّر، حتى لو حاول أحد خداعه.')}</p>
      <p className="mt-[1rem]">{tx('The database and the file storage are run by our database provider, which encrypts stored data at rest.', 'تدير قاعدة البيانات وتخزين الملفات الجهةُ المزوّدة لقاعدة البيانات، وهي تشفّر البيانات المخزّنة.')}</p>
    </> },
    { id: 'access', title: tx('Who can see what', 'من يرى ماذا'), body: <>
      <p>{tx('A student sees their own work. A teacher sees only the classes they teach, a school admin only their own school, and a parent only the child they linked to, read only. These rules are checked on the server for every request, and automated tests try to break them: a teacher at one school asking for another school’s class, a student asking for someone else’s hand-in, a parent asking for a child who is not theirs.', 'يرى الطالب عمله فقط. ويرى المعلم الصفوف التي يدرّسها فقط، ومسؤول المدرسة مدرسته فقط، ووليّ الأمر الطفل الذي ارتبط به فقط، للقراءة. تُطبَّق هذه القواعد على الخادم في كل طلب، وتحاول اختبارات آلية كسرها: معلم في مدرسة يطلب صف مدرسة أخرى، وطالب يطلب تسليم غيره، ووليّ أمر يطلب طفلاً ليس طفله.')}</p>
      <p className="mt-[1rem]">{tx('In the database, row-level security is switched on for every table. Tables that only Murshid’s server uses cannot be read with the key that is in the browser at all.', 'في قاعدة البيانات، الأمان على مستوى الصفوف مفعّل لكل جدول. والجداول التي يستخدمها خادم مرشد وحده لا يمكن قراءتها بالمفتاح الموجود في المتصفح إطلاقاً.')}</p>
    </> },
    { id: 'signin', title: tx('Signing in', 'تسجيل الدخول'), body: <>
      <p>{tx('Sign-in (email, Google or Microsoft) is handled by our authentication provider, so passwords never reach Murshid’s servers. Every request carries a signed token that the server checks each time: its signature, that it has not expired, and that it was made for Murshid.', 'يتولى مزوّد المصادقة تسجيل الدخول (بالبريد أو Google أو Microsoft)، فلا تصل كلمات المرور إلى خوادم مرشد. ويحمل كل طلب رمزاً موقّعاً يتحقق منه الخادم في كل مرة: توقيعه، وأنه لم تنتهِ صلاحيته، وأنه صُنع لمرشد.')}</p>
      <p className="mt-[1rem]">{tx('Accounts are linked by a confirmed email address. Codes for joining a school or a class, or for a parent to link to a child, are random and can only be guessed a few times before the attempts are locked for a while.', 'تُربط الحسابات ببريد إلكتروني مؤكَّد. ورموز الانضمام إلى مدرسة أو صف، أو ربط وليّ الأمر بطفله، عشوائية ولا يمكن تخمينها إلا مرات قليلة قبل إيقاف المحاولات لفترة.')}</p>
    </> },
    { id: 'abuse', title: tx('Limits against abuse', 'حدود ضد إساءة الاستخدام'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('Each network and each signed-in person has a limit on how many requests they can send a minute, with tighter limits for codes, uploads, AI tools and payments.', 'لكل شبكة ولكل شخص مسجّل حدٌّ لعدد الطلبات في الدقيقة، مع حدود أضيق للرموز والرفع وأدوات الذكاء الاصطناعي والمدفوعات.')}</Li>
      <Li>{tx('Repeated wrong codes, passcodes or secrets lock further attempts for a while, and each lockout lasts longer than the last.', 'تكرار الرموز أو كلمات المرور أو الأسرار الخاطئة يوقف المحاولات لفترة، وكل إيقاف أطول من سابقه.')}</Li>
      <Li>{tx('Large floods of traffic are meant to be stopped before they reach Murshid, by our hosting provider’s firewall.', 'يُراد إيقاف موجات الطلبات الكبيرة قبل وصولها إلى مرشد، بجدار الحماية لدى مزوّد الاستضافة.')}</Li>
    </ul> },
    { id: 'files', title: tx('Files and links', 'الملفات والروابط'), body: <>
      <p>{tx('Hand-ins and attachments can be photos (JPG, PNG, WebP, GIF), PDFs, Office documents or text files, up to 3 MB each. The first bytes of every file must match the type it claims. Files are kept in private storage and opened through Murshid with long random links, and served so a browser shows or downloads them but never runs them as part of the site.', 'يمكن أن تكون التسليمات والمرفقات صوراً (JPG وPNG وWebP وGIF) أو ملفات PDF أو مستندات Office أو ملفات نصية، حتى 3 ميغابايت لكل منها. ويجب أن تطابق البايتات الأولى في كل ملف النوع الذي يدّعيه. تُحفظ الملفات في تخزين خاص وتُفتح عبر مرشد بروابط عشوائية طويلة، وتُقدَّم بحيث يعرضها المتصفح أو ينزّلها دون أن يشغّلها كجزء من الموقع.')}</p>
      <p className="mt-[1rem]">{tx('Links that teachers, students or the assistant add only open if they start with http or https, in a new tab. When Murshid fetches a calendar link for you, it refuses addresses inside private networks.', 'الروابط التي يضيفها المعلمون أو الطلاب أو المساعد لا تُفتح إلا إذا بدأت بـ http أو https، وفي تبويب جديد. وعندما يجلب مرشد رابط تقويم لك، يرفض العناوين داخل الشبكات الخاصة.')}</p>
    </> },
    { id: 'site', title: tx('This website', 'هذا الموقع'), body: <p>{tx('Pages load scripts, styles and images from Murshid itself (plus sign-in calls to our authentication provider) under a Content Security Policy. Murshid cannot be shown inside another site’s frame, which blocks click-jacking. There are no advertising or tracking scripts. The microphone (for dictation and reading practice) and the camera (for photo hand-ins) can only be used by Murshid’s own pages, and only when you allow it.', 'تحمّل الصفحات النصوص البرمجية والأنماط والصور من مرشد نفسه (إضافة إلى اتصالات تسجيل الدخول بمزوّد المصادقة) وفق سياسة أمان المحتوى. ولا يمكن عرض مرشد داخل إطار موقع آخر، ما يمنع خداع النقرات. لا توجد نصوص إعلانية أو تتبّع. ولا يستخدم الميكروفون (للإملاء والتدرّب على القراءة) والكاميرا (لصور التسليم) إلا صفحات مرشد نفسها، وفقط عندما تسمح بذلك.')}</p> },
    { id: 'keys', title: tx('Least-privilege keys', 'مفاتيح بأقل صلاحية'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('The key in your browser is a public key: on its own it can read no table. The server key stays on the server.', 'المفتاح في متصفحك مفتاح عام: لا يقرأ أي جدول وحده. ومفتاح الخادم يبقى على الخادم.')}</Li>
      <Li>{tx('Card payments happen on Stripe’s page: card numbers never reach Murshid.', 'تتم المدفوعات بالبطاقة على صفحة Stripe: لا تصل أرقام البطاقات إلى مرشد.')}</Li>
      <Li>{tx('Payment and notification messages from other services are checked with a signature or a secret before Murshid acts on them.', 'تُفحص رسائل الدفع والإشعارات الواردة من خدمات أخرى بتوقيع أو سرّ قبل أن يتصرّف مرشد بناءً عليها.')}</Li>
      <Li>{tx('The assistant’s tools work only on the signed-in student’s own data, and no keys or passwords are ever put in what it reads. When AI answers are switched on, the question and the parts of the plan needed to answer it are sent to the AI provider to write the reply.', 'تعمل أدوات المساعد على بيانات الطالب المسجّل وحده، ولا توضع أي مفاتيح أو كلمات مرور فيما يقرؤه. وعند تفعيل إجابات الذكاء الاصطناعي، يُرسل السؤال وأجزاء الخطة اللازمة للإجابة إلى مزوّد الذكاء الاصطناعي لكتابة الرد.')}</Li>
    </ul> },
    { id: 'region', title: tx('Where your data is kept', 'أين تُحفظ بياناتك'), body: <p>{tx('Student data and files are stored in the region where Murshid’s database runs, and schools are told which region that is before a pilot. Murshid does not copy them elsewhere for analytics or advertising.', 'تُحفظ بيانات الطلاب وملفاتهم في المنطقة التي تعمل فيها قاعدة بيانات مرشد، وتُبلَّغ المدارس بتلك المنطقة قبل أي تجربة. ولا ينسخها مرشد إلى مكان آخر للتحليلات أو الإعلانات.')}</p> },
    { id: 'rights', title: tx('Your data, your choice', 'بياناتك، قرارك'), body: <ul className="space-y-[0.5rem]">
      <Li>{tx('Download everything Murshid keeps about you as a file, from Settings.', 'نزّل كل ما يحتفظ به مرشد عنك في ملف، من الإعدادات.')}</Li>
      <Li>{tx('Delete your account and the data in it, from Settings. For school accounts, your school can also ask us to correct or delete data.', 'احذف حسابك والبيانات التي فيه، من الإعدادات. ولحسابات المدارس، يمكن لمدرستك أيضاً أن تطلب منا تصحيح البيانات أو حذفها.')}</Li>
      <Li>{tx('Every change made for a student, by a teacher, an admin or Murshid itself, is written to an audit log.', 'كل تغيير يُجرى لطالب، من معلم أو مسؤول أو مرشد نفسه، يُكتب في سجل تدقيق.')}</Li>
    </ul> },
    { id: 'limits', title: tx('What we do not promise', 'ما لا نعد به'), body: <>
      <p>{tx('No online service is perfectly secure, and we do not claim Murshid is. We reduce the risk with the measures above, review them as the product grows, and fix what we find.', 'لا توجد خدمة على الإنترنت آمنة تماماً، ولا ندّعي أن مرشد كذلك. نقلّل المخاطر بالإجراءات أعلاه، ونراجعها مع نمو المنتج، ونصلح ما نجده.')}</p>
      <p className="mt-[1rem]">{tx('Some protections depend on you and your school: a strong, unique password, keeping devices locked and up to date, and not sharing join codes outside the class. The public demo uses fictional students and a simplified sign-in, so never put real personal data into it.', 'بعض الحمايات تعتمد عليك وعلى مدرستك: كلمة مرور قوية وفريدة، وإبقاء الأجهزة مقفلة ومحدّثة، وعدم مشاركة رموز الانضمام خارج الصف. ويستخدم العرض التجريبي العام طلاباً وهميين وتسجيل دخول مبسّطاً، فلا تضع فيه بيانات شخصية حقيقية أبداً.')}</p>
    </> },
    { id: 'report', title: tx('Report a security problem', 'الإبلاغ عن مشكلة أمنية'), body: <>
      <p>{tx(`If you think you have found a security problem, please email ${CONTACT} with what you found and how to see it. Please do not look at, change or keep anyone else’s data, and give us a reasonable time to fix it before telling others. We will not take legal action against people who report in good faith and follow these rules.`, `إذا ظننت أنك وجدت مشكلة أمنية، فراسل ${CONTACT} بما وجدته وكيف يمكن رؤيته. نرجو ألا تطّلع على بيانات أي شخص آخر أو تغيّرها أو تحتفظ بها، وأن تمنحنا وقتاً معقولاً لإصلاحها قبل إخبار الآخرين. لن نتخذ إجراءً قانونياً ضد من يبلّغ بحسن نية ويتّبع هذه القواعد.`)}</p>
      <p className="mt-[1rem]">{tx('Our security.txt file, at /.well-known/security.txt, has the same contact.', 'ملف security.txt لدينا، على ‎/.well-known/security.txt، فيه جهة الاتصال نفسها.')}</p>
    </> },
  ];
  return (
    <LongForm eyebrow={tx('Security and privacy at Murshid', 'الأمان والخصوصية في مرشد')} lines={tx('How we keep|your data safe', 'كيف نحافظ|على بياناتك').split('|')}
      intro={tx('The protections that are actually in place, in plain words, what they do not cover, and how to report a problem.', 'الحمايات المطبّقة فعلاً، بكلمات بسيطة، وما لا تغطيه، وكيف تبلّغ عن مشكلة.')}
      updated={tx('Last updated 6 November 2026', 'آخر تحديث 6 نوفمبر 2026')} sections={sections}
      after={<div className="mt-[1rem] flex flex-wrap gap-[0.75rem] border-t border-[var(--border)] pt-[2.5rem]"><Pill variant="solid" href={`mailto:${CONTACT}`} arrow={false}>{tx('Email the security team', 'راسل فريق الأمان')}</Pill><Pill variant="outline" href="/privacy">{tx('Read the privacy page', 'اقرأ صفحة الخصوصية')}</Pill></div>} />
  );
}
