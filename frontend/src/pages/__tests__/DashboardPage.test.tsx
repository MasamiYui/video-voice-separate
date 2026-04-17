import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
    expect(container.firstChild).toHaveClass('max-w-[112rem]')
  })
})
