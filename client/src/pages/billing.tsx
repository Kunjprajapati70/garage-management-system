import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { ErrorState, PageHeader, StatusChip } from '@/components/ui'
import { subscribeRealtime } from '@/realtime/socket'
import type { Invoice, ServiceRequest } from '@/types'
import { inr, labelOf } from '@/utils/format'
import { downloadInvoiceFile, printInvoice } from '@/pages/invoices'

export function BillingPage() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<ServiceRequest[]>([])
  const [job, setJob] = useState<ServiceRequest | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [taxRate, setTaxRate] = useState(18)
  const [discount, setDiscount] = useState(0)
  const [dueInDays, setDueInDays] = useState(7)
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'bank'>('upi')
  const [payNow, setPayNow] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void api.get('/settings/public').then((response) => {
      if (typeof response.data.data?.taxPercent === 'number') setTaxRate(response.data.data.taxPercent)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!search.trim()) {
        setMatches([])
        return
      }
      void api.get('/service-requests', { params: { search: search.trim(), limit: 8 } }).then((response) => {
        setMatches(response.data.data)
      }).catch((err) => setError(errorMessage(err)))
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  const loadJob = async (id: string) => {
    setLoading(true)
    try {
      const response = await api.get(`/service-requests/${id}`)
      const next = response.data.data as ServiceRequest
      setJob(next)
      setError('')
      const invoices = await api.get('/invoices', { params: { search: next.requestNumber, limit: 5 } })
      const match = (invoices.data.data as Invoice[]).find((item) => item.requestNumber === next.requestNumber && item.status !== 'cancelled')
      setInvoice(match || null)
      if (match) setDiscount(match.discount)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (job && (event === 'billing:updated' || event === 'invoice:created' || event.startsWith('serviceRequest'))) void loadJob(job._id)
    })
  }, [job?._id])

  const totals = useMemo(() => {
    const serviceLines = job?.services || []
    const partLines = job?.parts || []
    const services = serviceLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    const parts = partLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    const subtotal = services + parts
    const safeDiscount = Math.min(Math.max(discount, 0), subtotal)
    const taxable = subtotal - safeDiscount
    const tax = (taxable * taxRate) / 100
    return { services, parts, subtotal, discount: safeDiscount, tax, grand: taxable + tax }
  }, [job, discount, taxRate])

  const generate = async () => {
    if (!job) return
    try {
      const response = await api.post('/invoices', { serviceRequestId: job._id, discount: totals.discount, dueInDays })
      const created = response.data.data as Invoice
      enqueueSnackbar(`Invoice ${created.invoiceNumber} generated`, { variant: 'success' })
      const amount = Number(payNow)
      if (amount > 0) {
        await api.post(`/invoices/${created._id}/payments`, { amount, method })
        enqueueSnackbar('Payment recorded', { variant: 'success' })
      }
      await loadJob(job._id)
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Price the labour and parts on a job, then raise the invoice."
        crumbs={[{ label: 'Billing', to: '/billing' }]}
        action={<Button variant="outlined" onClick={() => navigate('/invoices')}>All invoices</Button>}
      />
      {error && <ErrorState message={error} onRetry={() => job && void loadJob(job._id)} />}
      <TextField fullWidth size="small" label="Find a service request" placeholder="Request number, customer, or plate" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 1.5, maxWidth: 480 }} />
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        {matches.map((item) => (
          <Button key={item._id} variant={job?._id === item._id ? 'contained' : 'text'} onClick={() => void loadJob(item._id)} sx={{ justifyContent: 'flex-start' }}>
            {item.requestNumber} · {item.customerName} · {item.licensePlate}
          </Button>
        ))}
      </Stack>
      {!job && !loading && <Typography color="text.secondary">Search for a job to build its bill. Totals update as soon as labour or parts change.</Typography>}
      {job && (
        <Stack spacing={2}>
          <Card sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <div>
                <Typography variant="h6">{job.requestNumber}</Typography>
                <Typography color="text.secondary">{job.customerName} · {job.vehicleLabel}</Typography>
              </div>
              <StatusChip value={invoice?.status || 'draft'} label={invoice ? labelOf(invoice.status) : 'Not invoiced'} />
            </Stack>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(job.services || []).map((line) => (
                  <TableRow key={line._id}>
                    <TableCell>{line.name}</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell align="right">{line.quantity}</TableCell>
                    <TableCell align="right">{inr(line.quantity * line.unitPrice)}</TableCell>
                  </TableRow>
                ))}
                {(job.parts || []).map((line) => (
                  <TableRow key={line._id}>
                    <TableCell>{line.sku} · {line.name}</TableCell>
                    <TableCell>Part</TableCell>
                    <TableCell align="right">{line.quantity}</TableCell>
                    <TableCell align="right">{inr(line.quantity * line.unitPrice)}</TableCell>
                  </TableRow>
                ))}
                {!job.services?.length && !job.parts?.length && (
                  <TableRow><TableCell colSpan={4}>Add a service or part on the job before generating an invoice.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <Stack spacing={0.75} sx={{ mt: 2, maxWidth: 320, ml: 'auto' }}>
              <Line label="Services" value={inr(totals.services)} />
              <Line label="Parts" value={inr(totals.parts)} />
              <Line label="Subtotal" value={inr(totals.subtotal)} />
              <Line label={`Tax (${taxRate}%)`} value={inr(invoice?.taxAmount ?? totals.tax)} />
              <Line label="Discount" value={inr(invoice?.discount ?? totals.discount)} />
              <Line label="Grand Total" value={inr(invoice?.total ?? totals.grand)} />
              <Line label="Payment Status" value={invoice ? labelOf(invoice.status) : 'Unbilled'} />
              <Line label="Payment Method" value={invoice?.payments?.[0] ? invoice.payments[0].method.toUpperCase() : method.toUpperCase()} />
            </Stack>
          </Card>
          {!invoice && (
            <Card sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Discount (₹)" type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
                <TextField label="Due in days" type="number" value={dueInDays} onChange={(event) => setDueInDays(Number(event.target.value))} />
                <TextField select label="Payment method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
                  {['cash', 'card', 'upi', 'bank'].map((item) => <MenuItem key={item} value={item}>{item.toUpperCase()}</MenuItem>)}
                </TextField>
                <TextField label="Collect now (₹)" type="number" value={payNow} onChange={(event) => setPayNow(event.target.value)} helperText="Leave blank to invoice only." />
                <Button variant="contained" disabled={!job.services?.length && !job.parts?.length} onClick={() => void generate()}>Generate invoice</Button>
              </Stack>
            </Card>
          )}
          {invoice && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" onClick={() => navigate(`/invoices/${invoice._id}`)}>View invoice</Button>
              <Button variant="outlined" onClick={() => printInvoice(invoice)}>Print invoice</Button>
              <Button variant="outlined" onClick={() => downloadInvoiceFile(invoice)}>Download PDF</Button>
              <Button variant="outlined" onClick={async () => {
                try {
                  const response = await api.post(`/invoices/${invoice._id}/email`)
                  enqueueSnackbar(response.data.message, { variant: 'success' })
                } catch (err) {
                  enqueueSnackbar(errorMessage(err), { variant: 'error' })
                }
              }}>Email invoice</Button>
            </Stack>
          )}
        </Stack>
      )}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={700}>{value}</Typography>
    </Stack>
  )
}
