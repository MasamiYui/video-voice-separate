import { UploadCloud } from 'lucide-react'
import type { FileUploadResponse } from '../../types/atomic-tools'

interface FileUploadZoneProps {
  label: string
  hint: string
  accept: string
  value: FileUploadResponse | null
  onFileSelected: (file: File) => Promise<void> | void
  disabled?: boolean
}

export function FileUploadZone({
  label,
  hint,
  accept,
  value,
  onFileSelected,
  disabled = false,
}: FileUploadZoneProps) {
  const inputId = `upload-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <label
        htmlFor={inputId}
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
      >
        <UploadCloud size={22} className="mb-3 text-slate-400" />
        <div className="text-sm font-medium text-slate-700">
          {value ? value.filename : label}
        </div>
        <div className="mt-1 text-xs text-slate-500">{hint}</div>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-label={label}
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            void onFileSelected(file)
          }
        }}
      />
    </div>
  )
}
