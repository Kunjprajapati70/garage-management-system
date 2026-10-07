import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { ConfirmDialog, DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import { Field } from '@/components/fields'
import type { Customer, ServiceRequest } from '@/types'
import { formatDate, labelOf } from '@/utils/format'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  phone: z.string().trim().min(8, 'Enter a phone number'),
  alternatePhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

type FormValues = z.infer<typeof schema>

function CustomerForm({ open, initial, onClose, onSaved }: { open: boolean; initial?: Customer | null; onClose: () => void; onSaved: () => void }) {
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', alternatePhone: '', address: '', city: '', state: '', postalCode: '', notes: '' },
  })
  useEffect(() => {
    form.reset({
      name: initial?.name || '',
      email: initial?.email || '',
      phone: initial?.phone || '',
      alternatePhone: initial?.alternatePhone || '',
      address: initial?.address || '',
      city: initial?.city || '',
      state: initial?.state || '',
      postalCode: initial?.postalCode || '',
      notes: initial?.notes || '',
    })
  }, [initial, open])
  const submit = form.handleSubmit(async (values) => {
    try {
      const response = initial ? await api.put(`/customers/${initial._id}`, values) : await api.post('/customers', values)
      const message = response.data.message || (initial ? 'Customer updated' : 'Customer created')
      enqueueSnackbar(message, { variant: String(message).includes('not sent') ? 'warning' : 'success' })
      onSaved()
      onClose()
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' })
    }
  })
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial ? 'Edit customer' : 'New customer'}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="customer-form" spacing={2} sx={{ mt: 1 }} onSubmit={submit}>
          <Field name="name" control={form.control} label="Name" />
          <Field name="phone" control={form.control} label="Phone" />
          <Field name="email" control={form.control} label="Email" />
          <Field name="alternatePhone" control={form.control} label="Alternate phone" />
          <Field name="address" control={form.control} label="Address" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Field name="city" control={form.control} label="City" />
            <Field name="state" control={form.control} label="State" />
            <Field name="postalCode" control={form.control} label="Postal code" />
          </Stack>
          <Field name="notes" control={form.control} label="Notes" multiline minRows={3} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" form="customer-form" variant="contained" disabled={form.formState.isSubmitting}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export function CustomersPage() {
  const navigate = useNavigate()
  const list = useServerList<Customer>('/customers', ['customer:created', 'customer:updated'], { limit: 300 })
  const [search, setSearch] = useState(list.params.get('search') || '')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((list.params.get('search') || '') !== search) list.update({ search })
    }, 300)
    return () => clearTimeout(handle)
  }, [search])
  return (
    <div>
      <PageHeader title="Customers" subtitle="People who bring vehicles into the workshop." crumbs={[{ label: 'Customers' }]} action={<Button variant="contained" onClick={() => setOpen(true)}>Add customer</Button>} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: { sm: 280 } }} />
        <TextField size="small" label="City" value={list.params.get('city') || ''} onChange={(event) => list.update({ city: event.target.value })} />
      </Stack>
      <DataTable
        columns={[
          { id: 'name', header: 'Name', sortKey: 'name', mobile: 'title', render: (row) => row.name },
          { id: 'phone', header: 'Phone', mobile: 'meta', render: (row) => row.phone },
          { id: 'city', header: 'City', sortKey: 'city', mobile: 'meta', render: (row) => row.city || '—' },
          { id: 'vehicles', header: 'Vehicles', sortKey: 'vehicleCount', mobile: 'chip', render: (row) => row.vehicleCount },
          { id: 'status', header: 'Status', mobile: 'chip', render: (row) => <StatusChip value={row.isActive ? 'available' : 'cancelled'} label={row.isActive ? 'Active' : 'Inactive'} /> },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        sort={list.params.get('sort') || undefined}
        onSort={(sort) => list.update({ sort })}
        onPage={(page) => list.update({ page }, false)}
        onRow={(row) => navigate(`/customers/${row._id}`)}
        emptyTitle="No customers yet"
        emptyBody="Add the first customer to start a vehicle file."
        hasFilters={Boolean(search || list.params.get('city'))}
      />
      <CustomerForm open={open} onClose={() => setOpen(false)} onSaved={list.reload} />
    </div>
  )
}

export function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [subject, setSubject] = useState('A note from Apex Motors')
  const [message, setMessage] = useState('')
  const load = () => {
    void api.get(`/customers/${id}`).then((response) => setCustomer(response.data.data)).catch((err) => setError(errorMessage(err)))
  }
  useEffect(() => { load() }, [id])
  if (error) return <Alert severity="error">{error}</Alert>
  if (!customer) return <Typography color="text.secondary">Loading customer…</Typography>
  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={`${customer.phone}${customer.city ? ` · ${customer.city}` : ''}`}
        crumbs={[{ label: 'Customers' }, { label: customer.name }]}
        action={<Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setEmailOpen(true)}>Email</Button><Button variant="contained" onClick={() => setEdit(true)}>Edit</Button></Stack>}
      />
      <BoxGrid>
        <Card sx={{ p: 2 }}>
          <Typography fontWeight={700}>Contact</Typography>
          <Typography sx={{ mt: 1 }}>{customer.email || 'No email on file'}</Typography>
          <Typography color="text.secondary">{[customer.address, customer.city, customer.state, customer.postalCode].filter(Boolean).join(', ') || 'No address'}</Typography>
          {customer.notes && <Typography sx={{ mt: 1 }}>{customer.notes}</Typography>}
          <Button color="error" sx={{ mt: 2 }} onClick={() => setConfirm(true)}>Delete customer</Button>
        </Card>
        <Card sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={700}>Vehicles</Typography>
            <Button size="small" onClick={() => navigate(`/vehicles?customer=${customer._id}`)}>View all</Button>
          </Stack>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {(customer.vehicles || []).map((vehicle) => (
              <Typography key={vehicle._id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/vehicles/${vehicle._id}`)}>
                {vehicle.make} {vehicle.model} · {vehicle.licensePlate}
              </Typography>
            ))}
            {!customer.vehicles?.length && <Typography color="text.secondary">No vehicles yet.</Typography>}
            <Button onClick={() => navigate('/vehicles/new', { state: { customerId: customer._id, customerName: customer.name } })}>Add vehicle</Button>
          </Stack>
        </Card>
      </BoxGrid>
      <Card sx={{ p: 2, mt: 2 }}>
        <Typography fontWeight={700} sx={{ mb: 1 }}>Recent service requests</Typography>
        <Stack spacing={1}>
          {(customer.requests || []).map((request: ServiceRequest) => (
            <Stack key={request._id} direction="row" justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/service-requests/${request._id}`)}>
              <Typography>{request.requestNumber} · {request.vehicleLabel}</Typography>
              <StatusChip value={request.status} label={labelOf(request.status)} />
            </Stack>
          ))}
          {!customer.requests?.length && <Typography color="text.secondary">No jobs yet. Created {formatDate(customer.createdAt)}.</Typography>}
        </Stack>
      </Card>
      <CustomerForm open={edit} initial={customer} onClose={() => setEdit(false)} onSaved={load} />
      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Email {customer.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} error={subject.trim().length < 3} helperText={subject.trim().length < 3 ? 'Enter a subject' : ''} />
            <TextField label="Message" value={message} onChange={(event) => setMessage(event.target.value)} multiline minRows={4} error={message.trim().length > 0 && message.trim().length < 5} helperText="Write the note the customer should receive." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={subject.trim().length < 3 || message.trim().length < 5} onClick={async () => {
            try {
              await api.post(`/customers/${customer._id}/email`, { subject, message })
              enqueueSnackbar('Email sent', { variant: 'success' })
              setEmailOpen(false)
            } catch (err) {
              enqueueSnackbar(errorMessage(err), { variant: 'error' })
            }
          }}>Send</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={confirm} title="Delete customer" message="This removes the profile only when no vehicles are attached." confirmLabel="Delete" danger onClose={() => setConfirm(false)} onConfirm={async () => {
        try {
          await api.delete(`/customers/${customer._id}`)
          navigate('/customers')
        } catch (err) {
          enqueueSnackbar(errorMessage(err), { variant: 'error' })
          setConfirm(false)
        }
      }} />
    </div>
  )
}

function BoxGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>{children}</div>
}
