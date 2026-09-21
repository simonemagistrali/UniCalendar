import { useState, useEffect } from 'react';
import { ankiService } from '../../../core/anki';
import { Brain, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import './AnkiWidget.css';

export function AnkiWidget() {
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [dueCards, setDueCards] = useState<number>(0);
    const [studiedToday, setStudiedToday] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const connected = await ankiService.checkConnection();
            setIsConnected(connected);

            if (connected) {
                const due = await ankiService.getDueCardsCount();
                const studied = await ankiService.getStudiedTodayCount();
                setDueCards(due);
                setStudiedToday(studied);
            }
        } catch (e) {
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Option to refresh every 5 mins automatically
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

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
                    <span className={`anki-status-dot ${isConnected ? 'online' : 'offline'}`} title={isConnected ? 'Connesso' : 'Disconnesso'}></span>
                    <button 
                        className="anki-refresh-btn" 
                        onClick={fetchData} 
                        disabled={isLoading}
                        title="Aggiorna dati"
                    >
                        <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            <div className="anki-widget-body">
                {isConnected === null && isLoading ? (
                    <div className="anki-widget-message loading">
                        <RefreshCw size={24} className="spinning text-muted" />
                        <p>Connessione ad AnkiConnect...</p>
                    </div>
                ) : isConnected === false ? (
                    <div className="anki-widget-message error">
                        <AlertCircle size={32} className="text-error mb-2" />
                        <p className="font-semibold">Anki non raggiungibile</p>
                        <span className="text-sm text-muted text-center mt-1">Assicurati che Anki sia aperto sul PC e che l'add-on AnkiConnect sia installato (codice: 2055492159).</span>
                    </div>
                ) : (
                    <div className="anki-widget-stats">
                        <div className="anki-stat-card primary">
                            <span className="anki-stat-value">{dueCards}</span>
                            <span className="anki-stat-label">Carte da Ripassare</span>
                        </div>
                        <div className="anki-stat-card secondary">
                            <div className="anki-stat-value-group">
                                <CheckCircle2 size={24} className="text-success" />
                                <span className="anki-stat-value">{studiedToday}</span>
                            </div>
                            <span className="anki-stat-label">Studiate Oggi</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
