import { useState, useEffect } from 'react';
import { Brain, RefreshCw, CheckCircle2, AlertCircle, Clock, BookOpen, Repeat, Zap } from 'lucide-react';
import { ankiService } from '../core/anki';
import { useAppStore } from '../store/useAppStore';
import { GlassPanel } from '../components/ui/GlassPanel';
import './AnkiDashboard.css';

export function AnkiDashboard() {
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [stats, setStats] = useState({
        dueCards: 0,
        reviewCards: 0,
        newCards: 0,
        learnCards: 0,
        studiedToday: 0
    });
    const [fetchedSpeed, setFetchedSpeed] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const preferences = useAppStore(s => s.preferences);
    const avgTimeSecs = fetchedSpeed || preferences.ankiAverageTimeSeconds || 15;
    
    const estimatedTimeMinutes = Math.ceil((stats.dueCards * avgTimeSecs) / 60);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const connected = await ankiService.checkConnection();
            setIsConnected(connected);

            if (connected) {
                const [due, review, newC, learn, studied, speed] = await Promise.all([
                    ankiService.getDueCardsCount(),
                    ankiService.getReviewCardsCount(),
                    ankiService.getNewCardsCount(),
                    ankiService.getLearnCardsCount(),
                    ankiService.getStudiedTodayCount(),
                    ankiService.getAverageTimeSeconds()
                ]);

                setStats({
                    dueCards: due,
                    reviewCards: review,
                    newCards: newC,
                    learnCards: learn,
                    studiedToday: studied
                });
                setFetchedSpeed(speed);
            }
        } catch (e) {
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="anki-dashboard-container">
            <div className="anki-header-section">
                <div className="anki-title-group">
                    <div className="anki-main-icon">
                        <Brain size={32} />
                    </div>
                    <div>
                        <h2>Anki Studio</h2>
                        <p className="text-muted">Monitora e gestisci le tue sessioni di ripasso spaziato</p>
                    </div>
                </div>
                <div className="anki-controls">
                    <div className={`connection-badge ${isConnected ? 'online' : 'offline'}`}>
                        <span className="dot"></span>
                        {isConnected ? 'Connesso' : 'Disconnesso'}
                    </div>
                    <button 
                        className="refresh-button" 
                        onClick={fetchData} 
                        disabled={isLoading}
                    >
                        <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
                        Aggiorna
                    </button>
                </div>
            </div>

            {isConnected === null && isLoading ? (
                <div className="anki-state-message loading">
                    <RefreshCw size={32} className="spinning text-muted mb-4" />
                    <p>Sincronizzazione con AnkiConnect in corso...</p>
                </div>
            ) : isConnected === false ? (
                <div className="anki-state-message error">
                    <AlertCircle size={48} className="text-error mb-4" />
                    <h3>Anki non raggiungibile</h3>
                    <p>Assicurati che l'app desktop Anki sia aperta e che l'add-on AnkiConnect sia in esecuzione.</p>
                </div>
            ) : (
                <div className="anki-stats-grid">
                    {/* Statistiche Principali */}
                    <GlassPanel className="stat-card accent-blue">
                        <div className="stat-icon-wrapper">
                            <Repeat size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.reviewCards + stats.learnCards}</span>
                            <span className="stat-label">Carte da Ripassare</span>
                            <span className="stat-sublabel">Review + Learning</span>
                        </div>
                    </GlassPanel>

                    <GlassPanel className="stat-card accent-purple">
                        <div className="stat-icon-wrapper">
                            <BookOpen size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{stats.newCards}</span>
                            <span className="stat-label">Carte Nuove</span>
                            <span className="stat-sublabel">Da studiare per la prima volta</span>
                        </div>
                    </GlassPanel>

                    <GlassPanel className="stat-card accent-orange">
                        <div className="stat-icon-wrapper">
                            <Clock size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{estimatedTimeMinutes} <span className="text-sm">min</span></span>
                            <span className="stat-label">Tempo Previsto Oggi</span>
                            <span className="stat-sublabel">Per completare le {stats.dueCards} carte in coda</span>
                        </div>
                    </GlassPanel>

                    <GlassPanel className="stat-card accent-green">
                        <div className="stat-icon-wrapper">
                            <Zap size={24} />
                        </div>
                        <div className="stat-content">
                            <span className="stat-value">{avgTimeSecs.toFixed(1)} <span className="text-sm">s</span></span>
                            <span className="stat-label">Velocità Media</span>
                            <span className="stat-sublabel">
                                {fetchedSpeed ? 'Rilevata automaticamente da Anki' : 'Stima manuale dalle impostazioni'}
                            </span>
                        </div>
                    </GlassPanel>

                    <GlassPanel className="stat-card accent-teal" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                <CheckCircle2 size={28} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Progressi di Oggi</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Hai studiato {stats.studiedToday} carte oggi. Ottimo lavoro!</p>
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                            {stats.studiedToday}
                        </div>
                    </GlassPanel>
                </div>
            )}
        </div>
    );
}
