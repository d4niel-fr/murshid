import {
  Activity, Award, BookOpen, Building2, CalendarCheck, CalendarRange, ChartLine, Compass, FileText, FolderOpen, GraduationCap, House,
  Link as LinkIcon, ListChecks, MessageCircle, Send, Settings, Sparkles, Target, Trophy, Users, type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  House, CalendarCheck, BookOpen, Activity, Target, Award, Users, Trophy, CalendarRange, Sparkles, ListChecks, Compass,
  FolderOpen, Send, GraduationCap, FileText, Link: LinkIcon, MessageCircle, Settings, ChartLine, Building2,
};

/* Brand marks (lucide v1 dropped brand icons). Simple monochrome glyphs, currentColor. */
export const LinkedInIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.6 4.77 6v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4v-11Z"/></svg>
);
export const GitHubIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
);
export const InstagramIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>
);

export function MurshidMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[10px] bg-primary text-primary-foreground ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 18V7l8 6 8-6v11" />
      </svg>
    </span>
  );
}

/** The four-square Microsoft mark used on "Sign in with Microsoft" buttons. */
export function MicrosoftMark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
