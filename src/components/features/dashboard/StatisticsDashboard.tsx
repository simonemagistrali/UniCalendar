import { useState, useEffect } from 'react';
import { EfficiencyDashboard } from './EfficiencyDashboard';
import { CatchUpAnalysisPage } from './CatchUpAnalysisPage';
import { HabitProfilePanel } from './HabitProfilePanel';
import { BarChart2, TrendingUp, Brain } from 'lucide-react';
import { WeeklySummaryCard } from './WeeklySummaryCard';

export function StatisticsDashboard() {
  const [activeTab, setActiveTab] = useState<'efficiency' | 'catchup' | 'habits'>(() => {
    return (localStorage.getItem('unicalendar_statsTab') as any) || 'efficiency';
  });

  useEffect(() => {
    localStorage.setItem('unicalendar_statsTab', activeTab);
  }, [activeTab]);

  return (
    <div className="statistics-dashboard" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <WeeklySummaryCard />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('efficiency')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'efficiency' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'efficiency' ? 'white' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'efficiency' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          <BarChart2 size={18} />
          Rendimento (Passato)
        </button>
        <button
          onClick={() => setActiveTab('catchup')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'catchup' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'catchup' ? 'white' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'catchup' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          <TrendingUp size={18} />
          Previsioni (Futuro)
        </button>
        <button
          onClick={() => setActiveTab('habits')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'habits' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'habits' ? 'white' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: activeTab === 'habits' ? 600 : 400,
            transition: 'all 0.2s'
          }}
        >
          <Brain size={18} />
          Abitudini & Profilo (Adattivo)
        </button>
      </div>

      <div className="statistics-content">
        {activeTab === 'efficiency' ? (
          <EfficiencyDashboard />
        ) : activeTab === 'catchup' ? (
          <CatchUpAnalysisPage />
        ) : (
          <HabitProfilePanel />
        )}
      </div>
    </div>
  );
}
