import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { WorkflowNodeDrawer } from '../WorkflowNodeDrawer'

describe('WorkflowNodeDrawer', () => {
  it('keeps the node detail drawer free of large panel shadow styling', () => {
    render(
      <I18nProvider>
        <WorkflowNodeDrawer
          node={{
            id: 'task-e',
            label: 'Task E',
            group: 'audio-spine',
            required: true,
            status: 'running',
            progress_percent: 65,
            elapsed_sec: 12,
          }}
          artifacts={[]}
          onClose={() => {}}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('节点详情')).toBeInTheDocument()
    expect((screen.getByText('节点详情').closest('aside') as HTMLElement).className).not.toContain('shadow')
  })
})
