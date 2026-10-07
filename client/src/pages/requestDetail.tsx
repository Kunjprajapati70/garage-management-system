import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { joinRequestRoom, leaveRequestRoom, subscribeRealtime } from '@/realtime/socket'
import { ConfirmDialog, PageHeader, StatusChip } from '@/components/ui'
import { EntityPicker, type PickOption } from '@/components/fields'
import type { RootState } from '@/store'
import type { Invoice, ServiceRequest } from '@/types'
import { TRANSITIONS, formatDateTime, inr, labelOf } from '@/utils/format'

export function RequestDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const { enqueueSnackbar } = useSnackbar()
  const [job, setJob] = useState<ServiceRequest | null>(null)
  const [error, setError] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [note, setNote] = useState('')
  const [service, setService] = useState<PickOption | null>(null)
  const [part, setPart] = useState<PickOption | null>(null)
  const [partQty, setPartQty] = useState(1)
  const [mechanic, setMechanic] = useState<PickOption | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  const load = async () => {
    try {
      const response = await api.get(`/service-requests/${id}`)
      setJob(response.data.data)
      setDiagnosis(response.data.data.diagnosis || '')
      setSubject(`Update on ${response.data.data.requestNumber}`)
      setError('')
      if (role && role !== 'MECHANIC') {
        const invoices = await api.get('/invoices', { params: { search: response.data.data.requestNumber, limit: 5 } })
        const match = (invoices.data.data as Invoice[]).find((item) => item.requestNumber === response.data.data.requestNumber && item.status !== 'cancelled')
        setInvoice(match || null)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    void load()
    if (id) joinRequestRoom(id)
    return () => {
      if (id) leaveRequestRoom(id)
    }
  }, [id])

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (event.startsWith('serviceRequest') || event === 'billing:updated' || event === 'invoice:created') void load()
    })
  }, [id])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!job) return <Typography color="text.secondary">Loading service request…</Typography>

  const locked = job.status === 'completed' || job.status === 'cancelled'
  const nextStatuses = (TRANSITIONS[job.status] || []).filter((status) => {
    if (role === 'MECHANIC' && status === 'cancelled') return false
    if (job.status === 'completed' && role !== 'ADMIN') return false
    if (job.status === 'cancelled' && role !== 'ADMIN' && role !== 'MANAGER') return false
    return true
  })

  const act = async (work: () => Promise<unknown>, success: string) => {
    try {
      await work()
      enqueueSnackbar(success, { variant: 'success' })
      await load()
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title={job.requestNumber}
        subtitle={`${job.customerName} · ${job.vehicleLabel}`}
        crumbs={[{ label: 'Service requests' }, { label: job.requestNumber }]}
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <StatusChip value={job.priority} label={labelOf(job.priority)} />
            <StatusChip value={job.status} label={labelOf(job.status)} />
          </Stack>
        }
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {nextStatuses.map((status) => (
          <Button key={status} variant={status === 'cancelled' ? 'outlined' : 'contained'} color={status === 'cancelled' ? 'error' : 'primary'} onClick={() => setPendingStatus(status)}>
            Mark {labelOf(status)}
          </Button>
        ))}
        {role !== 'MECHANIC' && !locked && <Button variant="outlined" onClick={() => setAssignOpen(true)}>Assign mechanic</Button>}
        {role !== 'MECHANIC' && <Button variant="outlined" onClick={() => setEmailOpen(true)}>Email customer</Button>}
        {role !== 'MECHANIC' && !invoice && job.status !== 'cancelled' && (
          <Button variant="contained" color="secondary" onClick={() => act(() => api.post('/invoices', { serviceRequestId: job._id, discount: 0, dueInDays: 7 }), 'Invoice generated').then(() => undefined)}>
            Generate invoice
          </Button>
        )}
        {invoice && <Button onClick={() => navigate(`/invoices/${invoice._id}`)}>Open {invoice.invoiceNumber}</Button>}
      </Stack>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
        <Card sx={{ p: 2 }}>
          <Typography fontWeight={700}>Job</Typography>
          <Typography sx={{ mt: 1 }}>{job.description}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Opened by {job.createdByName || 'staff'} · {formatDateTime(job.createdAt)}</Typography>
          <Typography variant="body2" color="text.secondary">Mechanic: {job.mechanicName || 'Unassigned'}</Typography>
          <Typography variant="body2" color="text.secondary">Estimate {inr(job.estimatedCost)} · Due {formatDateTime(job.estimatedCompletion)}</Typography>
          {job.completedAt && <Typography variant="body2" color="text.secondary">Completed {formatDateTime(job.completedAt)}</Typography>}
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5 }}>
            <Button variant="outlined" fullWidth onClick={() => navigate(`/vehicles/${job.vehicle}`)}>Vehicle file</Button>
            {role !== 'MECHANIC' && <Button variant="outlined" fullWidth onClick={() => navigate(`/customers/${job.customer}`)}>Customer file</Button>}
          </Stack>
        </Card>
        <Card sx={{ p: 2 }}>
          <Typography fontWeight={700}>Diagnosis</Typography>
          <TextField fullWidth multiline minRows={4} sx={{ mt: 1 }} label="Diagnosis" value={diagnosis} disabled={locked} onChange={(event) => setDiagnosis(event.target.value)} placeholder="What did the inspection find?" />
          <Button sx={{ mt: 1 }} variant="outlined" disabled={locked} onClick={() => act(() => api.put(`/service-requests/${job._id}`, { diagnosis }), 'Diagnosis saved')}>Save diagnosis</Button>
        </Card>
      </div>
      <Card sx={{ p: 2, mt: 2 }}>
        <Typography fontWeight={700}>Labour</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {(job.services || []).map((line) => (
            <Stack key={line._id} direction="row" justifyContent="space-between" alignItems="center">
              <Typography>{line.name} × {line.quantity}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>{inr(line.quantity * line.unitPrice)}</Typography>
                {!locked && <Button size="small" color="error" onClick={() => act(() => api.delete(`/service-requests/${job._id}/services/${line._id}`), 'Service removed')}>Remove</Button>}
              </Stack>
            </Stack>
          ))}
          {!job.services?.length && <Typography color="text.secondary">No labour added yet.</Typography>}
          {!locked && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
              <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
                <EntityPicker label="Add service" value={service} onChange={setService} load={async (query) => {
                  const response = await api.get('/services', { params: { search: query, active: 'true', limit: 10 } })
                  return response.data.data.map((item: { _id: string; name: string; basePrice: number }) => ({ id: item._id, label: `${item.name} · ${inr(item.basePrice)}` }))
                }} />
              </Box>
              <Button variant="contained" sx={{ height: 56, minWidth: 112 }} disabled={!service} onClick={() => act(async () => { await api.post(`/service-requests/${job._id}/services`, { serviceId: service!.id, quantity: 1 }); setService(null) }, 'Service added')}>Add</Button>
            </Stack>
          )}
        </Stack>
      </Card>
      <Card sx={{ p: 2, mt: 2 }}>
        <Typography fontWeight={700}>Parts used</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {(job.parts || []).map((line) => (
            <Stack key={line._id} direction="row" justifyContent="space-between" alignItems="center">
              <Typography>{line.sku} · {line.name} × {line.quantity}</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>{inr(line.quantity * line.unitPrice)}</Typography>
                {!locked && <Button size="small" color="error" onClick={() => act(() => api.delete(`/service-requests/${job._id}/parts/${line._id}`), 'Part returned to stock')}>Return</Button>}
              </Stack>
            </Stack>
          ))}
          {!job.parts?.length && <Typography color="text.secondary">No parts drawn from stock.</Typography>}
          {!locked && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }}>
              <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
                <EntityPicker label="Add part" value={part} onChange={setPart} load={async (query) => {
                  const response = await api.get('/parts', { params: { search: query, active: 'true', limit: 10 } })
                  return response.data.data.map((item: { _id: string; name: string; sku: string; quantity: number; unitPrice: number }) => ({ id: item._id, label: `${item.sku} · ${item.name} · stock ${item.quantity} · ${inr(item.unitPrice)}` }))
                }} />
              </Box>
              <TextField label="Qty" type="number" value={partQty} onChange={(event) => setPartQty(Number(event.target.value))} sx={{ width: { xs: '100%', sm: 120 } }} />
              <Button variant="contained" sx={{ height: 56, minWidth: 112 }} disabled={!part || partQty < 1} onClick={() => act(async () => { await api.post(`/service-requests/${job._id}/parts`, { partId: part!.id, quantity: partQty }); setPart(null); setPartQty(1) }, 'Part added')}>Add</Button>
            </Stack>
          )}
          <Typography fontWeight={700}>Actual cost {inr(job.actualCost)}</Typography>
        </Stack>
      </Card>
      <Card sx={{ p: 2, mt: 2 }}>
        <Typography fontWeight={700}>Notes</Typography>
        <Stack spacing={1.25} sx={{ mt: 1 }}>
          {(job.notes || []).map((entry) => (
            <div key={entry._id}>
              <Typography>{entry.text}</Typography>
              <Typography variant="caption" color="text.secondary">{entry.authorName} · {formatDateTime(entry.createdAt)}</Typography>
            </div>
          ))}
          <TextField label="Add a note" value={note} onChange={(event) => setNote(event.target.value)} multiline minRows={2} error={note.length > 0 && note.trim().length < 2} helperText="Visible to anyone with access to this job." />
          <Button variant="outlined" disabled={note.trim().length < 2} onClick={() => act(async () => { await api.post(`/service-requests/${job._id}/notes`, { text: note.trim() }); setNote('') }, 'Note added')}>Save note</Button>
        </Stack>
      </Card>
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Assign mechanic</DialogTitle>
        <DialogContent>
          <EntityPicker label="Mechanic" value={mechanic} onChange={setMechanic} load={async (query) => {
            const response = await api.get('/mechanics/options', { params: { search: query } })
            return response.data.data
              .filter((item: { name: string }) => item.name.toLowerCase().includes(query.toLowerCase()))
              .map((item: { _id: string; name: string; specialization: string; status: string }) => ({ id: item._id, label: `${item.name} · ${item.specialization} · ${labelOf(item.status)}` }))
          }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!mechanic} onClick={() => act(async () => { await api.patch(`/service-requests/${job._id}/assign`, { mechanicId: mechanic!.id }); setAssignOpen(false) }, 'Mechanic assigned')}>Assign</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Email customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
            <TextField label="Message" value={message} onChange={(event) => setMessage(event.target.value)} multiline minRows={4} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={subject.trim().length < 3 || message.trim().length < 5} onClick={() => act(async () => { await api.post(`/service-requests/${job._id}/notify`, { subject, message }); setEmailOpen(false) }, 'Customer emailed')}>Send</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={`Move to ${labelOf(pendingStatus || '')}?`}
        message="The assigned mechanic, the front desk, and the dashboard update as soon as this is saved."
        confirmLabel="Update status"
        danger={pendingStatus === 'cancelled'}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => act(async () => { await api.patch(`/service-requests/${job._id}/status`, { status: pendingStatus }); setPendingStatus(null) }, 'Status updated')}
      />
    </div>
  )
}
