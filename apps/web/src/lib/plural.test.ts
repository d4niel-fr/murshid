import { describe, expect, it } from 'vitest';
import { count, countAr } from './plural';
import { subjectName } from './subjects';

const Q = { one: 'سؤال واحد', two: 'سؤالان', few: 'أسئلة', many: 'سؤالاً', other: 'سؤال' };

describe('plurals', () => {
  it('counts in English', () => {
    expect(count(1, 'card')).toBe('1 card');
    expect(count(3, 'card')).toBe('3 cards');
  });
  it('uses the right Arabic form for each number', () => {
    expect(countAr(1, Q)).toBe('سؤال واحد');
    expect(countAr(2, Q)).toBe('سؤالان');
    expect(countAr(3, Q)).toBe('3 أسئلة');
    expect(countAr(10, Q)).toBe('10 أسئلة');
    expect(countAr(11, Q)).toBe('11 سؤالاً');
    expect(countAr(100, Q)).toBe('100 سؤال');
  });
});

describe('subject names', () => {
  it('translates class subjects for Arabic readers and leaves English alone', () => {
    expect(subjectName('English', 'ar')).toBe('اللغة الإنجليزية');
    expect(subjectName('Mathematics', 'ar')).toBe('الرياضيات');
    expect(subjectName('Arabic', 'ar')).toBe('اللغة العربية');
    expect(subjectName('Art', 'ar')).toBe('الفنون');
    expect(subjectName('Robotics club', 'ar')).toBe('Robotics club');
    expect(subjectName('English', 'en')).toBe('English');
  });
});
