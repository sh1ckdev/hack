import { createFileRoute } from '@tanstack/react-router'
import { DemoIncident } from '@/features/incidents/demo-incident'

export const Route = createFileRoute('/_authenticated/itsm-demo/$incidentId')({
  component: function IncidentRoute() {
    return <DemoIncident incidentId={Route.useParams().incidentId} />
  },
})
