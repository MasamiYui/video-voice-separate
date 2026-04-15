import { startTransition, useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { atomicToolsApi } from '../api/atomic-tools'
import type { ArtifactInfo, AtomicJob, FileUploadResponse } from '../types/atomic-tools'

interface UseAtomicToolOptions {
  toolId: string
  pollInterval?: number
}

interface UseAtomicToolReturn {
  uploadedFiles: FileUploadResponse[]
  uploadFile: (file: File) => Promise<FileUploadResponse>
  uploadProgress: number
  isUploading: boolean
  job: AtomicJob | null
  runTool: (params: Record<string, unknown>) => Promise<void>
  isRunning: boolean
  artifacts: ArtifactInfo[]
  getDownloadUrl: (filename: string) => string
  errorMessage: string | null
  reset: () => void
}

export function useAtomicTool({
  toolId,
  pollInterval = 1000,
}: UseAtomicToolOptions): UseAtomicToolReturn {
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadResponse[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [job, setJob] = useState<AtomicJob | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => atomicToolsApi.upload(file, percent => setUploadProgress(percent)),
    onSuccess: data => {
      startTransition(() => {
        setUploadedFiles(prev => [...prev, data])
        setErrorMessage(null)
        setUploadProgress(100)
      })
    },
    onError: error => {
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
    },
  })

  const runMutation = useMutation({
    mutationFn: (params: Record<string, unknown>) => atomicToolsApi.run(toolId, params),
    onSuccess: data => {
      startTransition(() => {
        setJob(data)
        setArtifacts([])
        setErrorMessage(null)
      })
    },
    onError: error => {
      setErrorMessage(error instanceof Error ? error.message : 'Run failed')
    },
  })

  const jobQuery = useQuery({
    queryKey: ['atomic-tool-job', toolId, job?.job_id],
    queryFn: () => atomicToolsApi.getJob(toolId, job?.job_id ?? ''),
    enabled:
      job?.job_id != null &&
      job.status !== 'completed' &&
      job.status !== 'failed',
    refetchInterval: pollInterval,
    retry: false,
  })

  useEffect(() => {
    if (jobQuery.data) {
      startTransition(() => {
        setJob(jobQuery.data)
      })
    }
  }, [jobQuery.data])

  useEffect(() => {
    if (job?.status !== 'completed') return

    let cancelled = false
    atomicToolsApi
      .listArtifacts(toolId, job.job_id)
      .then(data => {
        if (!cancelled) {
          startTransition(() => {
            setArtifacts(data)
          })
        }
      })
      .catch(error => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Artifact loading failed')
        }
      })

    return () => {
      cancelled = true
    }
  }, [job?.job_id, job?.status, toolId])

  return {
    uploadedFiles,
    uploadFile: async (file: File) => uploadMutation.mutateAsync(file),
    uploadProgress,
    isUploading: uploadMutation.isPending,
    job,
    runTool: async (params: Record<string, unknown>) => {
      await runMutation.mutateAsync(params)
    },
    isRunning:
      runMutation.isPending ||
      job?.status === 'pending' ||
      job?.status === 'running',
    artifacts,
    getDownloadUrl: (filename: string) =>
      job ? atomicToolsApi.getArtifactUrl(toolId, job.job_id, filename) : '',
    errorMessage,
    reset: () => {
      setUploadedFiles([])
      setUploadProgress(0)
      setJob(null)
      setArtifacts([])
      setErrorMessage(null)
    },
  }
}
