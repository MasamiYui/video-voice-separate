import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/utils'

export function PageContainer({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('mx-auto w-full', className)} {...props} />
}
