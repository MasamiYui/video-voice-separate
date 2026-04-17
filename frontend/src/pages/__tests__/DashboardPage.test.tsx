import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_CONTENT_MAX_WIDTH } from '../../components/layout/PageContainer'
import { I18nProvider } from '../../i18n/I18nProvider'
import { DashboardPage } from '../DashboardPage'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: {
      items: [],
      total: 0,
    },
  })),
}))

vi.mock('../../components/pipeline/PipelineGraph', () => ({
  PipelineGraph: () => <div data-testid="pipeline-graph" />,
}))

const mockedUseQuery = vi.mocked(useQuery)

beforeEach(() => {
  mockedUseQuery.mockReset()
  mockedUseQuery.mockReturnValue({
    data: {
      items: [],
      total: 0,
    },
  } as never)
})

describe('DashboardPage layout', () => {
  it('uses a wider page container for the dashboard overview', () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: '仪表盘' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass(APP_CONTENT_MAX_WIDTH)
  })

  it('keeps dashboard overview panels free of rectangular shadow styling', () => {
    mockedUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: 'task-running',
            name: '任务-01:58',
            source_lang: 'zh',
            target_lang: 'en',
            overall_progress: 1,
            status: 'running',
            config: { template: 'asr-dub-basic' },
            current_stage: 'stage1',
            stages: [],
            elapsed_sec: 90,
            created_at: '2026-04-16T00:00:00Z',
            updated_at: '2026-04-16T00:00:00Z',
          },
          {
            id: 'task-done',
            name: '任务-已完成',
            source_lang: 'zh',
            target_lang: 'en',
            overall_progress: 100,
            status: 'succeeded',
            config: { template: 'asr-dub-basic' },
            current_stage: 'task-g',
            stages: [],
            elapsed_sec: 180,
            created_at: '2026-04-16T00:00:00Z',
            updated_at: '2026-04-16T01:00:00Z',
            finished_at: '2026-04-16T01:00:00Z',
          },
        ],
        total: 2,
      },
    } as never)

    const { container } = render(
      <I18nProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    const panels = container.querySelectorAll('.overflow-hidden.rounded-xl.border.border-slate-200.bg-white')

    expect(panels).toHaveLength(3)
    panels.forEach(panel => {
      expect((panel as HTMLElement).className).not.toContain('shadow')
    })
  })
})
