import { useEffect, useState } from 'react'
import { Button, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { api, errorMessage } from '@/api/client'
import { AxisChart } from '@/components/charts'
import { DataTable, ErrorState, PageHeader, StatusChip, filterRowSx } from '@/components/ui'
import type { DashboardData, ReportSuite } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'

const PRESETS = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '7d', label: '7 Days', days: 6 },
  { id: '30d', label: '30 Days', days: 29 },
  { id: '3m', label: '3 Months', months: 3 },
  { id: '6m', label: '6 Months', months: 6 },
  { id: '1y', label: '1 Year', months: 12 },
  { id: 'custom', label: 'Custom Range' },
] as const

function rangeFor(id: string) {
  const preset = PRESETS.find((item) => item.id === id)
  const to = dayjs().format('YYYY-MM-DD')
  if (!preset || preset.id === 'custom') return { from: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), to }
  if ('days' in preset) return { from: dayjs().subtract(preset.days, 'day').format('YYYY-MM-DD'), to }
  return { from: dayjs().subtract(preset.months, 'month').format('YYYY-MM-DD'), to }
}

export function ReportsPage() {
  const [preset, setPreset] = useState('1y')
  const initial = rangeFor('1y')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [tab, setTab] = useState(0)
  const [overview, setOverview] = useState<DashboardData | null>(null)
  const [suite, setSuite] = useState<ReportSuite | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    const params = { from, to }
    void Promise.all([api.get('/reports/overview', { params }), api.get('/reports/suite', { params })])
      .then(([overviewResponse, suiteResponse]) => {
        setOverview(overviewResponse.data.data)
        setSuite(suiteResponse.data.data)
        setError('')
      })
      .catch((err) => setError(errorMessage(err)))
  }

  useEffect(() => { load() }, [from, to])

  const applyPreset = (id: string) => {
    setPreset(id)
    if (id === 'custom') return
    const next = rangeFor(id)
    setFrom(next.from)
    setTo(next.to)
  }

  const download = () => {
    if (!overview || !suite) return
    const lines = [
      'Report,Label,Value',
      ...overview.revenueTrend.map((row) => `Revenue,${row.month},${row.revenue}`),
      ...overview.statusBreakdown.map((row) => `Service status,${labelOf(row.status)},${row.count}`),
      ...suite.mechanicPerformance.map((row) => `Mechanic,${row.name},${row.completed}`),
      ...suite.partsUsage.map((row) => `Parts,${row.name},${row.quantity}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'apex-motors-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const statusData = (overview?.statusBreakdown || []).map((row) => ({ label: labelOf(row.status), count: row.count }))

  return (
    <div>
      <PageHeader title="Reports" subtitle="Revenue, work completed, and what is still unpaid." crumbs={[{ label: 'Reports', to: '/reports' }]} action={<Button variant="outlined" onClick={download} disabled={!overview || !suite}>Download CSV</Button>} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {PRESETS.map((item) => (
          <Button key={item.id} size="small" variant={preset === item.id ? 'contained' : 'outlined'} onClick={() => applyPreset(item.id)}>{item.label}</Button>
        ))}
      </Stack>
      {preset === 'custom' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
          <TextField type="date" label="From" value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="To" value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{formatDate(from)} to {formatDate(to)}</Typography>
      {error && <ErrorState message={error} onRetry={load} />}
      {!overview && !error && <Typography color="text.secondary">Loading reports…</Typography>}
      {overview && suite && (
        <>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" sx={{ mb: 2 }}>
            {['Revenue', 'Services', 'Mechanics', 'Customers', 'Vehicles', 'Parts', 'Outstanding'].map((label) => <Tab key={label} label={label} />)}
          </Tabs>
          {tab === 0 && <AxisChart title="Revenue report" data={overview.revenueTrend} xKey="month" yKey="revenue" xLabel="Month" yLabel="Revenue (₹)" formatter={inr} />}
          {tab === 1 && <AxisChart title="Service report" data={statusData} xKey="label" yKey="count" xLabel="Status" yLabel="Number of Requests" angled color="#e09f3e" />}
          {tab === 2 && <AxisChart title="Mechanic performance" data={suite.mechanicPerformance} xKey="name" yKey="completed" xLabel="Mechanic" yLabel="Completed Jobs" angled color="#1a6f96" />}
          {tab === 3 && <AxisChart title="Customer report" data={suite.customers} xKey="name" yKey="requests" xLabel="Customer" yLabel="Number of Requests" angled />}
          {tab === 4 && <AxisChart title="Vehicle service report" data={suite.vehiclesByMake} xKey="make" yKey="services" xLabel="Car Name" yLabel="Number of Requests" angled color="#1e7f4f" />}
          {tab === 5 && <AxisChart title="Parts usage" data={suite.partsUsage} xKey="name" yKey="quantity" xLabel="Part Name" yLabel="Quantity Used" angled color="#c0392b" />}
          {tab === 6 && (
            <DataTable
              columns={[
                { id: 'number', header: 'Invoice', mobile: 'title', render: (row) => row.invoiceNumber },
                { id: 'customer', header: 'Customer', mobile: 'meta', render: (row) => row.customerName },
                { id: 'total', header: 'Total', mobile: 'meta', render: (row) => inr(row.total) },
                { id: 'balance', header: 'Outstanding', mobile: 'chip', render: (row) => inr(row.balance) },
                { id: 'status', header: 'Payment status', mobile: 'chip', render: (row) => <StatusChip value={row.status} label={labelOf(row.status)} /> },
                { id: 'due', header: 'Due', mobile: 'hide', render: (row) => formatDate(row.dueDate) },
              ]}
              rows={suite.outstanding}
              loading={false}
              emptyTitle="No outstanding payments"
              emptyBody="Invoices issued in this range are paid or there are none yet."
            />
          )}
        </>
      )}
    </div>
  )
}
