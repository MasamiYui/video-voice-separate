import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import type { WorkflowGraph as WorkflowGraphPayload } from '../../../types'
import { PipelineGraph } from '../PipelineGraph'

const graph: WorkflowGraphPayload = {
  workflow: { template_id: 'asr-dub+ocr-subs', status: 'running' },
  nodes: [
    {
      id: 'stage1',
      label: 'Stage 1',
      group: 'audio-spine',
      required: true,
      status: 'succeeded',
      progress_percent: 100,
    },
    {
      id: 'task-a',
      label: 'Task A',
      group: 'audio-spine',
      required: true,
      status: 'running',
      progress_percent: 42,
      current_step: '正在对齐语音片段',
    },
    {
      id: 'task-g',
      label: 'Task G',
      group: 'delivery',
      required: true,
      status: 'pending',
      progress_percent: 0,
    },
  ],
  edges: [
    { from: 'stage1', to: 'task-a', state: 'completed' },
    { from: 'task-a', to: 'task-g', state: 'active' },
  ],
}

const previewGraph: WorkflowGraphPayload = {
  workflow: { template_id: 'asr-dub+ocr-subs', status: 'pending' },
  nodes: [
    {
      id: 'stage1',
      label: 'Stage 1',
      group: 'audio-spine',
      required: true,
      status: 'pending',
      progress_percent: 0,
    },
    {
      id: 'task-a',
      label: 'Task A',
      group: 'audio-spine',
      required: true,
      status: 'pending',
      progress_percent: 0,
    },
    {
      id: 'task-g',
      label: 'Task G',
      group: 'delivery',
      required: true,
      status: 'pending',
      progress_percent: 0,
    },
  ],
  edges: [
    { from: 'stage1', to: 'task-a', state: 'inactive' },
    { from: 'task-a', to: 'task-g', state: 'inactive' },
  ],
}

describe('PipelineGraph', () => {
  it('renders pending template previews inside a zoomable flow canvas without runtime metadata', () => {
    render(
      <I18nProvider>
        <PipelineGraph graph={previewGraph} compact />
      </I18nProvider>,
    )

    expect(screen.getAllByText('音频主干').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('application').length).toBeGreaterThan(0)
    expect(screen.queryByText('等待中')).not.toBeInTheDocument()
    expect(screen.queryByText('状态')).not.toBeInTheDocument()
    expect(screen.queryByText('进度')).not.toBeInTheDocument()
    expect(screen.getAllByText('音频主干')[0].closest('section')?.getAttribute('data-ui-tone')).toBe('neutral')
    expect(screen.getByText('音频分离').closest('button')?.getAttribute('data-ui-elevation')).toBe('flat')
    expect(screen.getByText('音频分离').closest('button')?.querySelector('.absolute.inset-y-3.left-0')).toBeNull()
    expect(screen.getAllByText('视频交付')[0].closest('[data-ui-delivery-node="compact"]')?.getAttribute('data-ui-size')).toBe('matched')
    expect(screen.queryByText('最终交付包')).not.toBeInTheDocument()
  })

  it('shows lane headers and stage detail text in compact preview mode', () => {
    render(
      <I18nProvider>
        <PipelineGraph graph={graph} compact activeStage="task-a" />
      </I18nProvider>,
    )

    expect(screen.getAllByText('音频主干').length).toBeGreaterThan(0)
    expect(screen.getAllByText('交付线').length).toBeGreaterThan(0)
    expect(screen.getByText('正在对齐语音片段')).toBeInTheDocument()
    expect(screen.getByText(/运行中/)).toBeInTheDocument()
    expect(screen.getAllByText('交付线')[0].closest('section')?.getAttribute('data-ui-tone')).toBe('neutral')
    expect(screen.getAllByText('语音转写')[0].closest('button')?.getAttribute('data-ui-elevation')).toBe('flat')
    expect(screen.getAllByText('视频交付')[0].closest('[data-ui-delivery-node="compact"]')?.getAttribute('data-ui-size')).toBe('matched')
    expect(screen.queryByText('最终交付包')).not.toBeInTheDocument()
  })
})
