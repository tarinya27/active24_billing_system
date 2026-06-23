export default function SummaryCard({ title, value, icon: Icon, trend, trendLabel, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    violet: 'from-violet-500 to-violet-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };

  return (
    <div className="glass-card group p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">{value}</p>
          {trend !== undefined && (
            <p className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel || 'vs last month'}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-xl bg-gradient-to-br ${colors[color]} p-3 text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
