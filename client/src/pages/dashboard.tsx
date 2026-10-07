import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material'
import { api, errorMessage } from '@/api/client'
import { AxisChart } from '@/components/charts'
import { subscribeRealtime } from '@/realtime/socket'
import type { RootState } from '@/store'
import type { DashboardData } from '@/types'
import { ErrorState, PageHeader, StatusChip } from '@/components/ui'
import { formatDateTime, inr, labelOf } from '@/utils/format'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card
      sx={(theme) => ({
        height: '100%',
        overflow: 'hidden',
        borderLeft: '6px solid',
        borderLeftColor: theme.palette.mode === 'dark' ? '#7ec4d6' : '#14627a',
      })}
    >
      <CardContent sx={{ py: 2, px: 2.25, '&:last-child': { pb: 2 } }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.35 }}>{label}</Typography>
        <Typography sx={{ mt: 1.5, fontWeight: 750, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums', fontSize: { xs: '1.55rem', sm: '1.85rem' }, lineHeight: 1, overflowWrap: 'anywhere' }}>{value}</Typography>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user)
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    void api.get('/reports/overview').then((response) => {
      setData(response.data.data)
      setError('')
    }).catch((err) => setError(errorMessage(err)))
  }

  useEffect(() => {
    load()
    return subscribeRealtime((event) => {
      if (event === 'dashboard:updated' || event.startsWith('serviceRequest') || event.startsWith('invoice') || event.startsWith('billing') || event.startsWith('customer') || event.startsWith('vehicle') || event.startsWith('service:') || event.startsWith('parts:')) load()
    })
  }, [])

  const cards = data?.cards
  const financial = Boolean(data?.financial)
  const statusData = (data?.statusBreakdown || []).map((row) => ({ label: labelOf(row.status), count: row.count }))

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle={`Live workshop load for ${user?.name.split(' ')[0] || 'the desk'}, payments, and the jobs that need a person next.`} crumbs={[{ label: 'Dashboard', to: '/dashboard' }]} />
      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} variant="rounded" height={96} />)}
        </Box>
      )}
      {cards && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' } }}>
            {user?.role !== 'MECHANIC' && <Stat label="Total Customers" value={cards.customers} />}
            <Stat label="Total Vehicles" value={cards.vehicles} />
            <Stat label="Active Services" value={cards.activeRequests} />
            <Stat label="Pending Services" value={cards.pending} />
            <Stat label="Completed Services" value={cards.completed} />
            {financial && <Stat label="Available Mechanics" value={cards.availableMechanics} />}
            {financial && <Stat label="Today's Revenue" value={inr(cards.todayRevenue)} />}
            {financial && <Stat label="Monthly Revenue" value={inr(cards.monthlyRevenue)} />}
            {financial && <Stat label="Outstanding Payments" value={inr(cards.outstanding)} />}
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' } }}>
            {financial && (
              <AxisChart title="Revenue Trend" data={data.revenueTrend} xKey="month" yKey="revenue" xLabel="Month" yLabel="Revenue (₹)" formatter={inr} />
            )}
            <AxisChart title="Service Status" data={statusData} xKey="label" yKey="count" xLabel="Service Status" yLabel="Number of Requests" angled />
            {financial && (
              <AxisChart title="Mechanic Workload" data={data.mechanicWorkload} xKey="name" yKey="assigned" xLabel="Mechanic Name" yLabel="Assigned Requests" angled />
            )}
            <AxisChart title="Monthly Completed Services" data={data.monthlyServices} xKey="month" yKey="completed" xLabel="Month" yLabel="Completed Services" />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' } }}>
            <Card sx={{ p: 2 }}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Recent Service Requests</Typography>
              <Stack spacing={1}>
                {data.recentRequests.map((request) => (
                  <Stack key={request._id} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ cursor: 'pointer', minWidth: 0, py: 1, px: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }} onClick={() => navigate(`/service-requests/${request._id}`)}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={650}>{request.requestNumber}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{request.customerName} · {request.vehicleLabel}</Typography>
                    </Box>
                    <StatusChip value={request.status} label={labelOf(request.status)} />
                  </Stack>
                ))}
                {!data.recentRequests.length && <Typography color="text.secondary">No service requests yet.</Typography>}
              </Stack>
            </Card>
            <Card sx={{ p: 2 }}>
              <Typography fontWeight={700} sx={{ mb: 1 }}>Recent Activity</Typography>
              <Stack spacing={1.25}>
                {data.recentActivity.map((entry) => (
                  <Box key={entry._id}>
                    <Typography variant="body2">{entry.summary}</Typography>
                    <Typography variant="caption" color="text.secondary">{entry.userName || 'System'} · {formatDateTime(entry.createdAt)}</Typography>
                  </Box>
                ))}
                {!data.recentActivity.length && <Typography color="text.secondary">Activity will appear as the desk is used.</Typography>}
              </Stack>
            </Card>
          </Box>
        </Stack>
      )}
    </Box>
  )
}
