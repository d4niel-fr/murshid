'use client';

import { useApp } from '@/components/providers/app-provider';
import { Mascot } from '@/components/mascot/mascot';
import { Pill, Shot } from '@/components/marketing/chrome';
import { LongForm } from './long-form';

const Li = ({ children }: { children: React.ReactNode }) => <li className="flex gap-[0.75rem]"><span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-[var(--brand)]" /><span>{children}</span></li>;

export function FeaturesView() {
  const { tx } = useApp();
  const sections = [
    { id: 'plan', title: tx('A plan for the real week', 'خطة للأسبوع الحقيقي'), body: <>
      <p>{tx('A Grade 11 week has six subjects, homework from every teacher, tests, and often two sports. Murshid reads all of it: the timetable, the tests and deadlines, the training and fixtures. Ask in plain words (“plan my week around my mid-term and both sports”) and it writes study blocks and reminders straight into your planner, on the days that have room.', 'أسبوع الصف 11 فيه ست مواد وواجبات من كل معلم واختبارات وغالباً رياضتان. يقرأ مرشد كل ذلك: الجدول والاختبارات والمواعيد والتدريب والمباريات. اطلب بكلمات بسيطة («خطط أسبوعي حول اختبار منتصف الفصل ورياضتيّ») فيكتب فترات دراسة وتذكيرات في مخططك مباشرة، في الأيام التي فيها متسع.')}</p>
      <p className="mt-[1rem]">{tx('Under every reply, “How Murshid worked this out” lists the goal it understood, the steps it planned, the tools it used and exactly what it changed. Nothing is a black box.', 'تحت كل رد، يعرض «كيف توصّل مرشد إلى ذلك» الهدف الذي فهمه والخطوات التي خططها والأدوات التي استخدمها وما غيّره بالضبط. لا شيء غامض.')}</p>
      <Shot src="/shots/m-chat.jpg" alt={tx('Ask Murshid planning a student’s week', '«اسأل مرشد» يخطط أسبوع طالب')} className="mt-[1.5rem] aspect-[16/10]" focus="50% 30%" />
    </> },
    { id: 'flashcards', title: tx('Flashcards that remember for you', 'بطاقات تتذكر عنك'), body: <>
      <p>{tx('Murshid’s flashcards use spaced repetition. After you answer a card you rate it: Again, Hard, Good or Easy. A card you struggled with comes back in ten minutes; one you knew well waits a few days, then a week, then longer. Each interval grows by how easy the card has been for you, so your revision time goes to the cards you are about to forget.', 'تستخدم بطاقات مرشد التكرار المتباعد. بعد الإجابة تقيّم البطاقة: مجدداً أو صعبة أو جيدة أو سهلة. البطاقة الصعبة تعود بعد عشر دقائق، والتي تعرفها جيداً تنتظر أياماً ثم أسبوعاً ثم أطول. تكبر كل فترة بقدر سهولة البطاقة عليك، فيذهب وقت المراجعة إلى البطاقات التي أوشكت أن تنساها.')}</p>
      <ul className="mt-[1rem] space-y-[0.5rem]">
        <Li>{tx('Flip with the space bar, rate with 1 to 4: a full review runs from the keyboard.', 'اقلب بالمسافة وقيّم بالأرقام من 1 إلى 4: المراجعة كلها من لوحة المفاتيح.')}</Li>
        <Li>{tx('Paste a whole list as “front :: back” lines to make a deck in seconds.', 'الصق قائمة كاملة بسطور «أمام :: خلف» لتصنع مجموعة في ثوانٍ.')}</Li>
        <Li>{tx('Starter decks for physics, integration, market structures and poetry terms.', 'مجموعات جاهزة للفيزياء والتكامل وهياكل السوق ومصطلحات الشعر.')}</Li>
      </ul>
    </> },
    { id: 'notes', title: tx('Notes that turn into cards', 'ملاحظات تتحول إلى بطاقات'), body: <>
      <p>{tx('Write notes with headings, lists, checklists, quotes and tables. They save as you type, show an estimated reading time and a table of contents, and print cleanly for the night before an exam.', 'اكتب ملاحظات بعناوين وقوائم ومهام واقتباسات وجداول. تُحفظ أثناء الكتابة، وتعرض مدة القراءة وجدول المحتويات، وتُطبع بوضوح لليلة الامتحان.')}</p>
      <p className="mt-[1rem]">{tx('Any line written as “term :: meaning” becomes a flashcard with one click, so a summary and a revision deck are the same piece of work.', 'أي سطر بصيغة «مصطلح :: معنى» يصبح بطاقة بنقرة، فيصير الملخص ومجموعة المراجعة عملاً واحداً.')}</p>
    </> },
    { id: 'focus', title: tx('A focus timer that keeps score', 'مؤقت تركيز يحسب لك'), body: <>
      <p>{tx('Work in 25-minute blocks with 5-minute breaks, or a 50-minute deep session. Every block is logged against what you were working on, and a week chart shows when you actually study. The countdown shows in the browser tab, so you can keep it out of sight.', 'اعمل في فترات 25 دقيقة مع استراحات 5 دقائق، أو جلسة عميقة 50 دقيقة. تُسجّل كل فترة مع ما كنت تعمل عليه، ويُظهر رسم أسبوعي متى تدرس فعلاً. ويظهر العد التنازلي في تبويب المتصفح لتبقيه بعيداً عن نظرك.')}</p>
    </> },
    { id: 'quiz', title: tx('Quick quizzes from your decks', 'اختبارات سريعة من مجموعاتك'), body: <>
      <p>{tx('Turn any deck into a ten-question multiple-choice quiz. Wrong answers are marked due, so they come back first in your next review.', 'حوّل أي مجموعة إلى اختبار من عشرة أسئلة اختيار من متعدد. تُعلَّم الإجابات الخاطئة كمستحقة لتعود أولاً في مراجعتك القادمة.')}</p>
    </> },
    { id: 'topics', title: tx('Know what to revise first', 'اعرف ماذا تراجع أولاً'), body: <>
      <p>{tx('The topic tracker lists each subject’s topics from your syllabus. Rate each one from “not started” to “confident”, and the shaky ones rise to the top of your study page. One tap asks Murshid to build a revision plan around them.', 'يعرض متتبع المواضيع مواضيع كل مادة من منهجك. قيّم كلاً منها من «لم أبدأ» إلى «متقن»، فترتفع المواضيع الضعيفة إلى أعلى صفحة الدراسة. وبلمسة واحدة يبني لك مرشد خطة مراجعة حولها.')}</p>
    </> },
    { id: 'companion', title: tx('Meet Murshid, your companion', 'تعرّف على مرشد، رفيقك'), body: <>
      <div className="flex flex-col gap-[1.5rem] sm:flex-row sm:items-center">
        <span className="grid size-[9rem] shrink-0 place-items-center rounded-[2rem] bg-[var(--surface)] text-[var(--deep)]"><Mascot size={120} mood="happy" label="Murshid" /></span>
        <p>{tx('Turn on companion mode and Murshid, a small soft bot, answers beside the chat. It listens while you type, thinks while it checks your week, and can read replies aloud. Pick its shape, its eyes and its colours in Settings: it’s yours.', 'فعّل وضع الرفيق ليجيبك مرشد، روبوت صغير ناعم، بجانب المحادثة. ينصت أثناء كتابتك، ويفكر بينما يراجع أسبوعك، ويمكنه قراءة الردود بصوت عالٍ. اختر شكله وعينيه وألوانه من الإعدادات: إنه لك.')}</p>
      </div>
    </> },
    { id: 'everyone', title: tx('Built for every student', 'مصمم لكل طالب'), body: <>
      <ul className="space-y-[0.5rem]">
        <Li>{tx('Every screen in English and Arabic, right to left.', 'كل شاشة بالإنجليزية والعربية من اليمين إلى اليسار.')}</Li>
        <Li>{tx('Adjustable text size, a dark mode, and motion that respects your device settings.', 'حجم نص قابل للتعديل ووضع داكن وحركة تحترم إعدادات جهازك.')}</Li>
        <Li>{tx('Keyboard shortcuts throughout (press ? to see them) and a smart search for pages, notes and cards.', 'اختصارات لوحة المفاتيح في كل مكان (اضغط ? لعرضها) وبحث ذكي في الصفحات والملاحظات والبطاقات.')}</Li>
        <Li>{tx('Save anything for later, and pick up where you left off from “recently viewed”.', 'احفظ أي شيء لوقت لاحق، وتابع من حيث توقفت عبر «شوهد مؤخراً».')}</Li>
      </ul>
    </> },
  ];
  return (
    <LongForm eyebrow={tx('Study tools', 'أدوات الدراسة')} lines={tx('Study less,|remember more', 'ادرس أقل|وتذكّر أكثر').split('|')}
      intro={tx('Murshid plans the week, then gives students the tools to use it: flashcards with spaced repetition, notes, a focus timer, quizzes and a topic tracker.', 'يخطط مرشد الأسبوع، ثم يمنح الطالب أدوات استثماره: بطاقات بالتكرار المتباعد وملاحظات ومؤقت تركيز واختبارات ومتتبع مواضيع.')}
      sections={sections}
      after={<div className="mt-[1rem] flex flex-wrap gap-[0.75rem] border-t border-[var(--border)] pt-[2.5rem]"><Pill variant="solid" href="/app/study">{tx('Try the study tools', 'جرّب أدوات الدراسة')}</Pill><Pill variant="outline" href="/pricing">{tx('See plans', 'عرض الخطط')}</Pill></div>} />
  );
}
