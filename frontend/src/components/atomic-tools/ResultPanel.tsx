import { Download, FileText } from 'lucide-react'
import { CrossToolAction } from './CrossToolAction'
import type { AtomicToolPrefill } from '../../lib/atomicToolPrefill'
import type { ArtifactInfo, AtomicJob } from '../../types/atomic-tools'

interface ResultPanelProps {
  toolId: string
  job: AtomicJob | null
  artifacts: ArtifactInfo[]
  getDownloadUrl: (filename: string) => string
}

export function ResultPanel({ toolId, job, artifacts, getDownloadUrl }: ResultPanelProps) {
  if (!job) return null

  const translatedText =
    typeof job.result?.translated_text === 'string' ? job.result.translated_text : null

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">结果</h3>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{job.status}</div>
      </div>

      {job.result && (
        <div className="rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
          <pre className="overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </div>
      )}

      {translatedText && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <FileText size={16} />
            翻译文本
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{translatedText}</p>
          <div className="mt-3">
            <CrossToolAction
              label="用于语音合成"
              targetToolId="tts"
              payload={{ text: translatedText }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {artifacts.map(artifact => (
          <div key={artifact.filename} className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{artifact.filename}</div>
                <div className="text-xs text-slate-500">{artifact.content_type}</div>
              </div>
              <a
                href={getDownloadUrl(artifact.filename)}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600"
              >
                <Download size={16} />
                下载
              </a>
            </div>

            {isAudioFile(artifact.filename, artifact.content_type) && (
              <audio controls className="w-full" src={getDownloadUrl(artifact.filename)} />
            )}

            {isVideoFile(artifact.filename, artifact.content_type) && (
              <video controls className="w-full rounded-xl" src={getDownloadUrl(artifact.filename)} />
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {buildArtifactActions(toolId, artifact, translatedText).map(action => (
                <CrossToolAction
                  key={`${artifact.filename}-${action.targetToolId}-${action.label}`}
                  label={action.label}
                  targetToolId={action.targetToolId}
                  payload={action.payload}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function isAudioFile(filename: string, contentType: string) {
  return contentType.startsWith('audio/') || /\.(wav|mp3|flac|m4a|aac|ogg)$/i.test(filename)
}

function isVideoFile(filename: string, contentType: string) {
  return contentType.startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(filename)
}

function buildArtifactActions(toolId: string, artifact: ArtifactInfo, translatedText: string | null) {
  const fileId = artifact.file_id ?? undefined
  if (!fileId) return []

  if (toolId === 'separation' && /^voice\./i.test(artifact.filename)) {
    return [
      buildArtifactAction('转到语音转文字', 'transcription', { files: { file: { file_id: fileId, filename: artifact.filename } } }),
      buildArtifactAction('转到音频混合', 'mixing', { files: { voice_file: { file_id: fileId, filename: artifact.filename } } }),
    ]
  }

  if (toolId === 'separation' && /^background\./i.test(artifact.filename)) {
    return [
      buildArtifactAction('转到音频混合', 'mixing', { files: { background_file: { file_id: fileId, filename: artifact.filename } } }),
    ]
  }

  if (toolId === 'transcription') {
    return [
      buildArtifactAction('转到文本翻译', 'translation', { files: { file: { file_id: fileId, filename: artifact.filename } } }),
    ]
  }

  if (toolId === 'tts') {
    return [
      buildArtifactAction('转到音频混合', 'mixing', { files: { voice_file: { file_id: fileId, filename: artifact.filename } } }),
      buildArtifactAction('转到音视频合并', 'muxing', { files: { audio_file: { file_id: fileId, filename: artifact.filename } } }),
    ]
  }

  if (toolId === 'mixing') {
    return [
      buildArtifactAction('转到音视频合并', 'muxing', { files: { audio_file: { file_id: fileId, filename: artifact.filename } } }),
    ]
  }

  if (toolId === 'translation' && translatedText) {
    return [buildArtifactAction('用于语音合成', 'tts', { text: translatedText })]
  }

  return []
}

function buildArtifactAction(label: string, targetToolId: string, payload: AtomicToolPrefill) {
  return { label, targetToolId, payload }
}
