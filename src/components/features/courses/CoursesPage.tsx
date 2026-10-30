import { useState, useEffect } from 'react';
import { Plus, Sparkles, BookOpen, Calendar, ClipboardCheck, Settings, GraduationCap, Check } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { Course } from '../../../core/types';
import { GlassPanel } from '../../ui/GlassPanel';
import { CourseOverviewTab } from './CourseOverviewTab';
import { CourseAssessmentsTab } from './CourseAssessmentsTab';
import { CourseTopicsTab } from './CourseTopicsTab';
import { CourseCalendarTab } from './CourseCalendarTab';
import { CourseSettingsTab } from './CourseSettingsTab';
import { ImportSyllabusModal } from '../events/ImportSyllabusModal';
import './CoursesPage.css';

type Tab = 'overview' | 'calendar' | 'assessments' | 'topics' | 'settings';

export function CoursesPage() {
  const courses = useAppStore(s => s.courses);
  const addCourse = useAppStore(s => s.addCourse);
  const repairCourses = useAppStore(s => s.repairCourses);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => courses[0]?.id || '');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [repairMsg, setRepairMsg] = useState<string | null>(null);

  useEffect(() => {
    if (courses.length > 0 && (!activeCourseId || !courses.some(c => c.id === activeCourseId))) {
      setActiveCourseId(courses[0].id);
    }
  }, [courses, activeCourseId]);

  const activeCourse = courses.find(c => c.id === activeCourseId) || courses[0];

  const handleCreateCourse = () => {
    if (!newCourseName.trim()) return;
    const newCourse: Course = {
      id: `course-${Date.now()}`,
      name: newCourseName.trim(),
      difficulty: 6,
      color: '#3b82f6',
      defaultStudyPreferences: {
        requiresNotesRevision: true,
        requiresExercises: true,
        estimatedRevisionTimePerLesson: 60,
      },
      isCustomName: true,
    };
    addCourse(newCourse);
    setActiveCourseId(newCourse.id);
    setNewCourseName('');
    setIsCreatingNew(false);
    setActiveTab('overview');
  };

  const handleRepair = () => {
    const res = repairCourses();
    setRepairMsg(res.changed ? 'Doppioni rimossi e corsi unificati!' : 'Tutti i corsi sono corretti');
    setTimeout(() => setRepairMsg(null), 3000);
  };

  return (
    <div className="courses-page-container">
      <div className="cp-layout">
        {/* Left Column: Course List / Navigator */}
        <GlassPanel className="cp-list">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              I Tuoi Corsi ({courses.length})
            </span>
            <button
              className="cp-icon-btn"
              title="Unifica e ripara doppioni"
              onClick={handleRepair}
              style={{ fontSize: '0.75rem' }}
            >
              <Sparkles size={14} />
            </button>
          </div>

          {repairMsg && (
            <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(24,128,56,0.12)', color: '#188038', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={12} /> {repairMsg}
            </div>
          )}

          {courses.map(c => {
            const isActive = activeCourse?.id === c.id;
            const lessonCount = c.info?.lessonPlan?.length || 0;
            const topicCount = c.info?.topics?.length || 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`cp-list-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveCourseId(c.id);
                  setIsCreatingNew(false);
                }}
              >
                <span className="cp-dot" style={{ backgroundColor: c.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cp-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </div>
                  <div className="cp-item-sub">
                    {lessonCount > 0 ? `${lessonCount} lezioni` : 'Nessuna lezione'}
                    {topicCount > 0 ? ` • ${topicCount} argomenti` : ''}
                  </div>
                </div>
              </button>
            );
          })}

          {!isCreatingNew ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreatingNew(true)}
              style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={15} /> Nuovo Corso
            </button>
          ) : (
            <div style={{ padding: 8, background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <input
                className="cp-input"
                type="text"
                autoFocus
                value={newCourseName}
                onChange={e => setNewCourseName(e.target.value)}
                placeholder="Nome corso..."
                onKeyDown={e => e.key === 'Enter' && handleCreateCourse()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" onClick={handleCreateCourse} style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}>
                  Crea
                </button>
                <button className="btn btn-ghost" onClick={() => setIsCreatingNew(false)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </GlassPanel>

        {/* Right Column: Active Course Details & Tabs */}
        <div style={{ minWidth: 0 }}>
          {activeCourse ? (
            <GlassPanel className="cp-detail">
              <div className="cp-header">
                <span className="cp-dot-lg" style={{ backgroundColor: activeCourse.color }} />
                <h2>{activeCourse.name}</h2>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsAiModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Sparkles size={16} /> Importa con AI
                </button>
              </div>

              {/* Sub-navigation tabs */}
              <div className="cp-tabs">
                <button
                  type="button"
                  className={`cp-tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <GraduationCap size={16} /> Panoramica
                </button>
                <button
                  type="button"
                  className={`cp-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('calendar')}
                >
                  <Calendar size={16} /> Calendario Materia ({activeCourse.info?.lessonPlan?.length || 0})
                </button>
                <button
                  type="button"
                  className={`cp-tab ${activeTab === 'assessments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('assessments')}
                >
                  <ClipboardCheck size={16} /> Prove & Scadenze ({activeCourse.info?.assessments?.length || 0})
                </button>
                <button
                  type="button"
                  className={`cp-tab ${activeTab === 'topics' ? 'active' : ''}`}
                  onClick={() => setActiveTab('topics')}
                >
                  <BookOpen size={16} /> Indice Argomenti ({activeCourse.info?.topics?.length || 0})
                </button>
                <button
                  type="button"
                  className={`cp-tab ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings size={16} /> Impostazioni Corso
                </button>
              </div>

              {/* Active Tab View */}
              <div style={{ marginTop: 4 }}>
                {activeTab === 'overview' && (
                  <CourseOverviewTab
                    course={activeCourse}
                    onAnalyze={() => setIsAiModalOpen(true)}
                  />
                )}
                {activeTab === 'calendar' && (
                  <CourseCalendarTab course={activeCourse} />
                )}
                {activeTab === 'assessments' && (
                  <CourseAssessmentsTab course={activeCourse} />
                )}
                {activeTab === 'topics' && (
                  <CourseTopicsTab course={activeCourse} />
                )}
                {activeTab === 'settings' && (
                  <CourseSettingsTab
                    course={activeCourse}
                    onDeleted={() => {
                      const remaining = courses.filter(c => c.id !== activeCourse.id);
                      if (remaining.length > 0) setActiveCourseId(remaining[0].id);
                    }}
                  />
                )}
              </div>
            </GlassPanel>
          ) : (
            <GlassPanel style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <h3>Nessun corso presente</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Crea il tuo primo corso per gestirne le lezioni, l'indice degli argomenti e le valutazioni.
              </p>
              <button className="btn btn-primary" onClick={() => setIsCreatingNew(true)} style={{ marginTop: 12 }}>
                <Plus size={16} /> Crea Corso
              </button>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* AI Extraction Modal for active course */}
      <ImportSyllabusModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialCourseId={activeCourse?.id}
      />
    </div>
  );
}

