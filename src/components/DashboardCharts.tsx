import { Deal } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatCurrency } from '../utils';

interface DashboardChartsProps {
  deals: Deal[];
}

export function DashboardCharts({ deals }: DashboardChartsProps) {
  // Process data for Bar Chart (Pipeline Value per AM Cisco)
  const amDataMap = deals.reduce((acc, deal) => {
    if (!acc[deal.AM_Cisco]) {
      acc[deal.AM_Cisco] = 0;
    }
    acc[deal.AM_Cisco] += deal.Value_Net;
    return acc;
  }, {} as Record<string, number>);

  const amData = Object.keys(amDataMap)
    .map((am) => ({ name: am, value: amDataMap[am] }))
    .sort((a, b) => b.value - a.value);

  // Process data for Donut Chart (Distribution by Archi)
  const archiDataMap = deals.reduce((acc, deal) => {
    if (!acc[deal.Archi]) {
      acc[deal.Archi] = 0;
    }
    acc[deal.Archi] += deal.Value_Net; 
    return acc;
  }, {} as Record<string, number>);

  const archiData = Object.keys(archiDataMap)
    .map((archi) => ({ name: archi, value: archiDataMap[archi] }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#049fd9', '#0d274d', '#4ba44b', '#f9a826', '#e04c4c', '#8e44ad'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 shadow-lg rounded-md outline-none">
          <p className="font-semibold text-sm mb-1">{label || payload[0].name}</p>
          <p className="text-sm text-gray-700">
            Value: <span className="font-medium text-slate-900">{formatCurrency(payload[0].value)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Bar Chart */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Pipeline by AM Cisco</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={amData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} dy={10} />
              <YAxis 
                tickFormatter={(val) => `$${val / 1000}k`} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 13 }} 
              />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#049fd9" radius={[4, 4, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Architecture Distribution</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={archiData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {archiData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px' }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
