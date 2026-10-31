import { describe, it, expect } from 'vitest';
import { PriorityEngine } from './PriorityEngine';
import type { Task, UserPreferences, Course, CalendarEvent } from './types';

describe('PriorityEngine task sorting', () => {
  const dummyPrefs: UserPreferences = {
    dailyStudyHours: {},
    daysBeforeExamToIncreasePriority: 14,
    defaultCommuteTimeMinutes: 45,
    isCommuteProductive: false,
    ankiAverageTimeSeconds: 15,
    taskSortMode: 'oldest'
  };

  const courseMap = new Map<string, Course>();
  const events: CalendarEvent[] = [];

  it('orders tasks by lesson date / time when lessonDate/lessonTimeSlot is set', () => {
    const taskNewerLesson: Task = {
      id: 'task-1',
      title: 'Sistemare appunti: Lezione 2 (10/10/2026 11:00 - 13:00)',
      courseId: 'course-1',
      lessonDate: '10/10/2026',
      lessonTimeSlot: '11:00 - 13:00',
      status: 'todo',
      priorityScore: 50,
      estimatedDuration: 45,
      createdAt: '2026-10-31T10:00:00.000Z', // created at same time during ICS import
      dependencies: [],
      postponedCount: 0
    };

    const taskOlderLesson: Task = {
      id: 'task-2',
      title: 'Sistemare appunti: Lezione 1 (01/10/2026 09:00 - 11:00)',
      courseId: 'course-1',
      lessonDate: '01/10/2026',
      lessonTimeSlot: '09:00 - 11:00',
      status: 'todo',
      priorityScore: 50,
      estimatedDuration: 45,
      createdAt: '2026-10-31T10:00:00.000Z',
      dependencies: [],
      postponedCount: 0
    };

    const sorted = PriorityEngine.sortTasks(
      [taskNewerLesson, taskOlderLesson],
      courseMap,
      events,
      { ...dummyPrefs, taskSortMode: 'oldest' },
      []
    );

    expect(sorted[0].id).toBe('task-2');
    expect(sorted[1].id).toBe('task-1');
  });

  it('orders generic tasks by createdAt if no lesson date is present', () => {
    const taskNewer: Task = {
      id: 'task-newer',
      title: 'Compito generico recente',
      status: 'todo',
      priorityScore: 50,
      estimatedDuration: 30,
      createdAt: '2026-10-31T12:00:00.000Z',
      dependencies: [],
      postponedCount: 0
    };

    const taskOlder: Task = {
      id: 'task-older',
      title: 'Compito generico vecchio',
      status: 'todo',
      priorityScore: 50,
      estimatedDuration: 30,
      createdAt: '2026-10-20T12:00:00.000Z',
      dependencies: [],
      postponedCount: 0
    };

    const sorted = PriorityEngine.sortTasks(
      [taskNewer, taskOlder],
      courseMap,
      events,
      { ...dummyPrefs, taskSortMode: 'oldest' },
      []
    );

    expect(sorted[0].id).toBe('task-older');
    expect(sorted[1].id).toBe('task-newer');
  });
});
