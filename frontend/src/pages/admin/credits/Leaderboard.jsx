import { useMemo } from 'react'
import { initialsOf, avatarColors } from './utils'

function Avatar({ name }) {
  const c = avatarColors(name)
  return (
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${c.bg} ${c.text}`}>
      {initialsOf(name)}
    </div>
  )
}

export default function Leaderboard({ report }) {
  const ranked = useMemo(() => {
    return [...report]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
      }))
  }, [report])

  if (ranked.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          Faculty Credit Ranking
        </h2>
        <p className="text-xs text-slate-400 text-center py-8">No ranking data available.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Top Credit Earners
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Faculty with highest accumulated balances</p>
          </div>
          <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-slate-200">
            Top 5
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {ranked.map((teacher) => {
            const isTop3 = teacher.rank <= 3
            const rankBadge = teacher.rank === 1
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : teacher.rank === 2
              ? 'bg-slate-200 text-slate-700 border-slate-300'
              : teacher.rank === 3
              ? 'bg-amber-50 text-amber-700 border-amber-200/60'
              : 'bg-slate-100 text-slate-500 border-slate-200'

            return (
              <div
                key={teacher.teacher_id}
                className="flex items-center justify-between py-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold border ${rankBadge} shrink-0`}>
                    {teacher.rank}
                  </span>
                  <Avatar name={teacher.name} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{teacher.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{teacher.department || 'General Faculty'}</p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-md ${
                    teacher.balance > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {teacher.balance > 0 ? '+' : ''}{teacher.balance} credits
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

