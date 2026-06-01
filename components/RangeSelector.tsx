import Link from 'next/link'

const RANGES = [
  { label: '4W',  value: '4w'  },
  { label: '12W', value: '12w' },
  { label: '6M',  value: '6m'  },
  { label: '1Y',  value: '1y'  },
  { label: 'All', value: 'all' },
]

export default function RangeSelector({ range }: { range: string }) {
  return (
    <div className="flex gap-1 ml-auto">
      {RANGES.map(r => (
        <Link
          key={r.value}
          href={`/stats?range=${r.value}`}
          scroll={false}
          prefetch={false}
          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
            range === r.value
              ? 'bg-gray-900 text-white'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  )
}
