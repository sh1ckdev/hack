import { createFileRoute } from '@tanstack/react-router'
import { IncidentsDashboard } from '@/features/incidents'

export const Route = createFileRoute('/_authenticated/')({
  component: IncidentsDashboard,
})
