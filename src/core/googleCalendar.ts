import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import type { CalendarEvent } from './types';

export async function fetchGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    // Provider dedicato con lo scope del calendario richiesto solo on-demand
    const calendarProvider = new GoogleAuthProvider();
    calendarProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    calendarProvider.setCustomParameters({
      prompt: 'consent'
    });

    const result = await signInWithPopup(auth, calendarProvider);
    
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    if (!token) {
      throw new Error("Impossibile ottenere il token di accesso a Google.");
    }
    
    // Fetch events from now to 30 days in the future
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=250&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error("Errore durante il recupero degli eventi da Google Calendar");
    }
    
    const data = await response.json();
    
    // Map events to UniCalendar format
    const events: CalendarEvent[] = (data.items || []).map((gEvent: any) => {
      // Google events can be all-day (date) or specific time (dateTime)
      const startTime = gEvent.start?.dateTime || gEvent.start?.date;
      const endTime = gEvent.end?.dateTime || gEvent.end?.date;
      
      return {
        id: `gcal-${gEvent.id}`,
        title: gEvent.summary || 'Evento Google',
        startTime: startTime,
        endTime: endTime,
        type: 'other',
        sourceCalendarId: 'google-calendar',
      };
    });
    
    return events;
    
  } catch (error) {
    console.error("Error in fetchGoogleCalendarEvents:", error);
    throw error;
  }
}
