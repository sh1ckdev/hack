import { LayoutDashboard } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Координатор',
    email: 'operator@relay.local',
    avatar: '',
  },
  teams: [
    {
      name: 'Relay Console',
      logo: Logo,
      plan: 'Массовые инциденты',
    },
  ],
  navGroups: [
    {
      title: 'Смена',
      items: [
        {
          title: 'Инциденты',
          url: '/',
          icon: LayoutDashboard,
        },
      ],
    },
  ],
}