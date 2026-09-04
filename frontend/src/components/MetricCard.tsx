interface Props {
  label: string
  value: string | number
  hint?: string
}

export default function MetricCard({ label, value, hint }: Props) {
  return (
    <div className="rounded-lg border border-[#26302d] bg-[#121716] p-4">
      <p className="text-xs font-medium text-[#93a19a]">{label}</p>
      <p className="mt-1 text-2xl font-medium text-[#eef2ef]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-[#5c6a64]">{hint}</p>}
    </div>
  )
}