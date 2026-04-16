import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ToolListPage } from '../../pages/ToolListPage'

const apiMocks = vi.hoisted(() => ({
  listTools: vi.fn(),
}))

vi.mock('../../api/atomic-tools', () => ({
  atomicToolsApi: apiMocks,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    )
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ToolListPage', () => {
  it('renders grouped tool cards from the backend registry', async () => {
    apiMocks.listTools.mockResolvedValue([
      {
        tool_id: 'separation',
        name_zh: '人声/背景分离',
        name_en: 'Audio Separation',
        description_zh: '分离人声与背景',
        description_en: 'Separate voice and background',
        category: 'audio',
        icon: 'AudioLines',
        accept_formats: ['.mp4'],
        max_file_size_mb: 500,
        max_files: 1,
      },
      {
        tool_id: 'probe',
        name_zh: '媒体信息探测',
        name_en: 'Media Probe',
        description_zh: '查看媒体参数',
        description_en: 'Inspect media info',
        category: 'video',
        icon: 'ScanSearch',
        accept_formats: ['.mp4'],
        max_file_size_mb: 2000,
        max_files: 1,
      },
    ])

    render(<ToolListPage />, { wrapper: createWrapper() })

    expect(await screen.findByRole('heading', { name: '原子工具集' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /人声\/背景分离/i })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /媒体信息探测/i })).toBeInTheDocument()
  })
})
