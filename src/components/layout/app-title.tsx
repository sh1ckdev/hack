import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '../ui/button'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-0 py-0 hover:bg-transparent active:bg-transparent'
          asChild
        >
          <div className='flex min-w-0 flex-1 items-center gap-2.5'>
            <MtsMark className='max-md:hidden' aria-hidden />
            <Link
              to='/'
              onClick={() => setOpenMobile(false)}
              className='grid min-w-0 flex-1 text-start text-sm leading-tight'
            >
              <span className='truncate text-sm font-semibold tracking-tight'>
                Relay Console
              </span>
              <span className='truncate text-xs text-muted-foreground'>
                МТС · координация массовых инцидентов
              </span>
            </Link>
            <ToggleSidebar />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function MtsMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary',
        className
      )}
    >
      <svg
        width='18'
        height='18'
        viewBox='0 0 18 18'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden
      >
        <path
          d='M3 5h12M10 9H3M10 13H3'
          stroke='white'
          strokeWidth='1.8'
          strokeLinecap='round'
        />
      </svg>
    </span>
  )
}

function ToggleSidebar({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar='trigger'
      data-slot='sidebar-trigger'
      variant='ghost'
      size='icon'
      className={cn('aspect-square size-8 max-md:scale-125', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <X className='md:hidden' />
      <Menu className='max-md:hidden' />
      <span className='sr-only'>Переключить боковую панель</span>
    </Button>
  )
}
