/** Spoken names for the ink, sticky-note and highlighter colours (screen readers otherwise read out hex codes). */
const NAMES: Record<string, [string, string]> = {
  '#111827': ['Black', 'أسود'], '#0f2f63': ['Navy', 'كحلي'], '#2563c9': ['Blue', 'أزرق'], '#dc2626': ['Red', 'أحمر'],
  '#16a34a': ['Green', 'أخضر'], '#15803d': ['Green', 'أخضر'], '#7c3aed': ['Purple', 'بنفسجي'], '#ea580c': ['Orange', 'برتقالي'],
  '#c2410c': ['Orange', 'برتقالي'], '#fef08a': ['Yellow', 'أصفر'], '#fbcfe8': ['Pink', 'وردي'], '#bfdbfe': ['Light blue', 'أزرق فاتح'],
  '#bbf7d0': ['Light green', 'أخضر فاتح'], '#fed7aa': ['Peach', 'خوخي'], '#fde047': ['Yellow', 'أصفر'], '#86efac': ['Green', 'أخضر'],
  '#93c5fd': ['Blue', 'أزرق'], '#f9a8d4': ['Pink', 'وردي'], '#facc15': ['Yellow', 'أصفر'],
};
export function colourName(hex: string, locale: 'en' | 'ar'): string {
  const n = NAMES[hex.toLowerCase()];
  return n ? n[locale === 'ar' ? 1 : 0] : hex;
}
