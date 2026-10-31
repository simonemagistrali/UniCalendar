import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { parseICS, parseCSV, fetchCalendarFromURL } from '../../../core/ICSParser';
import { TaskManager } from '../../../core/TaskManager';
import { findCourseForTitle } from '../../../core/courseNames';
import { getLessonTracks } from '../../../core/LessonProgressEngine';
import type { CalendarEvent, Course } from '../../../core/types';
import {
  Upload,
  Link,
  CheckCircle,
  AlertCircle,
  Clock,
  BookOpen,
  ArrowRight,
  Check,
  Edit2,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ImportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'curate_courses' | 'checkpoint' | 'result';

interface DetectedCourseCandidate {
  id: string; // Course ID (temp or existing)
  name: string;
  originalName: string;
  selected: boolean;
  eventCount: number;
  sampleTitles: string[];
  courseColor: string;
  existingCourseId?: string; // If matched to an already existing course
}

interface CourseCheckpointSetting {
  courseId: string;
  courseName: string;
  courseColor: string;
  hasTheory: boolean;
  hasExercise: boolean;
  theoryLessons: Array<{ id: string; index: number; title: string; dateIt: string; isPast: boolean }>;
  exerciseLessons: Array<{ id: string; index: number; title: string; dateIt: string; isPast: boolean }>;
  selectedTheoryUpToId: string | null; // eventId up to which theory is completed, or null
  selectedExerciseUpToId: string | null; // eventId up to which exercise is completed, or null
}

const COLORS = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f'];

export function ImportCalendarModal({ isOpen, onClose }: ImportCalendarModalProps) {
  const addEvents = useAppStore(s => s.addEvents);
  const addCourse = useAppStore(s => s.addCourse);
  const courses = useAppStore(s => s.courses);
  const setCourseCheckpoint = useAppStore(s => s.setCourseCheckpoint);

  const [step, setStep] = useState<Step>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // Raw parsed events
  const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);

  // Detected courses for curation step
  const [candidates, setCandidates] = useState<DetectedCourseCandidate[]>([]);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editingCandidateName, setEditingCandidateName] = useState('');

  // Historical calendar info
  const [earliestEventDate, setEarliestEventDate] = useState<Date | null>(null);
  const [isHistorical, setIsHistorical] = useState(false);

  // Checkpoint settings per course
  const [checkpointSettings, setCheckpointSettings] = useState<CourseCheckpointSetting[]>([]);

  // Final summary
  const [result, setResult] = useState<{
    eventsCount: number;
    coursesCount: number;
    checkpointsApplied: number;
  } | null>(null);

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const resetAll = () => {
    setStep('upload');
    setIsImporting(false);
    setUrl('');
    setError('');
    setRawEvents([]);
    setCandidates([]);
    setEditingCandidateId(null);
    setEditingCandidateName('');
    setEarliestEventDate(null);
    setIsHistorical(false);
    setCheckpointSettings([]);
    setResult(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // Called when raw events are parsed from file/URL
  const onEventsExtracted = (events: CalendarEvent[]) => {
    if (events.length === 0) {
      setError('Nessun evento valido trovato nel file.');
      setIsImporting(false);
      return;
    }

    // Determine earliest event date
    let earliest = Infinity;
    for (const e of events) {
      const t = new Date(e.startTime).getTime();
      if (!isNaN(t) && t < earliest) {
        earliest = t;
      }
    }

    const nowMs = Date.now();
    const isPastMoreThanAWeek = earliest !== Infinity && earliest < (nowMs - ONE_WEEK_MS);
    setEarliestEventDate(earliest !== Infinity ? new Date(earliest) : null);
    setIsHistorical(isPastMoreThanAWeek);

    // Auto-detect courses using TaskManager heuristic
    const detected = TaskManager.detectCoursesFromEvents(events, courses);

    // Build rich candidate list
    const candidateList: DetectedCourseCandidate[] = [];

    // 1. Group events by detected courses or existing courses
    const allCoursesRef = [...courses, ...detected];
    const eventCountsByCourse = new Map<string, { count: number; sampleTitles: string[] }>();

    for (const e of events) {
      const match = findCourseForTitle(e.title, allCoursesRef);
      if (match) {
        const item = eventCountsByCourse.get(match.id) || { count: 0, sampleTitles: [] };
        item.count++;
        if (item.sampleTitles.length < 2 && !item.sampleTitles.includes(e.title)) {
          item.sampleTitles.push(e.title);
        }
        eventCountsByCourse.set(match.id, item);
      }
    }

    // Add detected courses (new courses)
    detected.forEach((c, idx) => {
      const stat = eventCountsByCourse.get(c.id) || { count: 0, sampleTitles: [] };
      candidateList.push({
        id: c.id,
        name: c.name,
        originalName: c.name,
        selected: true, // Selected by default
        eventCount: stat.count,
        sampleTitles: stat.sampleTitles,
        courseColor: c.color || COLORS[idx % COLORS.length],
      });
    });

    // Also look for existing courses that might receive events
    courses.forEach(c => {
      const stat = eventCountsByCourse.get(c.id);
      if (stat && stat.count > 0) {
        // Only include if not already in candidateList
        if (!candidateList.some(cand => cand.name.toLowerCase() === c.name.toLowerCase())) {
          candidateList.push({
            id: c.id,
            name: c.name,
            originalName: c.name,
            selected: true,
            eventCount: stat.count,
            sampleTitles: stat.sampleTitles,
            courseColor: c.color,
            existingCourseId: c.id,
          });
        }
      }
    });

    setRawEvents(events);
    setCandidates(candidateList);
    setIsImporting(false);
    setError('');

    // If courses detected or candidates found, go to curate_courses step
    if (candidateList.length > 0) {
      setStep('curate_courses');
    } else {
      // No specific courses detected (all generic events)
      // Check if historical check triggers
      if (isPastMoreThanAWeek) {
        // Can't do course checkpoint if no courses, commit directly
        commitEventsDirectly(events, [], false);
      } else {
        commitEventsDirectly(events, [], false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const events = file.name.endsWith('.csv') ? parseCSV(text) : parseICS(text);
        onEventsExtracted(events);
      } catch {
        setError('Errore nel parsing del file. Verifica il formato (.ics o .csv).');
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      setError('Errore nella lettura del file.');
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const handleURLImport = async () => {
    if (!url.trim()) return;
    setIsImporting(true);
    setError('');

    try {
      const events = await fetchCalendarFromURL(url.trim());
      onEventsExtracted(events);
    } catch {
      setError('Impossibile scaricare o interpretare il calendario dall\'URL fornito.');
      setIsImporting(false);
    }
  };

  // Toggle selection of candidate course
  const toggleSelectCandidate = (id: string) => {
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  // Rename candidate
  const startRenameCandidate = (c: DetectedCourseCandidate) => {
    setEditingCandidateId(c.id);
    setEditingCandidateName(c.name);
  };

  const saveRenameCandidate = (id: string) => {
    if (!editingCandidateName.trim()) return;
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, name: editingCandidateName.trim() } : c))
    );
    setEditingCandidateId(null);
  };

  // Proceed after course curation
  const handleConfirmCourses = () => {
    const selected = candidates.filter(c => c.selected);
    if (selected.length === 0) {
      // User deselected all courses, import events as generic or skip course creation
    }

    // Check if historical (> 1 week ago)
    if (isHistorical && selected.length > 0) {
      // Build checkpoint structures for confirmed courses
      prepareCheckpoints(selected);
      setStep('checkpoint');
    } else {
      // Directly commit without checkpoint prompt
      executeImport(selected, []);
    }
  };

  // Prepares checkpoint data for each confirmed course
  const prepareCheckpoints = (selectedCandidates: DetectedCourseCandidate[]) => {
    const nowMs = Date.now();

    // Create temporary course definitions to evaluate tracks
    const tempCourses: Course[] = selectedCandidates.map((cand, idx) => {
      const existing = courses.find(c => c.id === cand.existingCourseId);
      if (existing) {
        return { ...existing, name: cand.name };
      }
      return {
        id: cand.id,
        name: cand.name,
        difficulty: 5,
        color: cand.courseColor || COLORS[idx % COLORS.length],
        defaultStudyPreferences: {
          requiresNotesRevision: true,
          requiresExercises: false,
          estimatedRevisionTimePerLesson: 45,
        },
      };
    });

    const settings: CourseCheckpointSetting[] = [];

    for (const c of tempCourses) {
      // Match events belonging to this course
      const courseEvents = rawEvents
        .filter(e => {
          const matched = findCourseForTitle(e.title, tempCourses);
          return matched?.id === c.id;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      if (courseEvents.length === 0) continue;

      const theoryLessons: CourseCheckpointSetting['theoryLessons'] = [];
      const exerciseLessons: CourseCheckpointSetting['exerciseLessons'] = [];

      let theoryIdx = 1;
      let exIdx = 1;

      for (const ev of courseEvents) {
        const tracks = getLessonTracks(ev, c);
        const evStartMs = new Date(ev.startTime).getTime();
        const isPast = evStartMs <= nowMs;
        const dateIt = new Date(ev.startTime).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        const cleanTitle = ev.title
          .replace(new RegExp(`^${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]?\\s*`, 'i'), '')
          .trim() || ev.title;

        if (tracks.hasTheory) {
          theoryLessons.push({
            id: ev.id,
            index: theoryIdx++,
            title: cleanTitle,
            dateIt,
            isPast,
          });
        }
        if (tracks.hasExercise) {
          exerciseLessons.push({
            id: ev.id,
            index: exIdx++,
            title: cleanTitle,
            dateIt,
            isPast,
          });
        }
      }

      // Default checkpoints: find the latest PAST lesson
      const lastPastTheory = [...theoryLessons].reverse().find(l => l.isPast);
      const lastPastExercise = [...exerciseLessons].reverse().find(l => l.isPast);

      settings.push({
        courseId: c.id,
        courseName: c.name,
        courseColor: c.color,
        hasTheory: theoryLessons.length > 0,
        hasExercise: exerciseLessons.length > 0,
        theoryLessons,
        exerciseLessons,
        // Auto-select the last past lesson so the user is in-pari by default, or they can adjust
        selectedTheoryUpToId: lastPastTheory?.id || null,
        selectedExerciseUpToId: lastPastExercise?.id || null,
      });
    }

    setCheckpointSettings(settings);
  };

  // Quick action: set all to prof for a specific course or track
  const setCourseCheckpointUpTo = (
    courseId: string,
    track: 'theory' | 'exercise',
    upToEventId: string | null
  ) => {
    setCheckpointSettings(prev =>
      prev.map(s => {
        if (s.courseId !== courseId) return s;
        return track === 'theory'
          ? { ...s, selectedTheoryUpToId: upToEventId }
          : { ...s, selectedExerciseUpToId: upToEventId };
      })
    );
  };

  const handleCatchUpAllInCheckpoint = () => {
    setCheckpointSettings(prev =>
      prev.map(s => {
        const lastPastTheory = [...s.theoryLessons].reverse().find(l => l.isPast);
        const lastPastEx = [...s.exerciseLessons].reverse().find(l => l.isPast);
        return {
          ...s,
          selectedTheoryUpToId: lastPastTheory?.id || null,
          selectedExerciseUpToId: lastPastEx?.id || null,
        };
      })
    );
  };

  const handleResetAllInCheckpoint = () => {
    setCheckpointSettings(prev =>
      prev.map(s => ({
        ...s,
        selectedTheoryUpToId: null,
        selectedExerciseUpToId: null,
      }))
    );
  };

  // Execute final import and checkpoint application
  const executeImport = (
    confirmedCandidates: DetectedCourseCandidate[],
    cpSettings: CourseCheckpointSetting[]
  ) => {
    setIsImporting(true);
    useAppStore.getState().saveSnapshot();

    // 1. Create newly confirmed courses (avoid duplicating already existing ones)
    const newCoursesToCreate: Course[] = [];
    const confirmedCoursesMap: Course[] = [];

    confirmedCandidates.forEach((cand, idx) => {
      let existingCourse = courses.find(c => c.id === cand.existingCourseId);
      if (!existingCourse) {
        existingCourse = courses.find(c => c.name.toLowerCase() === cand.name.toLowerCase());
      }

      if (existingCourse) {
        // Use existing
        confirmedCoursesMap.push(existingCourse);
      } else {
        const newC: Course = {
          id: cand.id,
          name: cand.name,
          difficulty: 5,
          color: cand.courseColor || COLORS[idx % COLORS.length],
          defaultStudyPreferences: {
            requiresNotesRevision: true,
            requiresExercises: false,
            estimatedRevisionTimePerLesson: 45,
          },
        };
        newCoursesToCreate.push(newC);
        confirmedCoursesMap.push(newC);
        addCourse(newC);
      }
    });

    const allCourses = [...courses, ...newCoursesToCreate];

    // 2. Build map of checkpoint completed event IDs
    // Set of event IDs marked done for theory and exercise
    const theoryDoneIds = new Set<string>();
    const exerciseDoneIds = new Set<string>();

    for (const cp of cpSettings) {
      if (cp.selectedTheoryUpToId) {
        const idx = cp.theoryLessons.findIndex(l => l.id === cp.selectedTheoryUpToId);
        if (idx >= 0) {
          cp.theoryLessons.slice(0, idx + 1).forEach(l => theoryDoneIds.add(l.id));
        }
      }
      if (cp.selectedExerciseUpToId) {
        const idx = cp.exerciseLessons.findIndex(l => l.id === cp.selectedExerciseUpToId);
        if (idx >= 0) {
          cp.exerciseLessons.slice(0, idx + 1).forEach(l => exerciseDoneIds.add(l.id));
        }
      }
    }

    // 3. Map events to confirmed courses, discarding events of unselected courses or keeping generic
    // Only map to courses that the user selected!
    const eventsToImport: CalendarEvent[] = [];

    for (const ev of rawEvents) {
      // Find if matches any confirmed course
      const match = findCourseForTitle(ev.title, confirmedCoursesMap);

      if (match) {
        // Belongs to a confirmed course
        const isTheoryDone = theoryDoneIds.has(ev.id);
        const isExerciseDone = exerciseDoneIds.has(ev.id);
        const isOverallDone = isTheoryDone || isExerciseDone || ev.isDone;

        eventsToImport.push({
          ...ev,
          courseId: match.id,
          type: 'lesson',
          theoryDone: isTheoryDone ? true : ev.theoryDone,
          exerciseDone: isExerciseDone ? true : ev.exerciseDone,
          isDone: isOverallDone,
        });
      } else {
        // Check if it belongs to an unselected candidate course
        const unselectedMatch = findCourseForTitle(
          ev.title,
          candidates.filter(c => !c.selected).map(c => ({ id: c.id, name: c.name } as Course))
        );

        if (unselectedMatch) {
          // Belongs to a false/deselected course -> DISCARD as requested
          continue;
        }

        // Generic event unrelated to course candidates
        eventsToImport.push(ev);
      }
    }

    // 4. Add events to store
    addEvents(eventsToImport);

    // 5. If checkpoints were set, trigger setCourseCheckpoint on store to clean up any retro tasks
    let checkpointsCount = 0;
    for (const cp of cpSettings) {
      if (cp.selectedTheoryUpToId) {
        setCourseCheckpoint(cp.courseId, 'theory', cp.selectedTheoryUpToId);
        checkpointsCount++;
      }
      if (cp.selectedExerciseUpToId) {
        setCourseCheckpoint(cp.courseId, 'exercise', cp.selectedExerciseUpToId);
        checkpointsCount++;
      }
    }

    setResult({
      eventsCount: eventsToImport.length,
      coursesCount: newCoursesToCreate.length,
      checkpointsApplied: checkpointsCount,
    });
    setIsImporting(false);
    setStep('result');
  };

  const commitEventsDirectly = (
    events: CalendarEvent[],
    newCourses: Course[],
    /* isPast: boolean */
  ) => {
    useAppStore.getState().saveSnapshot();
    for (const c of newCourses) {
      addCourse(c);
    }
    const allCourses = [...courses, ...newCourses];
    const enriched = events.map(e => {
      if ((e.type === 'lesson' || e.type === 'generic' || !e.type) && !e.courseId) {
        const match = findCourseForTitle(e.title, allCourses);
        if (match) return { ...e, courseId: match.id, type: 'lesson' as const };
      }
      return e;
    });

    addEvents(enriched);
    setResult({
      eventsCount: enriched.length,
      coursesCount: newCourses.length,
      checkpointsApplied: 0,
    });
    setIsImporting(false);
    setStep('result');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'upload'
          ? 'Importa Calendario'
          : step === 'curate_courses'
          ? 'Selezione Materie Rilevate'
          : step === 'checkpoint'
          ? 'A che punto sei? (Checkpoint iniziale)'
          : 'Importazione Completata'
      }
    >
      <div className="import-modal" style={{ maxHeight: '78vh', overflowY: 'auto' }}>
        {/* STEP 1: UPLOAD / URL */}
        {step === 'upload' && (
          <>
            <p className="import-desc">
              Carica un file <strong>.ics</strong> o <strong>.csv</strong> dal portale della tua Università,
              oppure inserisci il link web del calendario.
            </p>

            <div className="import-dropzone">
              <input
                type="file"
                accept=".ics,.csv"
                onChange={handleFileChange}
                className="import-file-input"
                id="file-upload"
                disabled={isImporting}
              />
              <label htmlFor="file-upload" className={`import-file-label ${isImporting ? 'disabled' : ''}`}>
                <Upload size={20} />
                {isImporting ? 'Analisi del file in corso...' : 'Scegli file .ics/.csv'}
              </label>
            </div>

            <div className="import-divider">
              <span>oppure</span>
            </div>

            <div className="import-url-section">
              <div className="import-url-row">
                <Link size={16} className="import-url-icon" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://calendario.uni.it/cal.ics"
                  className="import-url-input"
                  disabled={isImporting}
                />
                <Button
                  variant="primary"
                  onClick={handleURLImport}
                  disabled={isImporting || !url.trim()}
                  className="import-url-btn"
                >
                  {isImporting ? 'Caricamento...' : 'Importa'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="import-result import-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
          </>
        )}

        {/* STEP 2: CURATE COURSES (ELIMINATE FALSE DETECTIONS) */}
        {step === 'curate_courses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              Abbiamo estratto <strong>{rawEvents.length} lezioni/eventi</strong> dal file.
              Controlla le materie individuate: deseleziona quelle false o non pertinenti (es. seminari una tantum, attività generiche) per non inquinare il tuo piano di studi.
            </div>

            {isHistorical && earliestEventDate && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(242, 153, 0, 0.1)',
                  border: '1px solid rgba(242, 153, 0, 0.3)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                }}
              >
                <Clock size={20} style={{ color: '#b06d00', flexShrink: 0 }} />
                <div>
                  <strong>Calendario già avviato!</strong> Il primo evento risale al{' '}
                  <strong>{earliestEventDate.toLocaleDateString('it-IT')}</strong> (più di una settimana fa).
                  Nel prossimo passaggio potrai indicare a che punto sei arrivato per non ricevere arretrati inutili.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Materie rilevate ({candidates.filter(c => c.selected).length}/{candidates.length} attive):
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setCandidates(prev => prev.map(c => ({ ...c, selected: true })))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Seleziona tutte
                </button>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <button
                  type="button"
                  onClick={() => setCandidates(prev => prev.map(c => ({ ...c, selected: false })))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Deseleziona tutte
                </button>
              </div>
            </div>

            {/* List of detected courses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {candidates.map(c => {
                const isEditing = editingCandidateId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: c.selected ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                      border: `1.5px solid ${c.selected ? 'var(--border-color)' : 'transparent'}`,
                      opacity: c.selected ? 1 : 0.55,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`cand-${c.id}`}
                      checked={c.selected}
                      onChange={() => toggleSelectCandidate(c.id)}
                      style={{ width: 17, height: 17, cursor: 'pointer', accentColor: c.courseColor }}
                    />

                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: c.courseColor,
                        flexShrink: 0,
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={editingCandidateName}
                            onChange={e => setEditingCandidateName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveRenameCandidate(c.id);
                              if (e.key === 'Escape') setEditingCandidateId(null);
                            }}
                            autoFocus
                            className="cp-input"
                            style={{ padding: '4px 8px', fontSize: '0.86rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => saveRenameCandidate(c.id)}
                            style={{
                              padding: '5px 8px',
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                            }}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label
                            htmlFor={`cand-${c.id}`}
                            style={{
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.name}
                          </label>
                          <button
                            type="button"
                            onClick={() => startRenameCandidate(c)}
                            title="Rinomina materia"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'inline-flex',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      )}

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {c.eventCount} eventi rilevati
                        {c.sampleTitles.length > 0 && (
                          <span style={{ marginLeft: 6, opacity: 0.8 }}>
                            (es. {c.sampleTitles[0]})
                          </span>
                        )}
                      </div>
                    </div>

                    {c.existingCourseId && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: 'rgba(26,115,232,0.12)',
                          color: '#1a73e8',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        Già esistente
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Button variant="ghost" onClick={handleClose}>
                Annulla
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCourses}
                disabled={candidates.filter(c => c.selected).length === 0}
                icon={<ArrowRight size={16} />}
              >
                {isHistorical ? 'Avanti: Checkpoint Avanzamento' : 'Conferma e Importa'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CHECKPOINT PROMPT (FOR HISTORICAL SEMESTERS) */}
        {step === 'checkpoint' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                background: 'rgba(24, 128, 56, 0.08)',
                border: '1px solid rgba(24, 128, 56, 0.25)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, marginBottom: 4, color: '#188038' }}>
                <Sparkles size={16} /> Punto di arrivo (Nessun arretrato superfluo)
              </div>
              Dato che il calendario è iniziato da oltre una settimana, imposta fino a quale lezione sei attualmente arrivato per ciascuna materia.
              Le lezioni precedenti a questo punto verranno <strong>segnate come già svolte</strong> senza generare centinaia di compiti arretrati.
            </div>

            {/* Quick bulk actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Seleziona dove sei per materia:
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCatchUpAllInCheckpoint}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#188038',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  ✓ Mettimi in pari col prof su tutte
                </button>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <button
                  type="button"
                  onClick={handleResetAllInCheckpoint}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Ricomincia da zero (0 lezioni)
                </button>
              </div>
            </div>

            {/* Course Checkpoint Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {checkpointSettings.map(setting => (
                <div
                  key={setting.courseId}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.92rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: setting.courseColor }} />
                    <span style={{ color: 'var(--text-primary)' }}>{setting.courseName}</span>
                  </div>

                  {/* Theory Selector */}
                  {setting.hasTheory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <BookOpen size={13} style={{ color: setting.courseColor }} /> Teoria completata fino a:
                        </span>
                        {setting.theoryLessons.some(l => l.isPast) && (
                          <button
                            type="button"
                            onClick={() => {
                              const lastPast = [...setting.theoryLessons].reverse().find(l => l.isPast);
                              if (lastPast) setCourseCheckpointUpTo(setting.courseId, 'theory', lastPast.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            In pari col prof
                          </button>
                        )}
                      </div>
                      <select
                        className="cp-select"
                        style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                        value={setting.selectedTheoryUpToId || 'NONE'}
                        onChange={e =>
                          setCourseCheckpointUpTo(
                            setting.courseId,
                            'theory',
                            e.target.value === 'NONE' ? null : e.target.value
                          )
                        }
                      >
                        <option value="NONE">— Nessuna lezione fatta (0/{setting.theoryLessons.length}) —</option>
                        {setting.theoryLessons.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.isPast ? '✓ ' : '⏳ '}#{l.index} ({l.dateIt}) — {l.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Exercise Selector */}
                  {setting.hasExercise && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={13} style={{ color: '#f29900' }} /> Esercitazioni completate fino a:
                        </span>
                        {setting.exerciseLessons.some(l => l.isPast) && (
                          <button
                            type="button"
                            onClick={() => {
                              const lastPast = [...setting.exerciseLessons].reverse().find(l => l.isPast);
                              if (lastPast) setCourseCheckpointUpTo(setting.courseId, 'exercise', lastPast.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-primary)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            In pari col prof
                          </button>
                        )}
                      </div>
                      <select
                        className="cp-select"
                        style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                        value={setting.selectedExerciseUpToId || 'NONE'}
                        onChange={e =>
                          setCourseCheckpointUpTo(
                            setting.courseId,
                            'exercise',
                            e.target.value === 'NONE' ? null : e.target.value
                          )
                        }
                      >
                        <option value="NONE">— Nessuna esercitazione fatta (0/{setting.exerciseLessons.length}) —</option>
                        {setting.exerciseLessons.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.isPast ? '✓ ' : '⏳ '}#{l.index} ({l.dateIt}) — {l.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Button variant="ghost" onClick={() => setStep('curate_courses')}>
                Indietro
              </Button>
              <Button
                variant="primary"
                onClick={() => executeImport(candidates.filter(c => c.selected), checkpointSettings)}
                disabled={isImporting}
                icon={<Check size={16} />}
              >
                {isImporting ? 'Applicazione in corso...' : 'Conferma e Salva Tutto'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT */}
        {step === 'result' && result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center', padding: '16px 8px' }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'rgba(24, 128, 56, 0.12)',
                color: '#188038',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={32} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Calendario importato con successo!
            </h3>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 380 }}>
              Sono stati importati <strong>{result.eventsCount}</strong> eventi per{' '}
              <strong>{candidates.filter(c => c.selected).length}</strong> materie confermate.
              {result.coursesCount > 0 && (
                <> Aggiunti <strong>{result.coursesCount}</strong> nuovi corsi al tuo catalogo.</>
              )}
              {result.checkpointsApplied > 0 && (
                <div style={{ marginTop: 6, color: '#188038', fontWeight: 600 }}>
                  ✓ Checkpoint applicati: le lezioni passate sono già in pari senza compiti retroattivi inutili!
                </div>
              )}
            </div>

            <Button variant="primary" onClick={handleClose} style={{ marginTop: 8 }}>
              Chiudi e Torna all'App
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
