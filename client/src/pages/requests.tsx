import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Card, MenuItem, Stack, TextField } from '@mui/material'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import { EntityPicker, Field, type PickOption } from '@/components/fields'
import type { RootState } from '@/store'
import type { ServiceRequest } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  vehicleId: z.string().min(1, 'Select a vehicle'),
  description: z.string().trim().min(5, 'Describe the concern'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  estimatedCost: z.coerce.number().min(0),
  estimatedCompletion: z.string().optional(),
  mechanicId: z.string().optional(),
})

export function RequestsPage() {
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const list = useServerList<ServiceRequest>('/service-requests', ['serviceRequest:created', 'serviceRequest:updated', 'serviceRequest:assigned', 'serviceRequest:status'])
  const [search, setSearch] = useState(list.params.get('search') || '')
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((list.params.get('search') || '') !== search) list.update({ search })
    }, 300)
    return () => clearTimeout(handle)
  }, [search])
  return (
    <div>
      <PageHeader
        title={role === 'MECHANIC' ? 'My jobs' : 'Service requests'}
        subtitle={role === 'MECHANIC' ? 'Jobs assigned to you.' : 'From the front desk through diagnosis, parts, and completion.'}
        crumbs={[{ label: 'Service requests' }]}
        action={role !== 'MECHANIC' ? <Button variant="contained" onClick={() => navigate('/service-requests/new')}>New request</Button> : undefined}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search number, customer, or plate" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: { md: 280 } }} />
        <TextField size="small" select label="Status" value={list.params.get('status') || 'all'} onChange={(event) => list.update({ status: event.target.value })} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All statuses</MenuItem>
          {['pending', 'diagnosing', 'waiting_for_parts', 'in_progress', 'completed', 'cancelled'].map((status) => <MenuItem key={status} value={status}>{labelOf(status)}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Priority" value={list.params.get('priority') || 'all'} onChange={(event) => list.update({ priority: event.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="all">All priorities</MenuItem>
          {['low', 'medium', 'high', 'urgent'].map((priority) => <MenuItem key={priority} value={priority}>{labelOf(priority)}</MenuItem>)}
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { id: 'number', header: 'Request', sortKey: 'requestNumber', mobile: 'title', render: (row) => row.requestNumber },
          { id: 'customer', header: 'Customer', sortKey: 'customerName', mobile: 'meta', render: (row) => row.customerName },
          { id: 'vehicle', header: 'Vehicle', mobile: 'meta', render: (row) => row.vehicleLabel },
          { id: 'status', header: 'Status', sortKey: 'status', mobile: 'chip', render: (row) => <StatusChip value={row.status} label={labelOf(row.status)} /> },
          { id: 'priority', header: 'Priority', sortKey: 'priority', mobile: 'chip', render: (row) => <StatusChip value={row.priority} label={labelOf(row.priority)} /> },
          { id: 'mechanic', header: 'Mechanic', mobile: 'hide', render: (row) => row.mechanicName || 'Unassigned' },
          { id: 'cost', header: 'Actual', sortKey: 'actualCost', mobile: 'hide', render: (row) => inr(row.actualCost) },
          { id: 'opened', header: 'Opened', sortKey: 'createdAt', mobile: 'meta', render: (row) => formatDate(row.createdAt) },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        sort={list.params.get('sort') || undefined}
        onSort={(sort) => list.update({ sort })}
        onPage={(page) => list.update({ page }, false)}
        onRow={(row) => navigate(`/service-requests/${row._id}`)}
        emptyTitle="No service requests"
        emptyBody="Open a request when a vehicle arrives."
        hasFilters={Boolean(search || list.params.get('status') || list.params.get('priority'))}
      />
    </div>
  )
}

export function RequestCreatePage() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [customer, setCustomer] = useState<PickOption | null>(null)
  const [vehicle, setVehicle] = useState<PickOption | null>(null)
  const [mechanic, setMechanic] = useState<PickOption | null>(null)
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { customerId: '', vehicleId: '', description: '', priority: 'medium' as const, estimatedCost: 0, estimatedCompletion: '', mechanicId: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      const response = await api.post('/service-requests', {
        customer: values.customerId,
        vehicle: values.vehicleId,
        description: values.description,
        priority: values.priority,
        estimatedCost: values.estimatedCost,
        estimatedCompletion: values.estimatedCompletion ? new Date(values.estimatedCompletion).toISOString() : undefined,
        assignedMechanic: values.mechanicId || undefined,
      })
      enqueueSnackbar('Service request opened', { variant: 'success' })
      navigate(`/service-requests/${response.data.data._id}`)
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' })
    }
  })
  return (
    <div>
      <PageHeader title="New service request" subtitle="Capture the concern, the vehicle, and who should look at it." crumbs={[{ label: 'Service requests' }, { label: 'New' }]} />
      <Card sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760 }}>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <EntityPicker
            label="Customer"
            value={customer}
            error={form.formState.errors.customerId?.message}
            load={async (query) => {
              const response = await api.get('/customers', { params: { search: query, limit: 300 } })
              return response.data.data.map((item: { _id: string; name: string; phone: string }) => ({ id: item._id, label: `${item.name} · ${item.phone}` }))
            }}
            onChange={(option) => {
              setCustomer(option)
              setVehicle(null)
              form.setValue('customerId', option?.id || '', { shouldValidate: true })
              form.setValue('vehicleId', '')
            }}
          />
          <EntityPicker
            label="Vehicle"
            value={vehicle}
            disabled={!customer}
            error={form.formState.errors.vehicleId?.message}
            load={async (query) => {
              if (!customer) return []
              const response = await api.get('/vehicles', { params: { search: query, customer: customer.id, limit: 10 } })
              return response.data.data.map((item: { _id: string; make: string; model: string; licensePlate: string }) => ({ id: item._id, label: `${item.make} ${item.model} · ${item.licensePlate}` }))
            }}
            onChange={(option) => { setVehicle(option); form.setValue('vehicleId', option?.id || '', { shouldValidate: true }) }}
          />
          <Field name="description" control={form.control} label="Customer concern" multiline minRows={3} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller name="priority" control={form.control} render={({ field }) => (
              <TextField {...field} select label="Priority" fullWidth>
                {['low', 'medium', 'high', 'urgent'].map((item) => <MenuItem key={item} value={item}>{labelOf(item)}</MenuItem>)}
              </TextField>
            )} />
            <Field name="estimatedCost" control={form.control} label="Estimated cost (₹)" type="number" />
            <Field name="estimatedCompletion" control={form.control} label="Estimated completion" type="date" slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
          <EntityPicker
            label="Assign mechanic (optional)"
            value={mechanic}
            load={async (query) => {
              const response = await api.get('/mechanics', { params: { search: query, limit: 10 } })
              return response.data.data.map((item: { _id: string; name: string; specialization: string }) => ({ id: item._id, label: `${item.name} · ${item.specialization}` }))
            }}
            onChange={(option) => { setMechanic(option); form.setValue('mechanicId', option?.id || '') }}
          />
          <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>Open request</Button>
        </Stack>
      </Card>
    </div>
  )
}
