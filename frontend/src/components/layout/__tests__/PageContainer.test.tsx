import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageContainer } from '../PageContainer'

describe('PageContainer', () => {
  it('centers constrained page content within the main area', () => {
    const { container } = render(
      <PageContainer className="max-w-2xl space-y-5">
        <div>content</div>
      </PageContainer>,
    )

    expect(container.firstChild).toHaveClass('mx-auto')
    expect(container.firstChild).toHaveClass('w-full')
    expect(container.firstChild).toHaveClass('max-w-2xl')
    expect(container.firstChild).toHaveClass('space-y-5')
  })
})
