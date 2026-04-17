import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { MainLayout } from '../MainLayout'

vi.mock('../Sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}))

vi.mock('../Header', () => ({
  Header: () => <header>Header</header>,
}))

describe('MainLayout', () => {
  it('uses a pure white application canvas behind the routed content', () => {
    const { container } = render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<div>Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('bg-white')
  })
})
