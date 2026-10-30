import {
  Activity, Award, BookOpen, Building2, CalendarCheck, CalendarRange, ChartLine, Compass, FileText, FolderOpen, GraduationCap, House,
  Bookmark, Info, Layers, Link as LinkIcon, ListChecks, MessageCircle, Send, Settings, Shield, Sparkles, Target, Trophy, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  House, CalendarCheck, BookOpen, Activity, Target, Award, Users, Trophy, CalendarRange, Sparkles, ListChecks, Compass,
  FolderOpen, Send, GraduationCap, FileText, Link: LinkIcon, MessageCircle, Settings, ChartLine, Building2, Bookmark, Info, Layers, Shield, Wallet,
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

/**
 * Murshid's mark: an eight-point star (the outline of two squares, one turned 45°) with a solid centre.
 * "Murshid" means guide; the star is the guide you navigate by. Line-drawn, currentColor.
 */
export function MurshidStar({ className = '', strokeWidth = 1.7 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" aria-hidden>
      <path d="M12.00 1.80 L13.76 7.75 L19.21 4.79 L16.25 10.24 L22.20 12.00 L16.25 13.76 L19.21 19.21 L13.76 16.25 L12.00 22.20 L10.24 16.25 L4.79 19.21 L7.75 13.76 L1.80 12.00 L7.75 10.24 L4.79 4.79 L10.24 7.75Z" />
    </svg>
  );
}

/** App-icon version of the mark: a navy tile with a white star. `tone="light"` = white tile, navy star (for navy blocks). */
export function MurshidMark({ className = '', tone = 'brand' }: { className?: string; tone?: 'brand' | 'light' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[28%] ${tone === 'light' ? 'bg-white text-[var(--deep)]' : 'bg-[var(--deep)] text-white'} ${className}`}>
      <MurshidStar className="size-[66%]" strokeWidth={1.9} />
    </span>
  );
}

/** Star + tracked wordmark, as one unit. */
export function Wordmark({ className = '', tone = 'ink' }: { className?: string; tone?: 'ink' | 'light' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MurshidStar className={`size-[1.2em] ${tone === 'light' ? 'text-white' : 'text-[var(--deep)]'}`} strokeWidth={1.8} />
      <span className="text-[1em] font-medium uppercase leading-none tracking-[0.2em]">Murshid</span>
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
