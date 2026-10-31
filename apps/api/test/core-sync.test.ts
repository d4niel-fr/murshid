import { describe, expect, it } from 'vitest';
import * as core from '@murshid/core';
import * as domain from '../src/domain';

// The API keeps zod v4 object schemas (OpenAPI generation) but must agree with @murshid/core.
type Assert<T extends true> = T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type Checks = [
  Assert<Same<domain.Task['kind'], core.TaskKind>>,
  Assert<Same<domain.Task['status'], core.TaskStatus>>,
  Assert<Same<domain.Opportunity['type'], core.OpportunityType>>,
  Assert<Same<domain.Application['status'], core.ApplicationStatus>>,
  Assert<Same<domain.Student['curriculum'], core.Curriculum>>,
  Assert<Same<domain.Goal['category'], core.GoalCategory>>,
  Assert<Same<domain.Achievement['category'], core.AchievementCategory>>,
];

describe('api domain ↔ @murshid/core', () => {
  it('uses the core enum values', () => {
    expect(domain.OpportunityType.options).toEqual([...core.OPPORTUNITY_TYPES]);
    expect(domain.Curriculum.options).toEqual([...core.CURRICULA]);
    expect(domain.TaskStatus.options).toEqual([...core.TASK_STATUSES]);
    expect(domain.ApplicationStatus.options).toEqual([...core.APPLICATION_STATUSES]);
  });
  it('core exposes display labels for raw enum values', () => {
    expect(core.enumLabel('emirate', 'abu_dhabi')).toBe('Abu Dhabi');
    expect(core.enumLabel('opportunityType', 'summer_program')).toBe('Summer programme');
  });
});
