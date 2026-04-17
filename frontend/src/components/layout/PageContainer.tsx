import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'

export const APP_CONTENT_MAX_WIDTH = 'max-w-[112rem]'

export function PageContainer({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('mx-auto w-full', className)} {...props} />
}
