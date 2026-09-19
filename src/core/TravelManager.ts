import type { CalendarEvent, UserPreferences } from './types';

/**
 * TravelManager — Generates travel events automatically for in-person lessons/exams.
 */
export class TravelManager {
  static generateTravelEvents(events: CalendarEvent[], prefs: UserPreferences): CalendarEvent[] {
    const commuteTime = prefs.defaultCommuteTimeMinutes || 45;
    const isProductive = prefs.isCommuteProductive || false;
    
    // Filter only in-person events
    const inPersonEvents = events.filter(e => 
      (e.type === 'lesson' || e.type === 'exam') && e.location?.type === 'in_person'
    );
    
    // Sort by start time
    inPersonEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    const travelEvents: CalendarEvent[] = [];

    for (let i = 0; i < inPersonEvents.length; i++) {
      const current = inPersonEvents[i];
      const prev = i > 0 ? inPersonEvents[i - 1] : null;
      const next = i < inPersonEvents.length - 1 ? inPersonEvents[i + 1] : null;
      
      const currentStart = new Date(current.startTime);
      const currentEnd = new Date(current.endTime);
      
      // Check if we need travel BEFORE current
      let needsTravelBefore = true;
      if (prev && current.travelInStartOffset === undefined) {
        const prevEnd = new Date(prev.endTime);
        const gapMinutes = (currentStart.getTime() - prevEnd.getTime()) / 60000;
        // If they are on the same day and gap is small (less than time to go and come back), no travel before
        if (currentStart.toDateString() === prevEnd.toDateString() && gapMinutes < commuteTime * 2) {
          needsTravelBefore = false;
        }
      }
      
      if (needsTravelBefore) {
        const inStartOffset = current.travelInStartOffset ?? commuteTime;
        const inEndOffset = current.travelInEndOffset ?? 0;
        
        const travelStart = new Date(currentStart.getTime() - inStartOffset * 60000);
        const travelEnd = new Date(currentStart.getTime() - inEndOffset * 60000);
        
        if (travelEnd.getTime() > travelStart.getTime()) {
          travelEvents.push({
            id: `travel-in-${current.id}`,
            title: `Viaggio (Andata)`,
            type: 'travel',
            startTime: travelStart.toISOString(),
            endTime: travelEnd.toISOString(),
            isDone: false,
            isTravelStudyTime: isProductive
          });
        }
      }
      
      // Check if we need travel AFTER current
      let needsTravelAfter = true;
      if (next && current.travelOutStartOffset === undefined) {
        const nextStart = new Date(next.startTime);
        const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / 60000;
        // If they are on the same day and gap is small, no travel after
        if (currentEnd.toDateString() === nextStart.toDateString() && gapMinutes < commuteTime * 2) {
          needsTravelAfter = false;
        }
      }
      
      if (needsTravelAfter) {
        const outStartOffset = current.travelOutStartOffset ?? 0;
        const outEndOffset = current.travelOutEndOffset ?? commuteTime;

        const travelStart = new Date(currentEnd.getTime() + outStartOffset * 60000);
        const travelEnd = new Date(currentEnd.getTime() + outEndOffset * 60000);
        
        if (travelEnd.getTime() > travelStart.getTime()) {
          travelEvents.push({
            id: `travel-out-${current.id}`,
            title: `Viaggio (Ritorno)`,
            type: 'travel',
            startTime: travelStart.toISOString(),
            endTime: travelEnd.toISOString(),
            isDone: false,
            isTravelStudyTime: isProductive
          });
        }
      }
    }
    
    return travelEvents;
  }
}
