import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden='true'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='currentColor'
      className={cn('size-5 text-signal', className)}
      {...props}
    >
      <title>Relay Console</title>
      <rect x='4' y='5' width='16' height='2' rx='0.5' />
      <rect x='4' y='11' width='11' height='2' rx='0.5' opacity='0.65' />
      <rect x='4' y='17' width='14' height='2' rx='0.5' opacity='0.4' />
    </svg>
  )
}