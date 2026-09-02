import { computeKPIs } from './utils'

export default function KPICards({ report, transactions }) {
  const kpi = computeKPIs(report, transactions)

  const cards = [
    {
      id: 'teachers',
      title: 'Total Faculty',
      value: kpi.totalTeachers,
      desc: `${kpi.positiveBalances} positive · ${kpi.negativeBalances} negative balance`,
      badge: 'Active Roster',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      valueColor: 'text-slate-900',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      iconBg: 'bg-primary-50 text-primary-600 border border-primary-100',
    },
    {
      id: 'negative',
      title: 'Attention Required',
      value: kpi.negativeBalances,
      desc: kpi.negativeBalances > 0 ? `${kpi.negativeBalances} faculty with negative balance` : 'All faculty balances in good standing',
      badge: kpi.negativeBalances > 0 ? 'Requires Action' : 'All Healthy',
      badgeColor: kpi.negativeBalances > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      valueColor: kpi.negativeBalances > 0 ? 'text-rose-600' : 'text-emerald-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      iconBg: kpi.negativeBalances > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    },
    {
      id: 'today',
      title: "Today's Activity",
      value: kpi.todayActivity,
      desc: kpi.yesterdayActivity > 0
        ? `${kpi.todayActivity >= kpi.yesterdayActivity ? '↑' : '↓'} vs ${kpi.yesterdayActivity} yesterday`
        : 'Credit transactions recorded today',
      badge: 'Live Events',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      valueColor: 'text-slate-900',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    },
    {
      id: 'manual',
      title: 'Manual Adjustments',
      value: kpi.manualAdjustments,
      desc: 'Admin overrides and adjustments logged',
      badge: 'Audited',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      valueColor: 'text-slate-900',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        </svg>
      ),
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconBg}`}>
              {card.icon}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${card.badgeColor}`}>
              {card.badge}
            </span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.title}</p>
            <div className={`text-2xl font-bold font-mono tracking-tight mt-1 ${card.valueColor}`}>
              {card.value}
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">{card.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
