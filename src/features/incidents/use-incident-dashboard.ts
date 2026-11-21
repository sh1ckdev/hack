import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardSchema, type DashboardSnapshot } from './model'
import { mergeDashboardSnapshot } from './snapshot-merge'

export function useIncidentDashboard() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['incident-dashboard'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/dashboard', {
        cache: 'no-store',
        signal,
      })
      if (response.status === 503) {
        const body: { error?: string } = await response.json().catch(() => ({}))
        throw new Error(
          body.error ?? 'Файл инцидентов пока недоступен. Повторите позже.'
        )
      }
      if (!response.ok) throw new Error('Не удалось получить снимок дашборда.')
      const next = dashboardSchema.parse(await response.json())
      const previous = queryClient.getQueryData<DashboardSnapshot>([
        'incident-dashboard',
      ])
      return mergeDashboardSnapshot(previous, next)
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    retry: false,
    placeholderData: (previous) => previous,
    notifyOnChangeProps: ['data', 'error', 'isPending'],
  })
}
