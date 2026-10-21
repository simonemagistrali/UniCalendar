import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { extractTextFromPDF, extractTextFromExcel, analyzeSyllabusWithGemini } from '../../../core/SyllabusParser';
import { matchSyllabusWithCalendar, applySyllabusMatches, type MatchResultItem } from '../../../core/SyllabusMatcher';
import type { Course, ParsedLessonNote } from '../../../core/types';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Calendar, 
  BookOpen, 
  ExternalLink,
  Check,
  Plus
} from 'lucide-react';

interface ImportSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportSyllabusModal({ isOpen, onClose }: ImportSyllabusModalProps) {
  const courses = useAppStore(s => s.courses);
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const preferences = useAppStore(s => s.preferences);
  const setEvents = useAppStore(s => s.setEvents);
  const setTasks = useAppStore(s => s.setTasks);
  const saveSnapshot = useAppStore(s => s.saveSnapshot);
  const addCourse = useAppStore(s => s.addCourse);

  // Wizard steps: 'upload' -> 'analyzing' -> 'review' -> 'success'
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
  
  // Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [newCourseName, setNewCourseName] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(courses.length === 0);
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState(preferences.geminiApiKey || '');
  
  // Progress & Error
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  
  // Result State
  const [extractedLessons, setExtractedLessons] = useState<ParsedLessonNote[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResultItem[]>([]);
  const [createMissingEvents, setCreateMissingEvents] = useState(true);
  const [summaryStats, setSummaryStats] = useState<{ updated: number; created: number; tokens?: number }>({ updated: 0, created: 0 });

  const activeCourse: Course | undefined = courses.find(c => c.id === selectedCourseId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const handleStartAnalysis = async () => {
    let courseToUse = activeCourse;

    // Handle inline course creation if needed
    if (isCreatingCourse || !courseToUse) {
      if (!newCourseName.trim()) {
        setError('Inserisci il nome del corso universitario.');
        return;
      }
      const newC: Course = {
        id: `course-${Date.now()}`,
        name: newCourseName.trim(),
        difficulty: 6,
        color: '#3b82f6',
        defaultStudyPreferences: {
          requiresNotesRevision: true,
          requiresExercises: true,
          estimatedRevisionTimePerLesson: 60,
        }
      };
      addCourse(newC);
      courseToUse = newC;
      setSelectedCourseId(newC.id);
      setIsCreatingCourse(false);
    }

    if (!file) {
      setError('Seleziona un file PDF o Excel/CSV da analizzare.');
      return;
    }

    if (!apiKey.trim()) {
      setError('Inserisci la chiave API di Google Gemini (gratuita su aistudio.google.com).');
      return;
    }

    setStep('analyzing');
    setError('');
    setStatusMessage('1/2 Estrazione del testo dal file nel browser...');

    try {
      const buffer = await file.arrayBuffer();
      let rawText = '';
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.pdf')) {
        rawText = await extractTextFromPDF(buffer);
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        rawText = await extractTextFromExcel(buffer);
      } else {
        throw new Error('Formato file non supportato. Usa PDF, XLSX, XLS o CSV.');
      }

      if (!rawText.trim()) {
        throw new Error('Nessun testo leggibile trovato nel file selezionato.');
      }

      setStatusMessage('2/2 Analisi con Google Gemini Flash (estrazione lezioni, note, capitoli)...');
      
      const currentYear = new Date().getFullYear();
      const aiResult = await analyzeSyllabusWithGemini(
        rawText, 
        apiKey.trim(), 
        courseToUse.name, 
        currentYear
      );

      if (!aiResult.lessons || aiResult.lessons.length === 0) {
        throw new Error('Nessuna lezione identificata dal modello AI. Verifica che il file contenga una tabella con date e argomenti.');
      }

      setExtractedLessons(aiResult.lessons);

      // Match against calendar
      const matches = matchSyllabusWithCalendar(aiResult.lessons, events, courseToUse);
      setMatchResults(matches);
      setSummaryStats(prev => ({ ...prev, tokens: aiResult.tokensUsed }));
      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Si è verificato un errore durante l\'analisi.');
      setStep('upload');
    }
  };

  const handleApplyChanges = () => {
    let courseToUse = activeCourse;
    if (!courseToUse && selectedCourseId) {
      courseToUse = courses.find(c => c.id === selectedCourseId);
    }
    if (!courseToUse) return;

    saveSnapshot(); // Enable Undo

    const { updatedEvents, updatedTasks, newEventsCreatedCount, eventsEnrichedCount } = applySyllabusMatches(
      matchResults,
      events,
      tasks,
      courseToUse,
      createMissingEvents
    );

    setEvents(updatedEvents);
    setTasks(updatedTasks);
    setSummaryStats({
      updated: eventsEnrichedCount,
      created: newEventsCreatedCount,
      tokens: summaryStats.tokens,
    });
    setStep('success');
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setError('');
    setStatusMessage('');
    setExtractedLessons([]);
    setMatchResults([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importa Note & Calendario con AI">
      <div className="syllabus-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh' }}>
        
        {/* STEP 1: UPLOAD & SETUP */}
        {step === 'upload' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
              <Sparkles size={24} style={{ color: '#a855f7', flexShrink: 0 }} />
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                <strong>Analisi Intelligente Syllabus & Calendario</strong>: carica il PDF o Excel fornito dal docente per inserire automaticamente <strong>argomenti svolti</strong>, <strong>capitoli del libro</strong>, link e compiti nelle lezioni e nei task di ripasso.
              </div>
            </div>

            {/* Course Selection */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Corso di Riferimento:
              </label>
              {!isCreatingCourse && courses.length > 0 ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={selectedCourseId} 
                    onChange={e => setSelectedCourseId(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => setIsCreatingCourse(true)} title="Crea un nuovo corso">
                    <Plus size={16} /> Nuovo
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={e => setNewCourseName(e.target.value)}
                    placeholder="Nome nuovo corso (es. Sistemi Multiagente, Big Data...)"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                  {courses.length > 0 && (
                    <Button variant="ghost" onClick={() => setIsCreatingCourse(false)}>
                      Annulla
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* File Upload Dropzone */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                File Calendario / Syllabus (PDF, Excel, CSV):
              </label>
              <div 
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: file ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                  id="syllabus-file-input"
                />
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <FileText size={32} style={{ color: '#22c55e' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {(file.size / 1024).toFixed(1)} KB — Clicca per cambiare file
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Upload size={32} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Trascina qui il file o clicca per selezionarlo
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Supporta PDF con tabelle, fogli Excel (.xlsx/.xls) ed esportazioni CSV
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Gemini API Key Box */}
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Chiave API Google Gemini
                </span>
                <span style={{ fontSize: '0.75rem', color: apiKey ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {apiKey ? '✓ Configurata' : 'Richiesta'}
                </span>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Incolla qui la tua API Key..."
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.88rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={onClose}>Annulla</Button>
              <Button 
                variant="primary" 
                onClick={handleStartAnalysis}
                disabled={!file}
                style={{ minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Sparkles size={16} /> Analizza con AI
              </Button>
            </div>
          </>
        )}

        {/* STEP 2: ANALYZING SPINNER */}
        {step === 'analyzing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center', gap: '16px' }}>
            <div className="loading-spinner" style={{ width: '48px', height: '48px', border: '4px solid rgba(168, 85, 247, 0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Elaborazione in corso</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '380px' }}>
              {statusMessage}
            </p>
          </div>
        )}

        {/* STEP 3: REVIEW & APPROVAL */}
        {step === 'review' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '10px' }}>
              <div>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {extractedLessons.length} lezioni trovate
                </span>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Corso: <strong>{activeCourse?.name}</strong> • Token utilizzati: ~{summaryStats.tokens || '6k'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 600 }}>
                  {matchResults.filter(m => m.matchedEvent).length} abbinate
                </span>
                <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 600 }}>
                  {matchResults.filter(m => m.isNewEventNeeded).length} nuove
                </span>
              </div>
            </div>

            {/* Checkbox for creating new events */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: 'var(--text-primary)', cursor: 'pointer', padding: '0 4px' }}>
              <input
                type="checkbox"
                checked={createMissingEvents}
                onChange={e => setCreateMissingEvents(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#a855f7' }}
              />
              <span>Crea automaticamente nel calendario le lezioni non ancora presenti</span>
            </label>

            {/* List of Extracted Lessons */}
            <div style={{ overflowY: 'auto', maxHeight: '42vh', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {matchResults.map((item, idx) => {
                const { syllabusLesson, matchedEvent, isNewEventNeeded } = item;
                return (
                  <div 
                    key={idx}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: syllabusLesson.isCancelled ? 'rgba(107, 114, 128, 0.08)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {syllabusLesson.parsedDate || syllabusLesson.rawDate}
                        </span>
                        {syllabusLesson.startTime && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: '4px' }}>
                            {syllabusLesson.startTime}{syllabusLesson.endTime ? ` - ${syllabusLesson.endTime}` : ''}
                          </span>
                        )}
                        <span style={{ 
                          fontSize: '0.72rem', 
                          padding: '1px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 600,
                          background: syllabusLesson.lessonType === 'exercise' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: syllabusLesson.lessonType === 'exercise' ? '#ca8a04' : '#2563eb'
                        }}>
                          {syllabusLesson.lessonType === 'exercise' ? 'Esercitazione' : 'Teoria'}
                        </span>
                        {syllabusLesson.room && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Aula {syllabusLesson.room}
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      {syllabusLesson.isCancelled ? (
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-secondary)' }}>
                          NO CLASS
                        </span>
                      ) : matchedEvent ? (
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 600 }}>
                          ✓ Aggiorna evento
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 600 }}>
                          + Nuova
                        </span>
                      )}
                    </div>

                    {/* Topic */}
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: syllabusLesson.isCancelled ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {syllabusLesson.topic}
                    </div>

                    {/* Textbook Chapters / Notes */}
                    {syllabusLesson.sectionsOrChapters && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <BookOpen size={14} style={{ color: '#a855f7', flexShrink: 0 }} />
                        <span>{syllabusLesson.sectionsOrChapters}</span>
                      </div>
                    )}

                    {/* Lecturer */}
                    {syllabusLesson.lecturer && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Docente: <em>{syllabusLesson.lecturer}</em>
                      </div>
                    )}

                    {/* Reading Links */}
                    {syllabusLesson.readingsOrLinks && syllabusLesson.readingsOrLinks.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                        {syllabusLesson.readingsOrLinks.map((link, lIdx) => (
                          <a 
                            key={lIdx} 
                            href={link} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none' }}
                          >
                            <ExternalLink size={12} /> Link materiale
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} /> Carica altro file
              </Button>
              <Button 
                variant="primary" 
                onClick={handleApplyChanges}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Check size={16} /> Applica al Calendario e Task
              </Button>
            </div>
          </>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              Syllabus Importato con Successo!
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '420px', lineHeight: 1.5 }}>
              Abbiamo aggiornato <strong>{summaryStats.updated}</strong> lezioni e creato <strong>{summaryStats.created}</strong> nuove sessioni.
              Tutti i task di studio e ripasso ora contengono gli argomenti e i capitoli del libro.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <Button variant="primary" onClick={onClose}>
                Vai al Calendario
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
