/**
 * Single import point for grade-band config. The whole app imports bands from here.
 * Uses @murshid/grade-bands (Grade-bands team). If that package is ever unavailable,
 * switch this line to `export * from './bands-fallback';` (same names, structural subset).
 */
export {
  BANDS, BAND_IDS, bandForGrade, demoStudents, visibleNav, visibleWidgets, t, greetingKey,
} from '@murshid/grade-bands';
export type {
  BandId, BandConfig, WidgetId, FeatureId, NavItem, NavId, DemoStudent, DemoActivity, DemoSession, DemoSubject, Localized,
} from '@murshid/grade-bands';
