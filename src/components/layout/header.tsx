import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  showSidebar?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Header({
  className,
  fixed,
  showSidebar = true,
  children,
  ...props
}: HeaderProps) {
  return (
    <header
      className={cn(
        'granat-header z-50 min-h-16 shrink-0',
        fixed && 'header-fixed peer/header w-[inherit]',
        className
      )}
      {...props}
    >
      <div
        className='relative flex min-h-16 w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-4 lg:py-0'
      >
        {showSidebar && (
          <SidebarTrigger variant='outline' className='max-md:scale-125' />
        )}
        {showSidebar && <Separator orientation='vertical' className='h-6' />}
        {children}
      </div>
    </header>
  )
}
