import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function EfficiencyDashboard() {
  const tasks = useAppStore(state => state.tasks);

  // Compute stats based on done tasks vs estimated
  const doneTasks = tasks.filter(t => t.status === 'done');
  let efficiencyScore = 86; // Base mock
  
  if (doneTasks.length > 0) {
    const totalEstimated = doneTasks.reduce((acc, t) => acc + t.estimatedDuration, 0);
    const totalActual = doneTasks.reduce((acc, t) => acc + (t.actualDuration || t.estimatedDuration), 0);
    // if actual < estimated -> higher efficiency.
    efficiencyScore = Math.min(100, Math.round((totalEstimated / totalActual) * 100));
  }

  const barData = {
    labels: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
    datasets: [
      {
        label: 'Tempo Stimato (h)',
        data: [2, 3, 2, 4, 3, 1, 0],
        backgroundColor: 'rgba(209, 213, 219, 0.5)',
      },
      {
        label: 'Tempo Reale (h)',
        data: [2, 2.5, 2.2, 4, 2.5, 0.5, 0],
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
      },
    ],
  };

  const lineData = {
    labels: ['Sett 1', 'Sett 2', 'Sett 3', 'Sett 4'],
    datasets: [
      {
        label: 'Efficienza (%)',
        data: [75, 80, 78, efficiencyScore],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-1">SCORE DI EFFICIENZA</h3>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[var(--accent-primary)]">{efficiencyScore}%</span>
              <span className="text-sm font-medium mb-1 text-[var(--accent-success)] bg-[#e6f4ea] px-2 py-0.5 rounded-full">+2%</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Stai rispettando le stime meglio della settimana scorsa. Continua così!</p>
      </GlassPanel>

      <GlassPanel className="h-[250px]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Tempo Stimato vs Reale</h3>
        <div className="h-[180px]">
          <Bar data={barData} options={options} />
        </div>
      </GlassPanel>

      <GlassPanel className="h-[250px]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Andamento Mensile</h3>
        <div className="h-[180px]">
          <Line data={lineData} options={options} />
        </div>
      </GlassPanel>
    </div>
  );
}
