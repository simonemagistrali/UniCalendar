import { useState, useEffect, useCallback, useMemo } from 'react';
import { ankiService } from '../../../core/anki';
import { Brain, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { getLatestSnapshot, getEffectiveSpeed, estimateMinutes } from '../../../core/ankiStats';
import './AnkiWidget.css';

export function AnkiWidget() {
    const preferences = useAppStore(s => s.preferences);
    const ankiHistory = useAppStore(s => s.ankiHistory);
    const recordAnkiSync = useAppStore(s => s.recordAnkiSync);

    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const latestSaved = useMemo(() => {
        return getLatestSnapshot(ankiHistory) || (ankiHistory.length > 0 ? ankiHistory[ankiHistory.length - 1] : null);
    }, [ankiHistory]);

    const speedInfo = useMemo(() => {
        return getEffectiveSpeed(ankiHistory, preferences);
    }, [ankiHistory, preferences]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const snapshotData = await ankiService.fetchFullSnapshot();
            if (!snapshotData) {
                setIsConnected(false);
                setIsLoading(false);
                return;
            }

            setIsConnected(true);

            // Calcolo tempo stimato con carte nuove + ripasso
            const estMinutes = estimateMinutes(snapshotData.today, speedInfo.seconds);

            const completeSnapshot = {
                ...snapshotData.today,
                estimatedMinutes: estMinutes,
                collectionAvgSeconds: snapshotData.collectionAvgSeconds ?? undefined,
            };

            recordAnkiSync(completeSnapshot, snapshotData.reviewsByDay);
        } catch {
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    }, [recordAnkiSync, speedInfo.seconds]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 45 * 1000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const reviewCards = (latestSaved?.reviewDue ?? 0) + (latestSaved?.learnDue ?? 0);
    const newCards = latestSaved?.newToday ?? latestSaved?.newTotal ?? 0;
    const totalCards = (latestSaved?.remaining !== undefined && latestSaved.remaining > 0)
        ? Math.max(latestSaved.remaining, reviewCards + newCards)
        : (reviewCards + newCards);

    const estimatedTimeMinutes = latestSaved?.estimatedMinutes
        ?? estimateMinutes({ remaining: totalCards, reviewDue: latestSaved?.reviewDue, learnDue: latestSaved?.learnDue, newToday: newCards }, speedInfo.seconds);

    const studiedToday = latestSaved?.studied ?? 0;
    const hasData = latestSaved !== null;

    return (
        <div className="anki-widget">
            <div className="anki-widget-header">
                <div className="anki-widget-title">
                    <div className="anki-icon-wrapper">
                        <Brain className="anki-icon" size={20} />
                    </div>
                    <h3>Anki Spaced Repetition</h3>
                </div>
                <div className="anki-actions">
                    <span 
                        className={`anki-status-dot ${isConnected ? 'online' : hasData ? 'offline' : 'offline'}`} 
                        title={isConnected ? 'Connesso ad Anki Desktop' : hasData ? 'Offline (dati salvati disponibili)' : 'Disconnesso'}
                    ></span>
                    <button 
                        className="anki-refresh-btn" 
                        onClick={fetchData} 
                        disabled={isLoading}
                        title="Aggiorna dati Anki"
                    >
                        <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            <div className="anki-widget-body">
                {isConnected === null && isLoading && !hasData ? (
                    <div className="anki-widget-message loading">
                        <RefreshCw size={24} className="spinning text-muted" />
                        <p>Connessione ad AnkiConnect...</p>
                    </div>
                ) : isConnected === false && !hasData ? (
                    <div className="anki-widget-message error">
                        <AlertCircle size={32} className="text-error mb-2" />
                        <p className="font-semibold">Anki non raggiungibile</p>
                        <span className="text-sm text-muted text-center mt-1">
                            Assicurati che Anki sia aperto sul PC con l'add-on AnkiConnect (codice: 2055492159).
                        </span>
                    </div>
                ) : (
                    <div className="anki-widget-stats">
                        <div className="anki-stat-card primary">
                            <span className="anki-stat-value">{totalCards}</span>
                            <span className="anki-stat-label">Carte da Fare Oggi</span>
                            <div className="anki-stat-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                                <span>{reviewCards} ripasso + {newCards} nuove</span>
                            </div>
                            {totalCards > 0 && (
                                <div className="anki-stat-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                                    <Clock size={12} />
                                    <span>~{estimatedTimeMinutes} min stimati ({speedInfo.seconds.toFixed(1)}s/c)</span>
                                </div>
                            )}
                        </div>

                        <div className="anki-stat-card secondary">
                            <div className="anki-stat-value-group">
                                <CheckCircle2 size={24} className="text-success" />
                                <span className="anki-stat-value">{studiedToday}</span>
                            </div>
                            <span className="anki-stat-label">Studiate Oggi</span>
                            {!isConnected && hasData && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    (ultimo sync salvato)
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
