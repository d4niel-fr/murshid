import assert from 'node:assert/strict';
import { test } from 'node:test';
import { curriculumLabel, emirateLabel, oppTypeLabel } from '../src/lib/labels.ts';

test('raw enum values get display labels', () => {
  assert.equal(emirateLabel('abu_dhabi'), 'Abu Dhabi');
  assert.equal(oppTypeLabel('summer_program'), 'Summer programme');
  assert.equal(curriculumLabel('indian_cbse'), 'Indian (CBSE)');
  assert.equal(emirateLabel('Dubai'), 'Dubai');
  assert.equal(oppTypeLabel('research_camp'), 'Research camp');
  assert.equal(emirateLabel(null), '');
});
