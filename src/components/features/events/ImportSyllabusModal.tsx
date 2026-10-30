import React, { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { extractTextFromPDF, extractTextFromExcel, extractTextFromPlain } from '../../../core/SyllabusParser';
import { analyzeCourseDocument } from '../../../core/CourseAI';
import { matchSyllabusWithCalendar, type MatchResultItem } from '../../../core/SyllabusMatcher';
import { applyExtractionToCourse, ASSESSMENT_LABELS, type ApplyOptions, type ApplyStats } from '../../../core/CourseKnowledge';
import type { Course, DocumentKind, SyllabusExtractionResult } from '../../../core/types';
import {
  Sparkles, Upload, FileText, CheckCircle2, AlertCircle, ArrowLeft, BookOpen, ExternalLink, Check, Plus,
  CalendarDays, ListTree, ClipboardCheck, AlignLeft,
} from 'lucide-react';

interface ImportSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Corso preselezionato (es. quando si apre dalla pagina del corso) */
  initialCourseId?: string;
}

const KIND_LABELS: Record<DocumentKind, string> = {
  lesson_calendar: 'Calendario delle lezioni',
  syllabus: 'Programma / indice del corso',
  exam_info: 'Modalità di valutazione',
  study_plan: 'Pianificazione dello studio',
  deadlines: 'Scadenze',
  other: 'Documento generico',
};

const box: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px' };
const sectionHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' };
const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: bg, color: fg });

export function ImportSyllabusModal({ isOpen, onClose, initialCourseId }: ImportSyllabusModalProps) {
  const courses = useAppStore(s => s.courses);
  const addCourse = useAppStore(s => s.addCourse);
  const commitCourseImport = useAppStore(s => s.commitCourseImport);

  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'success'>('upload');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '');
  const [newCourseName, setNewCourseName] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(courses.length === 0);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const [result, setResult] = useState<SyllabusExtractionResult | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResultItem[]>([]);
  const [analyzedCourseId, setAnalyzedCourseId] = useState('');
  const [options, setOptions] = useState<ApplyOptions>({
    applyLessons: true,
    createMissingLessonEvents: true,
    applyTopics: true,
    applyAssessments: true,
    createAssessmentEvents: true,
    applyTexts: true,
  });
  const [stats, setStats] = useState<ApplyStats | null>(null);

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
        defaultStudyPreferences: { requiresNotesRevision: true, requiresExercises: true, estimatedRevisionTimePerLesson: 60 },
      };
      addCourse(newC);
      courseToUse = newC;
      setSelectedCourseId(newC.id);
      setIsCreatingCourse(false);
    }

    if (!file) {
      setError('Seleziona un documento da analizzare.');
      return;
    }

    setStep('analyzing');
    setError('');
    setStatusMessage('1/2 Lettura del documento nel browser...');

    try {
      const buffer = await file.arrayBuffer();
      const lowerName = file.name.toLowerCase();
      let rawText = '';
      if (lowerName.endsWith('.pdf')) rawText = await extractTextFromPDF(buffer);
      else if (/\.(xlsx|xls|csv)$/.test(lowerName)) rawText = await extractTextFromExcel(buffer);
      else if (/\.(txt|md)$/.test(lowerName)) rawText = await extractTextFromPlain(buffer);
      else throw new Error('Formato file non supportato. Usa PDF, XLSX, XLS, CSV, TXT o MD.');

      if (!rawText.trim()) throw new Error('Nessun testo leggibile trovato nel file selezionato.');

      setStatusMessage('2/2 Analisi con AI: riconosco il tipo di documento e ne estraggo le informazioni...');

      // Stato fresco dallo store: il corso potrebbe essere appena stato creato
      const state = useAppStore.getState();
      const freshCourse = state.courses.find(c => c.id === courseToUse!.id) ?? courseToUse;
      const aiResult = await analyzeCourseDocument(rawText, file.name, freshCourse, state.events);

      if (aiResult.totalExtracted === 0) {
        throw new Error('Nessuna informazione utile trovata nel documento (date, argomenti, valutazione, scadenze). Verifica che sia il file giusto.');
      }

      setResult(aiResult);
      setAnalyzedCourseId(freshCourse.id);
      const matches = matchSyllabusWithCalendar(aiResult.lessons, state.events, freshCourse, state.tasks);
      setMatchResults(matches);
      setOptions(o => ({
        ...o,
        applyLessons: aiResult.lessons.length > 0,
        applyTopics: aiResult.topics.length > 0,
        applyAssessments: aiResult.assessments.length > 0,
        applyTexts: !!(aiResult.overview || aiResult.gradingSummary || aiResult.studyPlan),
      }));
      setStep('review');
    } catch (err: unknown) {
      setError((err as Error)?.message || "Si è verificato un errore durante l'analisi.");
      setStep('upload');
    }
  };

  const handleApplyChanges = () => {
    if (!result) return;
    const state = useAppStore.getState();
    const course = state.courses.find(c => c.id === analyzedCourseId);
    if (!course) return;

    // Rifà l'abbinamento sullo stato più recente (il calendario può essere cambiato nel frattempo)
    const freshMatches = options.applyLessons ? matchSyllabusWithCalendar(result.lessons, state.events, course, state.tasks) : [];
    const applied = applyExtractionToCourse({
      course,
      result,
      fileName: file?.name ?? 'documento',
      matches: freshMatches,
      events: state.events,
      tasks: state.tasks,
      options,
    });
    commitCourseImport({ course: applied.course, events: applied.events, tasks: applied.tasks });
    // Genera subito i task dei corsi/lezioni appena aggiornati e riallinea quelli esistenti
    useAppStore.getState().syncAndSchedule();
    setStats(applied.stats);
    setStep('success');
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setError('');
    setStatusMessage('');
    setResult(null);
    setMatchResults([]);
    setStats(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setFile(null);
      setError('');
      setResult(null);
      setMatchResults([]);
      setStats(null);
      const current = useAppStore.getState().courses;
      if (initialCourseId && current.some(c => c.id === initialCourseId)) {
        setSelectedCourseId(initialCourseId);
        setIsCreatingCourse(false);
      } else if (current.length > 0) {
        setSelectedCourseId(prev => (prev && current.some(c => c.id === prev) ? prev : current[0].id));
      }
    }
  }, [isOpen, initialCourseId]);

  const reviewCourse = courses.find(c => c.id === analyzedCourseId);
  const toggle = (key: keyof ApplyOptions) => (e: React.ChangeEvent<HTMLInputElement>) => setOptions(o => ({ ...o, [key]: e.target.checked }));
  const nothingSelected = !(options.applyLessons || options.applyTopics || options.applyAssessments || options.applyTexts);

  const checkbox = (key: keyof ApplyOptions, label: string, hint?: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={options[key]} onChange={toggle(key)} style={{ marginTop: 3, accentColor: '#a855f7' }} />
      <span><strong>{label}</strong>{hint && <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{hint}</span>}</span>
    </label>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Analizza documento del corso con AI">
      <div className="syllabus-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxHeight: '75vh' }}>

        {step === 'upload' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))', border: '1px solid rgba(168,85,247,0.25)' }}>
              <Sparkles size={24} style={{ color: '#a855f7', flexShrink: 0 }} />
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                Carica un documento qualsiasi del corso: l'AI capisce da sola se contiene il <strong>calendario delle lezioni</strong>, l'<strong>indice degli argomenti</strong>,
                la <strong>composizione della valutazione</strong>, <strong>date di prove e scadenze</strong> o consigli di studio, tenendo conto di ciò che sa già della materia.
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Corso di riferimento:</label>
              {!isCreatingCourse && courses.length > 0 ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button variant="secondary" onClick={() => setIsCreatingCourse(true)} title="Crea un nuovo corso"><Plus size={16} /> Nuovo</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Nome nuovo corso (es. Sistemi Multiagente, Big Data...)"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  {courses.length > 0 && <Button variant="ghost" onClick={() => setIsCreatingCourse(false)}>Annulla</Button>}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Documento (PDF, Excel, CSV, TXT):</label>
              <div style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: '1.5rem', textAlign: 'center', background: file ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)', cursor: 'pointer', position: 'relative' }}>
                <input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.md" onChange={handleFileChange} id="syllabus-file-input"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <FileText size={32} style={{ color: '#22c55e' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(file.size / 1024).toFixed(1)} KB — Clicca per cambiare file</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Upload size={32} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Trascina qui il file o clicca per selezionarlo</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Calendario lezioni, programma del corso, regolamento d'esame, scadenze...</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.88rem', whiteSpace: 'pre-line' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={handleClose}>Annulla</Button>
              <Button variant="primary" onClick={handleStartAnalysis} disabled={!file} style={{ minWidth: 180, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} /> Analizza con AI
              </Button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center', gap: 16 }}>
            <div className="loading-spinner" style={{ width: 48, height: 48, border: '4px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Elaborazione in corso</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 380 }}>{statusMessage}</p>
          </div>
        )}

        {step === 'review' && result && (
          <>
            <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {KIND_LABELS[result.documentKind]} — {reviewCourse?.name}
              </span>
              {result.documentSummary && <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{result.documentSummary}</span>}
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Modello AI: <strong>{result.modelUsed || 'Gemini'}</strong>{result.tokensUsed ? ` • ~${result.tokensUsed} token` : ''}
              </span>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '48vh', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {result.lessons.length > 0 && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={sectionHead}>
                    <CalendarDays size={16} style={{ color: '#3b82f6' }} /> {result.lessons.length} lezioni
                    <span style={chip('rgba(34,197,94,0.15)', '#22c55e')}>{matchResults.filter(m => m.matchedEvent).length} abbinate</span>
                    <span style={chip('rgba(59,130,246,0.15)', '#3b82f6')}>{matchResults.filter(m => m.isNewEventNeeded).length} nuove</span>
                  </div>
                  {checkbox('applyLessons', 'Aggiorna calendario del corso, lezioni e task', 'Argomento, capitoli, docente e materiali vengono scritti nelle lezioni e nei task di studio (anche futuri).')}
                  {options.applyLessons && checkbox('createMissingLessonEvents', 'Crea nel calendario le lezioni delle date mancanti', 'Le lezioni future genereranno i task di studio a lezione finita.')}
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {matchResults.map((item, idx) => {
                      const l = item.syllabusLesson;
                      return (
                        <div key={idx} style={{ padding: '8px 10px', borderRadius: 8, background: l.isCancelled ? 'rgba(107,114,128,0.08)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong>{l.parsedDate || l.rawDate}</strong>
                            {l.startTime && <span style={{ color: 'var(--text-secondary)' }}>{l.startTime}{l.endTime ? `-${l.endTime}` : ''}</span>}
                            <span style={chip(l.lessonType === 'theory' ? 'rgba(59,130,246,0.2)' : 'rgba(234,179,8,0.2)', l.lessonType === 'theory' ? '#2563eb' : '#ca8a04')}>
                              {l.lessonType === 'exercise' ? 'Esercitazione' : l.lessonType === 'lab' ? 'Lab' : l.lessonType === 'theory_exercise' ? 'Teoria+Esercizi' : 'Teoria'}
                            </span>
                            {l.isCancelled ? <span style={chip('rgba(107,114,128,0.2)', 'var(--text-secondary)')}>NO CLASS</span>
                              : item.matchedEvent ? <span style={chip('rgba(34,197,94,0.15)', '#22c55e')}>✓ Aggiorna evento</span>
                              : <span style={chip('rgba(59,130,246,0.15)', '#3b82f6')}>+ Nuova</span>}
                          </div>
                          <div style={{ fontWeight: 600, marginTop: 2 }}>{l.topic}</div>
                          {l.sectionsOrChapters && <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }}><BookOpen size={13} style={{ color: '#a855f7' }} />{l.sectionsOrChapters}</div>}
                          {l.readingsOrLinks && l.readingsOrLinks.some(x => /^https?:/.test(x)) && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {l.readingsOrLinks.filter(x => /^https?:/.test(x)).map((link, i) => (
                                <a key={i} href={link} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.75rem', color: 'var(--primary)' }}><ExternalLink size={12} /> Link</a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {result.topics.length > 0 && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={sectionHead}><ListTree size={16} style={{ color: '#a855f7' }} /> {result.topics.length} argomenti per l'indice del corso</div>
                  {checkbox('applyTopics', "Aggiungi all'indice degli argomenti", 'Gli argomenti già presenti non vengono duplicati.')}
                  <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {result.topics.map((t, i) => <div key={i}>• {t.part ? <em>{t.part} › </em> : null}{t.title}</div>)}
                  </div>
                </div>
              )}

              {result.assessments.length > 0 && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={sectionHead}><ClipboardCheck size={16} style={{ color: '#ef4444' }} /> {result.assessments.length} prove / scadenze</div>
                  {checkbox('applyAssessments', 'Aggiungi a valutazione e scadenze del corso')}
                  {options.applyAssessments && checkbox('createAssessmentEvents', 'Crea gli eventi nel calendario per quelle con data', 'Se esiste già un evento dello stesso tipo nello stesso giorno viene solo collegato.')}
                  <div style={{ fontSize: '0.82rem' }}>
                    {result.assessments.map((a, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '2px 0' }}>
                        <span style={chip('rgba(239,68,68,0.12)', '#dc2626')}>{ASSESSMENT_LABELS[a.type]}</span>
                        <strong>{a.title}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {a.date ? `${a.date}${a.time ? ` ${a.time}` : ''}` : 'data da definire'}{a.weightPercent != null ? ` • ${a.weightPercent}%` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.overview || result.gradingSummary || result.studyPlan) && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={sectionHead}><AlignLeft size={16} style={{ color: '#0ea5e9' }} /> Informazioni generali</div>
                  {checkbox('applyTexts', 'Compila i campi vuoti della scheda del corso', 'I testi già presenti non vengono sovrascritti.')}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.gradingSummary && <div><strong>Valutazione:</strong> {result.gradingSummary}</div>}
                    {result.overview && <div><strong>Panoramica:</strong> {result.overview}</div>}
                    {result.studyPlan && <div><strong>Studio:</strong> {result.studyPlan}</div>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <Button variant="ghost" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={16} /> Carica altro file</Button>
              <Button variant="primary" onClick={handleApplyChanges} disabled={nothingSelected} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} /> Applica al corso
              </Button>
            </div>
          </>
        )}

        {step === 'success' && stats && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Corso aggiornato!</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7 }}>
              {stats.lessonsEnriched > 0 && <li><strong>{stats.lessonsEnriched}</strong> lezioni del calendario aggiornate con argomento e dettagli</li>}
              {stats.lessonsCreated > 0 && <li><strong>{stats.lessonsCreated}</strong> nuove lezioni aggiunte al calendario</li>}
              {stats.tasksUpdated > 0 && <li><strong>{stats.tasksUpdated}</strong> task di studio aggiornati</li>}
              {stats.topicsAdded > 0 && <li><strong>{stats.topicsAdded}</strong> argomenti aggiunti all'indice</li>}
              {stats.assessmentsAdded > 0 && <li><strong>{stats.assessmentsAdded}</strong> prove/scadenze aggiunte</li>}
              {stats.assessmentsUpdated > 0 && <li><strong>{stats.assessmentsUpdated}</strong> prove già note completate con nuovi dettagli</li>}
              {stats.assessmentEventsCreated > 0 && <li><strong>{stats.assessmentEventsCreated}</strong> eventi creati nel calendario</li>}
              {Object.values(stats).every(v => v === 0) && <li>Nessuna modifica necessaria: il corso era già aggiornato.</li>}
            </ul>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>I task delle lezioni future mostreranno l'argomento appena vengono generati.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={16} /> Analizza un altro documento</Button>
              <Button variant="primary" onClick={handleClose}>Chiudi</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
