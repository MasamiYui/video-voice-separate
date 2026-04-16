import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileUploadZone } from '../../components/atomic-tools/FileUploadZone'

afterEach(() => {
  vi.clearAllMocks()
})

describe('FileUploadZone', () => {
  it('uploads the selected file and shows its name', async () => {
    const onFileSelected = vi.fn().mockResolvedValue(undefined)

    render(
      <FileUploadZone
        label="媒体文件"
        hint="支持 mp4 / wav"
        accept=".mp4,.wav"
        value={null}
        onFileSelected={onFileSelected}
      />,
    )

    const input = screen.getByLabelText('媒体文件')
    const file = new File(['demo'], 'demo.mp4', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledWith(file))
  })
})
