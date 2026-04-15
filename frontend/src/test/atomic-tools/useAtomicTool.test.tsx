import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAtomicTool } from '../../hooks/useAtomicTool'

const apiMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  run: vi.fn(),
  getJob: vi.fn(),
  listArtifacts: vi.fn(),
  getArtifactUrl: vi.fn(),
}))

vi.mock('../../api/atomic-tools', () => ({
  atomicToolsApi: apiMocks,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAtomicTool', () => {
  it('uploads a file, polls job status, and loads artifacts after completion', async () => {
    apiMocks.upload.mockResolvedValue({
      file_id: 'file-1',
      filename: 'demo.mp4',
      size_bytes: 128,
      content_type: 'video/mp4',
    })
    apiMocks.run.mockResolvedValue({
      job_id: 'job-1',
      tool_id: 'probe',
      status: 'pending',
      progress_percent: 0,
      current_step: null,
      created_at: '2026-04-16T08:00:00Z',
      started_at: null,
      finished_at: null,
      elapsed_sec: null,
      error_message: null,
      result: null,
    })
    apiMocks.getJob
      .mockResolvedValueOnce({
        job_id: 'job-1',
        tool_id: 'probe',
        status: 'running',
        progress_percent: 55,
        current_step: 'probing',
        created_at: '2026-04-16T08:00:00Z',
        started_at: '2026-04-16T08:00:01Z',
        finished_at: null,
        elapsed_sec: 1.2,
        error_message: null,
        result: null,
      })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        tool_id: 'probe',
        status: 'completed',
        progress_percent: 100,
        current_step: 'completed',
        created_at: '2026-04-16T08:00:00Z',
        started_at: '2026-04-16T08:00:01Z',
        finished_at: '2026-04-16T08:00:02Z',
        elapsed_sec: 2.0,
        error_message: null,
        result: { format_name: 'mp4' },
      })
    apiMocks.listArtifacts.mockResolvedValue([
      {
        filename: 'probe.json',
        size_bytes: 64,
        content_type: 'application/json',
        download_url: '/api/atomic-tools/probe/jobs/job-1/artifacts/probe.json',
        file_id: 'artifact-1',
      },
    ])
    apiMocks.getArtifactUrl.mockReturnValue('/api/atomic-tools/probe/jobs/job-1/artifacts/probe.json')

    const { result } = renderHook(() => useAtomicTool({ toolId: 'probe', pollInterval: 10 }), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.uploadFile(new File(['demo'], 'demo.mp4', { type: 'video/mp4' }))
    })

    await act(async () => {
      await result.current.runTool({ file_id: 'file-1' })
    })

    await waitFor(() => expect(result.current.job?.status).toBe('completed'))
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1))

    expect(result.current.uploadedFiles[0].file_id).toBe('file-1')
    expect(result.current.artifacts[0].file_id).toBe('artifact-1')
    expect(result.current.getDownloadUrl('probe.json')).toContain('probe.json')
  })
})
