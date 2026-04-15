import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { WorkflowNodeDrawer } from '../WorkflowNodeDrawer'

const getStageManifest = vi.fn()

vi.mock('../../../api/tasks', () => ({
  tasksApi: {
    getStageManifest: (...args: unknown[]) => getStageManifest(...args),
  },
}))

describe('WorkflowNodeDrawer', () => {
  afterEach(() => {
    getStageManifest.mockReset()
  })

  it('renders node details and loads manifest content on demand', async () => {
    getStageManifest.mockResolvedValue({ status: 'succeeded' })

    render(
      <I18nProvider>
        <WorkflowNodeDrawer
          node={{
            id: 'ocr-detect',
            label: 'OCR Detect',
            group: 'ocr-subtitles',
            required: true,
            status: 'running',
            progress_percent: 55,
            current_step: 'reading subtitles',
          }}
          stage={{
            stage_name: 'ocr-detect',
            status: 'running',
            progress_percent: 55,
            current_step: 'reading subtitles',
            cache_hit: false,
            elapsed_sec: 12,
          }}
          artifacts={[
            {
              path: 'ocr-detect/ocr_events.json',
              size_bytes: 2048,
              suffix: '.json',
            },
          ]}
          taskId="task-1"
          onClose={() => undefined}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('节点详情')).toBeInTheDocument()
    expect(screen.getByText('OCR Detect: 字幕定位')).toBeInTheDocument()
    expect(screen.getByText('reading subtitles')).toBeInTheDocument()
    expect(screen.getByText('ocr_events.json')).toBeInTheDocument()

    fireEvent.click(screen.getByText('查看节点 Manifest'))

    await waitFor(() => {
      expect(getStageManifest).toHaveBeenCalledWith('task-1', 'ocr-detect')
    })
    expect(screen.getByText(/"status": "succeeded"/)).toBeInTheDocument()
  })
})
