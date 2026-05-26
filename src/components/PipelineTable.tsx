import { Deal, stageColors } from '../types';
import { formatCurrency } from '../utils';
import { Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

interface PipelineTableProps {
  deals: Deal[];
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
}

type SortField = keyof Deal | null;
type SortOrder = 'asc' | 'desc';

export function PipelineTable({ deals, onEdit, onDelete }: PipelineTableProps) {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: keyof Deal) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedDeals = [...deals].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const columns: { key: keyof Deal | 'actions'; label: string }[] = [
    { key: 'Product', label: 'BDM / Product Specialist' },
    { key: 'Enduser', label: 'Enduser' },
    { key: 'Partner', label: 'Partner' },
    { key: 'AM_Cisco', label: 'AM Cisco' },
    { key: 'DID', label: 'Deal ID' },
    { key: 'Estimate', label: 'Estimate ID' },
    { key: 'Disc', label: 'Disc %' },
    { key: 'Value_Net', label: 'Value Net' },
    { key: 'Archi', label: 'Archi' },
    { key: 'Stage', label: 'Stage %' },
    { key: 'Req_Masuk', label: 'Req. Masuk' },
    { key: 'Estimate_Close', label: 'Est. Close' },
    { key: 'PIC_Presales', label: 'PIC Presales' },
    { key: 'Remarks', label: 'Remarks' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 whitespace-nowrap">
          <thead className="text-xs text-slate-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium tracking-wider ${
                    col.key !== 'actions' ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''
                  }`}
                  onClick={() => col.key !== 'actions' && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.key !== 'actions' && <ArrowUpDown className="w-3 h-3 opacity-40 inline-block" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedDeals.length > 0 ? (
              sortedDeals.map((deal) => (
                <tr
                  key={deal.id}
                  className="bg-white border-b border-gray-100 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 border-r border-gray-50 max-w-[200px] truncate" title={deal.Product}>
                    {deal.Product}
                  </td>
                  <td className="px-4 py-3">{deal.Enduser}</td>
                  <td className="px-4 py-3">{deal.Partner}</td>
                  <td className="px-4 py-3">{deal.AM_Cisco}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{deal.DID}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{deal.Estimate}</td>
                  <td className="px-4 py-3 text-right">{deal.Disc}%</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 text-right">
                    {formatCurrency(deal.Value_Net)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded text-xs font-semibold border border-gray-200">
                      {deal.Archi}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        stageColors[deal.Stage] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {deal.Stage}%
                    </span>
                  </td>
                  <td className="px-4 py-3">{deal.Req_Masuk}</td>
                  <td className="px-4 py-3">{deal.Estimate_Close}</td>
                  <td className="px-4 py-3">{deal.PIC_Presales}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate text-gray-500" title={deal.Remarks}>
                    {deal.Remarks}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(deal)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-100 transition-colors tooltip"
                        title="Edit Deal"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(deal.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors tooltip"
                        title="Delete Deal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  No deals found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 p-3 text-xs text-gray-500 border-t border-gray-200 flex justify-between items-center">
        <span>Showing {sortedDeals.length} deals</span>
        <span className="italic">Click on column headers to sort</span>
      </div>
    </div>
  );
}
