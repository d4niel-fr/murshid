import { describe, expect, it } from 'vitest';
import { parseRoster } from './roster';

describe('pasting a class list', () => {
  it('reads comma, tab or semicolon rows, skips a header, and flags rows with no grade', () => {
    const r = parseRoster('Name, Email, Grade, Section\nLina Haddad, Lina@School.ae, 9, 9a\nYousef Ali\t\t9\t9A\nNo Grade, x@y.z\n\n');
    expect(r.rows).toEqual([
      { name: 'Lina Haddad', email: 'lina@school.ae', grade: 9, section: '9A' },
      { name: 'Yousef Ali', grade: 9, section: '9A' },
    ]);
    expect(r.bad).toEqual([4]);
  });
});
