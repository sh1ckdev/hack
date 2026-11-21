import { incidentLink, type Incident } from './model'

export function incidentDestination(incident: Incident) {
  const url = incidentLink(
    import.meta.env.VITE_ITSM_INCIDENT_URL ?? '',
    incident
  )

  return url
    ? { href: url, label: 'ITSM' }
    : {
        href: `/itsm-demo/${encodeURIComponent(incident.id)}`,
        label: 'Демо ITSM',
      }
}
