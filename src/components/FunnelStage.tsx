import { Deal } from '../types';

interface FunnelStageProps {
  deals: Deal[];
}

export function FunnelStage({ deals }: FunnelStageProps) {
  const stages = [0, 10, 25, 50, 75, 90, 100];
  
  const stageCounts = stages.map((stage) => ({
    stage,
    count: deals.filter((d) => d.Stage === stage).length,
  }));

  const maxCount = Math.max(...stageCounts.map((s) => s.count), 1);

  const getStageColor = (stage: number) => {
    switch (stage) {
      case 0: return 'bg-gray-400';
      case 10: return 'bg-red-500';
      case 25: return 'bg-orange-500';
      case 50: return 'bg-yellow-400';
      case 75: return 'bg-blue-500';
      case 90: return 'bg-emerald-400';
      case 100: return 'bg-green-600';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
      <h3 className="text-base font-semibold text-slate-800 mb-6">Pipeline Funnel (Count)</h3>
      <div className="flex flex-col items-center gap-2">
        {stageCounts.map((s, index) => {
          // Calculate width based on a funnel shape, but adjusted slightly by count weighting
          // Base width decreases continuously to look like a funnel
          const baseWidthPercent = 100 - (index * 12); 
          const countIndicator = s.count > 0 ? (s.count / maxCount) * 100 : 0;
          
          return (
            <div key={s.stage} className="w-full flex items-center justify-center group">
              <div 
                className="relative h-10 flex items-center justify-center transition-all duration-300 rounded-sm"
                style={{ width: `${baseWidthPercent}%` }}
              >
                <div 
                  className={`absolute inset-0 opacity-20 ${getStageColor(s.stage)}`}
                  style={{ borderRadius: '2px' }}
                />
                
                {/* Visual fill based on count percentage relative to max in current view */}
                <div 
                  className={`absolute left-1/2 -translate-x-1/2 h-full ${getStageColor(s.stage)} transition-all duration-500 z-10 ease-out`}
                  style={{ width: `${countIndicator}%`, minWidth: s.count > 0 ? '4px' : '0px', borderRadius: '2px' }}
                />
                
                <div className="z-20 text-xs font-semibold px-2 text-slate-800 drop-shadow-sm flex items-center gap-2 w-full justify-center">
                  <span className="opacity-70 w-12 text-right">{s.stage}%</span>
                  <span className="w-px h-3 bg-slate-300 opacity-50" />
                  <span className="w-12 text-left">{s.count} deals</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
