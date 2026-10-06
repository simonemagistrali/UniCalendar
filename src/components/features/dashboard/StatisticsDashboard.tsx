import { useState, useEffect } from 'react';
import { EfficiencyDashboard } from './EfficiencyDashboard';
import { CatchUpAnalysisPage } from './CatchUpAnalysisPage';
import { BarChart2, TrendingUp } from 'lucide-react';

export function StatisticsDashboard() {
  const [activeTab, setActiveTab] = useState<'efficiency' | 'catchup'>(() => {
    return (localStorage.getItem('unicalendar_statsTab') as any) || 'efficiency';
  });

  useEffect(() => {
    localStorage.setItem('unicalendar_statsTab', activeTab);
  }, [activeTab]);

  return (
    <div className="statistics-dashboard" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
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
      </div>

      <div className="statistics-content">
        {activeTab === 'efficiency' ? <EfficiencyDashboard /> : <CatchUpAnalysisPage />}
      </div>
    </div>
  );
}
