import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { I18nProvider } from '../../../i18n/I18nProvider'

function renderSidebar(initialPath: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar />
      </MemoryRouter>
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe('Sidebar', () => {
  it('highlights only the new task entry on the new task page', () => {
    renderSidebar('/tasks/new')

    expect(screen.getByRole('link', { name: '任务列表' })).not.toHaveClass('bg-blue-600')
    expect(screen.getByRole('link', { name: '新建任务' })).toHaveClass('bg-blue-600')
  })

  it('highlights the task list entry on the task list page', () => {
    renderSidebar('/tasks')

    expect(screen.getByRole('link', { name: '任务列表' })).toHaveClass('bg-blue-600')
    expect(screen.getByRole('link', { name: '新建任务' })).not.toHaveClass('bg-blue-600')
  })

  it('keeps the task list entry active on task detail pages', () => {
    renderSidebar('/tasks/task-123')

    expect(screen.getByRole('link', { name: '任务列表' })).toHaveClass('bg-blue-600')
    expect(screen.getByRole('link', { name: '新建任务' })).not.toHaveClass('bg-blue-600')
  })
})
