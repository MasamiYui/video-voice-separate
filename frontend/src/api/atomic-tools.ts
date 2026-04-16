import api from './client'
import type { ArtifactInfo, AtomicJob, FileUploadResponse, ToolInfo } from '../types/atomic-tools'

export const atomicToolsApi = {
  listTools: () => api.get<ToolInfo[]>('/api/atomic-tools/tools').then(r => r.data),

  upload: (file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<FileUploadResponse>('/api/atomic-tools/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: event => {
          if (onProgress && event.total) {
            onProgress((event.loaded / event.total) * 100)
          }
        },
      })
      .then(r => r.data)
  },

  run: (toolId: string, params: Record<string, unknown>) =>
    api.post<AtomicJob>(`/api/atomic-tools/${toolId}/run`, params).then(r => r.data),

  getJob: (toolId: string, jobId: string) =>
    api.get<AtomicJob>(`/api/atomic-tools/${toolId}/jobs/${jobId}`).then(r => r.data),

  listArtifacts: (toolId: string, jobId: string) =>
    api.get<ArtifactInfo[]>(`/api/atomic-tools/${toolId}/jobs/${jobId}/artifacts`).then(r => r.data),

  getArtifactUrl: (toolId: string, jobId: string, filename: string) =>
    `/api/atomic-tools/${toolId}/jobs/${jobId}/artifacts/${encodeURIComponent(filename)}`,
}
