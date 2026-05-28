import React from 'react';
import { Deal } from '../types';
import { formatCurrency } from '../utils';
import { Target, ListChecks, TrendingUp, Trophy } from 'lucide-react';

interface SummaryCardsProps {
  deals: Deal[];
}

export function SummaryCards({ deals }: SummaryCardsProps) {
  const totalPipelineValue = deals.reduce((sum, deal) => sum + deal.Value_Net, 0);
  const totalDeals = deals.length;
  const weightedForecast = deals.reduce(
    (sum, deal) => sum + deal.Value_Net * (deal.Stage / 100),
    0
  );
  const stage100Deals = deals.filter((d) => d.Stage === 100).length;
  const winRate = totalDeals > 0 ? Math.round((stage100Deals / totalDeals) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card
        title="Total Pipeline Value"
        value={formatCurrency(totalPipelineValue)}
        icon={<Target className="w-5 h-5 text-cisco-blue" />}
      />
      <Card
        title="Total Deals"
        value={totalDeals.toString()}
        icon={<ListChecks className="w-5 h-5 text-cisco-blue" />}
      />
      <Card
        title="Weighted Forecast"
        value={formatCurrency(weightedForecast)}
        icon={<TrendingUp className="w-5 h-5 text-cisco-blue" />}
      />
      <Card
        title="Win Rate"
        value={`${winRate}%`}
        icon={<Trophy className="w-5 h-5 text-cisco-blue" />}
      />
    </div>
  );
}

function Card({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className="p-2 bg-blue-50 rounded-md">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
