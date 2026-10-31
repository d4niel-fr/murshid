import { describe, expect, it } from 'vitest';
import { FORM_HOSTS, validateAssignment, type Question } from './assignment-rules';

const q = (p: Partial<Question> = {}): Question => ({ id: 'q1', type: 'short', prompt: 'Who is the narrator?', options: [], required: true, ...p });
const base = { title: 'Reading check', format: 'task' as const, formUrl: '', questions: [] as Question[] };

describe('posting an assignment', () => {
  it('needs a title', () => {
    expect(validateAssignment({ ...base, title: ' a ' })).toHaveProperty('title');
    expect(validateAssignment(base)).toEqual({});
  });
  it('accepts form links only from Google and Microsoft', () => {
    expect(validateAssignment({ ...base, format: 'google_form', formUrl: 'https://docs.google.com/forms/d/e/abc/viewform' })).toEqual({});
    expect(validateAssignment({ ...base, format: 'google_form', formUrl: 'https://forms.gle/abc123' })).toEqual({});
    expect(validateAssignment({ ...base, format: 'microsoft_form', formUrl: 'https://forms.office.com/r/AbC123' })).toEqual({});
    expect(validateAssignment({ ...base, format: 'google_form', formUrl: 'https://evil.example.com/forms/abc' })).toHaveProperty('formUrl');
    expect(validateAssignment({ ...base, format: 'google_form', formUrl: 'http://docs.google.com/forms/x' })).toHaveProperty('formUrl');
    expect(validateAssignment({ ...base, format: 'microsoft_form', formUrl: 'https://docs.google.com/forms/x' })).toHaveProperty('formUrl');
    expect(FORM_HOSTS.microsoft.test('https://forms.office.com.evil.com/r/x')).toBe(false);
  });
  it('checks built-in form questions', () => {
    expect(validateAssignment({ ...base, format: 'form' })).toHaveProperty('questions');
    expect(validateAssignment({ ...base, format: 'form', questions: [q({ prompt: '' })] })).toHaveProperty('q0');
    expect(validateAssignment({ ...base, format: 'form', questions: [q(), q({ id: 'q2', type: 'choice', prompt: 'Tone?', options: ['Calm', ' '] })] })).toHaveProperty('q1');
    expect(validateAssignment({ ...base, format: 'form', questions: [q({ type: 'choice', options: ['Calm', 'Calm'] })] })).toHaveProperty('q0');
    expect(validateAssignment({ ...base, format: 'form', questions: [q(), q({ id: 'q2', type: 'choice', prompt: 'Tone?', options: ['Calm', 'Angry'] })] })).toEqual({});
  });
});
