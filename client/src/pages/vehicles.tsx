import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Alert, Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, errorMessage } from '@/api/client'
import { ConfirmDialog, DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import { EntityPicker, Field, type PickOption } from '@/components/fields'
import type { RootState } from '@/store'
import type { ServiceRequest, Vehicle } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  make: z.string().trim().min(2, 'Enter the car name'),
  model: z.string().trim().min(1, 'Enter the model'),
  year: z.coerce.number().min(1980).max(2100),
  color: z.string().optional(),
  licensePlate: z.string().trim().min(4, 'Enter the licence plate'),
  vin: z.string().trim().max(17).optional(),
  mileage: z.coerce.number().min(0),
  fuelType: z.enum(['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']),
  transmission: z.enum(['Manual', 'Automatic']),
  notes: z.string().optional(),
})

async function loadCustomers(query: string): Promise<PickOption[]> {
  const response = await api.get('/customers', { params: { search: query, limit: 300 } })
  return response.data.data.map((customer: { _id: string; name: string; phone: string }) => ({
    id: customer._id,
    label: `${customer.name} · ${customer.phone}`,
  }))
}

export function VehiclesPage() {
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const list = useServerList<Vehicle>('/vehicles', ['vehicle:created', 'vehicle:updated'])
  const [plate, setPlate] = useState(list.params.get('plate') || '')
  const [vin, setVin] = useState(list.params.get('vin') || '')
  const [make, setMake] = useState(list.params.get('make') || '')
  const [customer, setCustomer] = useState<PickOption | null>(list.params.get('customer') ? { id: list.params.get('customer') || '', label: 'Selected customer' } : null)
  useEffect(() => {
    const handle = setTimeout(() => {
      list.update({ plate, vin, make, customer: customer?.id })
    }, 300)
    return () => clearTimeout(handle)
  }, [plate, vin, make, customer?.id])
  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Registration, mileage, and the jobs each car has been through." crumbs={[{ label: 'Vehicles' }]} action={role !== 'MECHANIC' ? <Button variant="contained" onClick={() => navigate('/vehicles/new')}>Add vehicle</Button> : undefined} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Licence plate" value={plate} onChange={(event) => setPlate(event.target.value)} />
        <TextField size="small" label="VIN" value={vin} onChange={(event) => setVin(event.target.value)} />
        <TextField size="small" label="Car Name" value={make} onChange={(event) => setMake(event.target.value)} />
        {role !== 'MECHANIC' && <EntityPicker label="Customer" value={customer} onChange={setCustomer} load={loadCustomers} />}
      </Stack>
      <DataTable
        columns={[
          { id: 'plate', header: 'Plate', sortKey: 'licensePlate', mobile: 'title', render: (row) => row.licensePlate },
          { id: 'vehicle', header: 'Vehicle', mobile: 'meta', render: (row) => `${row.year} ${row.make} ${row.model}` },
          { id: 'customer', header: 'Customer', sortKey: 'customerName', mobile: 'meta', render: (row) => row.customerName },
          { id: 'mileage', header: 'Mileage', sortKey: 'mileage', mobile: 'chip', render: (row) => `${row.mileage.toLocaleString('en-IN')} km` },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        sort={list.params.get('sort') || undefined}
        onSort={(sort) => list.update({ sort })}
        onPage={(page) => list.update({ page }, false)}
        onRow={(row) => navigate(`/vehicles/${row._id}`)}
        emptyTitle="No vehicles yet"
        emptyBody="Register a vehicle against a customer."
        hasFilters={Boolean(plate || vin || make || customer)}
      />
    </div>
  )
}

export function VehicleFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { customerId?: string; customerName?: string } }
  const { enqueueSnackbar } = useSnackbar()
  const [customer, setCustomer] = useState<PickOption | null>(
    location.state?.customerId ? { id: location.state.customerId, label: location.state.customerName || 'Selected customer' } : null,
  )
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { customerId: location.state?.customerId || '', make: '', model: '', year: new Date().getFullYear(), color: '', licensePlate: '', vin: '', mileage: 0, fuelType: 'Petrol' as const, transmission: 'Manual' as const, notes: '' },
  })
  useEffect(() => {
    if (!id) return
    void api.get(`/vehicles/${id}`).then((response) => {
      const vehicle = response.data.data as Vehicle
      setCustomer({ id: vehicle.customer, label: vehicle.customerName })
      form.reset({
        customerId: vehicle.customer,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color || '',
        licensePlate: vehicle.licensePlate,
        vin: vehicle.vin || '',
        mileage: vehicle.mileage,
        fuelType: vehicle.fuelType as 'Petrol',
        transmission: vehicle.transmission as 'Manual',
        notes: vehicle.notes || '',
      })
    })
  }, [id])
  const submit = form.handleSubmit(async (values) => {
    try {
      const payload = { ...values, customer: values.customerId }
      const response = id ? await api.put(`/vehicles/${id}`, payload) : await api.post('/vehicles', payload)
      enqueueSnackbar(id ? 'Vehicle updated' : 'Vehicle registered', { variant: 'success' })
      navigate(`/vehicles/${response.data.data._id}`)
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' })
    }
  })
  return (
    <div>
      <PageHeader title={id ? 'Edit vehicle' : 'Register vehicle'} crumbs={[{ label: 'Vehicles' }, { label: id ? 'Edit' : 'New' }]} />
      <Card sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760 }}>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <EntityPicker label="Customer" value={customer} load={loadCustomers} error={form.formState.errors.customerId?.message} onChange={(option) => { setCustomer(option); form.setValue('customerId', option?.id || '', { shouldValidate: true }) }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Field name="make" control={form.control} label="Car Name" />
            <Field name="model" control={form.control} label="Model" />
            <Field name="year" control={form.control} label="Year" type="number" />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Field name="licensePlate" control={form.control} label="Licence plate" />
            <Field name="vin" control={form.control} label="VIN" />
            <Field name="mileage" control={form.control} label="Mileage (km)" type="number" />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller name="fuelType" control={form.control} render={({ field }) => (
              <TextField {...field} select label="Fuel" fullWidth>
                {['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="transmission" control={form.control} render={({ field }) => (
              <TextField {...field} select label="Transmission" fullWidth>
                {['Manual', 'Automatic'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
            )} />
            <Field name="color" control={form.control} label="Colour" />
          </Stack>
          <Field name="notes" control={form.control} label="Notes" multiline minRows={2} />
          <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>Save vehicle</Button>
        </Stack>
      </Card>
    </div>
  )
}

export function VehicleDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const { enqueueSnackbar } = useSnackbar()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    void api.get(`/vehicles/${id}`).then((response) => setVehicle(response.data.data)).catch((err) => setError(errorMessage(err)))
  }, [id])
  if (error) return <Alert severity="error">{error}</Alert>
  if (!vehicle) return <Typography color="text.secondary">Loading vehicle…</Typography>
  const history = vehicle.history || []
  const current = history.find((request) => request.status !== 'completed' && request.status !== 'cancelled')
  const totalCost = history.reduce((sum, request) => sum + (request.actualCost || 0), 0)
  const canDelete = role === 'ADMIN' || role === 'MANAGER'
  return (
    <div>
      <PageHeader
        title={`${vehicle.make} ${vehicle.model}`}
        subtitle={vehicle.licensePlate}
        crumbs={[{ label: 'Vehicles' }, { label: vehicle.licensePlate }]}
        action={role !== 'MECHANIC' ? (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => navigate(`/vehicles/${vehicle._id}/edit`)}>Edit</Button>
            {canDelete && <Button color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </Stack>
        ) : undefined}
      />
      <Card sx={{ p: 2, mb: 2 }}>
        <Typography fontWeight={700}>Customer</Typography>
        <Typography>{vehicle.customerName}</Typography>
        <Typography sx={{ mt: 1 }}>{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color || 'Colour not recorded'}</Typography>
        <Typography color="text.secondary">{vehicle.fuelType} · {vehicle.transmission} · {vehicle.mileage.toLocaleString('en-IN')} km</Typography>
        <Typography color="text.secondary">VIN {vehicle.vin || 'not recorded'} · Last service {formatDate(vehicle.lastServiceAt)}</Typography>
        <Typography sx={{ mt: 1 }}>Current service status: {current ? labelOf(current.status) : 'No open job'}</Typography>
        <Typography>Total service cost: {inr(totalCost)}</Typography>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this vehicle?"
        message="This removes the vehicle file. Vehicles with service history stay on record."
        confirmLabel="Delete vehicle"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await api.delete(`/vehicles/${vehicle._id}`)
            enqueueSnackbar('Vehicle deleted', { variant: 'success' })
            navigate('/vehicles')
          } catch (err) {
            enqueueSnackbar(errorMessage(err), { variant: 'error' })
            setConfirmDelete(false)
          }
        }}
      />
      <Card sx={{ p: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 1 }}>Service history</Typography>
        <Stack spacing={1}>
          {(vehicle.history || []).map((request: ServiceRequest) => (
            <Stack key={request._id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/service-requests/${request._id}`)}>
              <Typography>{request.requestNumber} · {request.description}</Typography>
              <StatusChip value={request.status} label={labelOf(request.status)} />
            </Stack>
          ))}
          {!vehicle.history?.length && <Typography color="text.secondary">No workshop visits recorded.</Typography>}
        </Stack>
      </Card>
    </div>
  )
}
