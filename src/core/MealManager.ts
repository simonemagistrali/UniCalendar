import type { CalendarEvent, UserPreferences } from './types';
import { v4 as uuidv4 } from 'uuid';

export class MealManager {
  /**
   * Generates ephemeral calendar events representing lunch breaks
   * based on the user's daily study hours configuration.
   */
  static generateMealEvents(prefs: UserPreferences, startDate: Date, daysToSchedule: number = 30): CalendarEvent[] {
    const mealEvents: CalendarEvent[] = [];
    if (!prefs.dailyStudyHours) return mealEvents;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysToSchedule; i++) {
      const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = current.getDay();
      const dayConfig = prefs.dailyStudyHours[dayOfWeek];

      if (dayConfig && dayConfig.enabled && dayConfig.lunchBreak && dayConfig.lunchBreak.enabled) {
        const [startH, startM] = dayConfig.lunchBreak.start.split(':').map(Number);
        const [endH, endM] = dayConfig.lunchBreak.end.split(':').map(Number);

        const mealStart = new Date(current);
        mealStart.setHours(startH, startM, 0, 0);

        const mealEnd = new Date(current);
        mealEnd.setHours(endH, endM, 0, 0);

        mealEvents.push({
          id: `meal-${current.toISOString().split('T')[0]}`, // Fixed ID per day to avoid duplicates
          title: 'Pausa Pranzo',
          type: 'meal',
          startTime: mealStart.toISOString(),
          endTime: mealEnd.toISOString(),
          isDone: false,
        });
      }
    }

    return mealEvents;
  }
}
