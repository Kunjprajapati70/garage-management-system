import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Button, Card, LinearProgress, MenuItem, Pagination, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, errorMessage } from '@/api/client'
import { DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import { Field } from '@/components/fields'
import type { RootState } from '@/store'
import type { Mechanic } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().min(8, 'Enter a phone number'),
  password: z.string().min(8, 'Use at least 8 characters').regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[0-9]/, 'Include a number'),
  specialization: z.string().trim().min(2, 'Enter a specialisation'),
  experienceYears: z.coerce.number().min(0),
  hourlyRate: z.coerce.number().min(0),
})

export function MechanicsPage() {
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const list = useServerList<Mechanic>('/mechanics', ['serviceRequest:assigned', 'serviceRequest:status'])
  const [search, setSearch] = useState(list.params.get('search') || '')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [open, setOpen] = useState(false)
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm({ resolver: zodResolver(createSchema), defaultValues: { name: '', email: '', phone: '', password: '', specialization: 'General Service', experienceYears: 1, hourlyRate: 450 } })
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((list.params.get('search') || '') !== search) list.update({ search })
    }, 300)
    return () => clearTimeout(handle)
  }, [search])
  return (
    <div>
      <PageHeader
        title="Mechanics"
        subtitle="Availability, open jobs, and work already finished."
        crumbs={[{ label: 'Mechanics' }]}
        action={role === 'ADMIN' ? <Button variant="contained" onClick={() => setOpen(true)}>Add mechanic</Button> : undefined}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search name, email, or skill" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" select label="Availability" value={list.params.get('status') || 'all'} onChange={(event) => list.update({ status: event.target.value })} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="available">Available</MenuItem>
          <MenuItem value="busy">Busy</MenuItem>
          <MenuItem value="off_duty">Off duty</MenuItem>
        </TextField>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_event, value) => value && setView(value)}>
          <ToggleButton value="cards">Cards</ToggleButton>
          <ToggleButton value="table">Table</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {view === 'cards' && !list.loading && !list.error && (
        <Stack spacing={2}>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
            {list.rows.map((row) => (
              <Card key={row._id} sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate(`/mechanics/${row._id}`)}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography fontWeight={700}>{row.name}</Typography>
                  <StatusChip value={row.status} label={labelOf(row.status)} />
                </Stack>
                <Typography variant="body2" color="text.secondary">{row.email}</Typography>
                <Typography variant="body2" color="text.secondary">{row.phone || 'No phone'}</Typography>
                <Typography sx={{ mt: 1 }}>{row.specialization}</Typography>
                <Typography variant="body2">Active jobs: {row.activeJobs}</Typography>
                <Typography variant="body2">Completed jobs: {row.completedJobs || 0}</Typography>
                <Typography variant="caption" color="text.secondary">Current workload</Typography>
                <LinearProgress variant="determinate" value={Math.min(100, row.activeJobs * 20)} sx={{ mt: 0.5 }} />
              </Card>
            ))}
          </div>
          {!list.rows.length && <Typography color="text.secondary">No mechanics match this search.</Typography>}
          {list.meta.totalPages > 1 && (
            <Pagination color="primary" page={list.meta.page} count={list.meta.totalPages} onChange={(_event, page) => list.update({ page }, false)} />
          )}
        </Stack>
      )}
      {view === 'table' && (
        <DataTable
          columns={[
            { id: 'name', header: 'Name', sortKey: 'name', mobile: 'title', render: (row) => row.name },
            { id: 'email', header: 'Email', mobile: 'meta', render: (row) => row.email },
            { id: 'phone', header: 'Phone', mobile: 'meta', render: (row) => row.phone || '—' },
            { id: 'status', header: 'Availability', sortKey: 'status', mobile: 'chip', render: (row) => <StatusChip value={row.status} label={labelOf(row.status)} /> },
            { id: 'jobs', header: 'Active jobs', sortKey: 'activeJobs', mobile: 'chip', render: (row) => row.activeJobs },
            { id: 'done', header: 'Completed jobs', mobile: 'meta', render: (row) => row.completedJobs || 0 },
          ]}
          rows={list.rows}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          meta={list.meta}
          sort={list.params.get('sort') || undefined}
          onSort={(sort) => list.update({ sort })}
          onPage={(page) => list.update({ page }, false)}
          onRow={(row) => navigate(`/mechanics/${row._id}`)}
          emptyTitle="No mechanics"
          emptyBody="Add a mechanic account to put someone on the floor."
          hasFilters={Boolean(search || list.params.get('status'))}
        />
      )}
      {view === 'cards' && list.loading && <Typography color="text.secondary">Loading mechanics…</Typography>}
      {view === 'cards' && list.error && <Typography color="error">{list.error}</Typography>}
      {open && (
        <Card sx={{ p: 2, mt: 2, maxWidth: 560 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>New mechanic</Typography>
          <Stack component="form" spacing={1.5} onSubmit={form.handleSubmit(async (values) => {
            try {
              const response = await api.post('/users', { ...values, role: 'MECHANIC', isActive: true })
              const message = response.data.message || 'Mechanic created'
              enqueueSnackbar(message, { variant: String(message).includes('not sent') ? 'warning' : 'success' })
              setOpen(false)
              form.reset()
              list.reload()
            } catch (err) {
              enqueueSnackbar(errorMessage(err), { variant: 'error' })
            }
          })}>
            <Field name="name" control={form.control} label="Name" />
            <Field name="email" control={form.control} label="Email" />
            <Field name="phone" control={form.control} label="Phone" />
            <Field name="password" control={form.control} label="Temporary password" type="password" />
            <Field name="specialization" control={form.control} label="Specialisation" />
            <Field name="experienceYears" control={form.control} label="Experience (years)" type="number" />
            <Field name="hourlyRate" control={form.control} label="Hourly rate (₹)" type="number" />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained">Create</Button>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
            </Stack>
          </Stack>
        </Card>
      )}
    </div>
  )
}

export function MechanicDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const { enqueueSnackbar } = useSnackbar()
  const [mechanic, setMechanic] = useState<Mechanic | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ specialization: '', experienceYears: 0, hourlyRate: 0, status: 'available', phone: '' })
  const load = () => {
    void api.get(`/mechanics/${id}`).then((response) => {
      setMechanic(response.data.data)
      setForm({
        specialization: response.data.data.specialization,
        experienceYears: response.data.data.experienceYears,
        hourlyRate: response.data.data.hourlyRate,
        status: response.data.data.status,
        phone: response.data.data.phone || '',
      })
    }).catch((err) => setError(errorMessage(err)))
  }
  useEffect(() => { load() }, [id])
  if (error) return <Typography color="error">{error}</Typography>
  if (!mechanic) return <Typography color="text.secondary">Loading mechanic…</Typography>
  const canEdit = role === 'ADMIN' || role === 'MANAGER'
  return (
    <div>
      <PageHeader title={mechanic.name} subtitle={`${mechanic.employeeId} · ${mechanic.email}`} crumbs={[{ label: 'Mechanics' }, { label: mechanic.name }]} />
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
        <Card sx={{ p: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>Profile</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{mechanic.phone || 'No phone on file'}</Typography>
          <TextField label="Specialisation" fullWidth sx={{ mb: 1.5 }} value={form.specialization} disabled={!canEdit} onChange={(event) => setForm({ ...form, specialization: event.target.value })} />
          <TextField label="Experience (years)" type="number" fullWidth sx={{ mb: 1.5 }} value={form.experienceYears} disabled={!canEdit} onChange={(event) => setForm({ ...form, experienceYears: Number(event.target.value) })} />
          <TextField label="Hourly rate (₹)" type="number" fullWidth sx={{ mb: 1.5 }} value={form.hourlyRate} disabled={!canEdit} onChange={(event) => setForm({ ...form, hourlyRate: Number(event.target.value) })} />
          <TextField label="Phone" fullWidth sx={{ mb: 1.5 }} value={form.phone} disabled={!canEdit} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <TextField select label="Availability" fullWidth value={form.status} disabled={!canEdit} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <MenuItem value="available">Available</MenuItem>
            <MenuItem value="busy">Busy</MenuItem>
            <MenuItem value="off_duty">Off duty</MenuItem>
          </TextField>
          {canEdit && (
            <Button sx={{ mt: 2 }} variant="contained" onClick={async () => {
              try {
                await api.put(`/mechanics/${mechanic._id}`, form)
                enqueueSnackbar('Mechanic updated', { variant: 'success' })
                load()
              } catch (err) {
                enqueueSnackbar(errorMessage(err), { variant: 'error' })
              }
            }}>Save</Button>
          )}
          <Typography sx={{ mt: 2 }}>Active jobs: {mechanic.activeJobs}</Typography>
          <Typography>Completed jobs: {mechanic.completedJobs || 0}</Typography>
          <Typography color="text.secondary">{inr(mechanic.hourlyRate)} / hour</Typography>
          <Typography variant="caption" color="text.secondary">Current workload</Typography>
          <LinearProgress variant="determinate" value={Math.min(100, mechanic.activeJobs * 20)} sx={{ mt: 0.5 }} />
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography fontWeight={700} sx={{ mb: 1 }}>Assigned requests</Typography>
          <Stack spacing={1}>
            {(mechanic.jobs || []).map((job) => (
              <Stack key={job._id} direction="row" justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/service-requests/${job._id}`)}>
                <div>
                  <Typography>{job.requestNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">{job.customerName} · {formatDate(job.updatedAt)}</Typography>
                </div>
                <StatusChip value={job.status} label={labelOf(job.status)} />
              </Stack>
            ))}
            {!mechanic.jobs?.length && <Typography color="text.secondary">No jobs assigned.</Typography>}
          </Stack>
        </Card>
      </div>
    </div>
  )
}
