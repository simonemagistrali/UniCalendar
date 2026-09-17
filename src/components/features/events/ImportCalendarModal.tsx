import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { parseICS, parseCSV, fetchCalendarFromURL } from '../../../core/ICSParser';
import { TaskManager } from '../../../core/TaskManager';
import { Upload, Link, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCalendarModal({ isOpen, onClose }: ImportCalendarModalProps) {
  const addEvents = useAppStore(s => s.addEvents);
  const addCourse = useAppStore(s => s.addCourse);
  const courses = useAppStore(s => s.courses);

  const [isImporting, setIsImporting] = useState(false);
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<{ count: number; coursesFound: number } | null>(null);
  const [error, setError] = useState('');

  const processEvents = (events: ReturnType<typeof parseICS>) => {
    if (events.length === 0) {
      setError('Nessun evento trovato nel file.');
      setIsImporting(false);
      return;
    }

    // Auto-detect courses
    const detectedCourses = TaskManager.detectCoursesFromEvents(events, courses);
    for (const c of detectedCourses) {
      addCourse(c);
    }

    // Map detected courses to events
    const allCourses = [...courses, ...detectedCourses];
    const enriched = events.map(e => {
      if (e.type === 'lesson' && !e.courseId) {
        const titlePrefix = e.title.split(/[\s-–]+/).slice(0, 3).join(' ').trim().toLowerCase();
        const match = allCourses.find(c => c.name.toLowerCase() === titlePrefix);
        if (match) return { ...e, courseId: match.id };
      }
      return e;
    });

    addEvents(enriched);
    setResult({ count: enriched.length, coursesFound: detectedCourses.length });
    setIsImporting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const events = file.name.endsWith('.csv') ? parseCSV(text) : parseICS(text);
        processEvents(events);
      } catch {
        setError('Errore nel parsing del file. Verifica il formato.');
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
    setResult(null);

    try {
      const events = await fetchCalendarFromURL(url.trim());
      processEvents(events);
    } catch {
      setError('Impossibile scaricare il calendario dall\'URL.');
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setUrl('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importa Calendario">
      <div className="import-modal">
        <p className="import-desc">
          Carica un file <strong>.ics</strong> o <strong>.csv</strong> dal portale della tua Università,
          oppure incolla un link di un calendario online.
        </p>

        {/* File Upload */}
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
            {isImporting ? 'Importazione...' : 'Scegli file .ics/.csv'}
          </label>
        </div>

        {/* Divider */}
        <div className="import-divider">
          <span>oppure</span>
        </div>

        {/* URL Import */}
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
              Importa
            </Button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="import-result import-success">
            <CheckCircle size={18} />
            <span>
              Importati <strong>{result.count}</strong> eventi
              {result.coursesFound > 0 && <> e rilevati <strong>{result.coursesFound}</strong> nuovi corsi</>}.
            </span>
          </div>
        )}

        {error && (
          <div className="import-result import-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
