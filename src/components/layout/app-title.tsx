import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/assets/logo'
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
            <Logo className='max-md:hidden' />
            <Link
              to='/'
              onClick={() => setOpenMobile(false)}
              className='grid min-w-0 flex-1 text-start text-sm leading-tight'
            >
              <span className='truncate text-sm font-medium'>
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
