import { useNavigate } from 'react-router-dom'
import { saveAtomicToolPrefill, type AtomicToolPrefill } from '../../lib/atomicToolPrefill'

interface CrossToolActionProps {
  label: string
  targetToolId: string
  payload: AtomicToolPrefill
}

export function CrossToolAction({ label, targetToolId, payload }: CrossToolActionProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
      onClick={() => {
        const key = saveAtomicToolPrefill(payload)
        navigate(`/tools/${targetToolId}?prefill=${encodeURIComponent(key)}`)
      }}
    >
      {label}
    </button>
  )
}
