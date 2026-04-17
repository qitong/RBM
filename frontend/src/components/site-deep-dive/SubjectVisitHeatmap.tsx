function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0
  return h >>> 0
}

function pickColor(seed: number): string {
  const r = seed % 100
  if (r < 70) return 'bg-emerald-200'
  if (r < 90) return 'bg-amber-300'
  return 'bg-red-400'
}

export default function SubjectVisitHeatmap({ siteId, subjects = 12, visits = 10 }: { siteId: string; subjects?: number; visits?: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">{'\u53D7\u8BD5\u8005 \u00D7 \u8BBF\u89C6'}</p>
      <div className="overflow-x-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${visits}, minmax(28px, 1fr))` }}>
          <div></div>
          {Array.from({ length: visits }).map((_, v) => (
            <div key={v} className="text-[10px] text-slate-500 text-center">V{v + 1}</div>
          ))}
          {Array.from({ length: subjects }).map((_, s) => (
            <div key={`row-${s}`} className="contents">
              <div className="text-[10px] text-slate-500">S{s + 1}</div>
              {Array.from({ length: visits }).map((_, v) => {
                const seed = hash(`${siteId}-${s}-${v}`)
                return <div key={`${s}-${v}`} data-cell="" className={`h-6 rounded ${pickColor(seed)}`} title={`S${s + 1} V${v + 1}`} />
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
