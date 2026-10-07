import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import type { Invoice } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'
import { downloadInvoiceFile, printInvoice } from '@/utils/invoiceDocument'

export { downloadInvoiceFile, printInvoice }

export function InvoicesPage() {
  const navigate = useNavigate()
  const list = useServerList<Invoice>('/invoices', ['invoice:created', 'billing:updated'])
  const [search, setSearch] = useState(list.params.get('search') || '')
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((list.params.get('search') || '') !== search) list.update({ search })
    }, 300)
    return () => clearTimeout(handle)
  }, [search])
  return (
    <div>
      <PageHeader title="Invoices" subtitle="Invoices raised from completed work, and what is still outstanding." crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Invoices' }]} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search invoice, customer, or request" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" select label="Status" value={list.params.get('status') || 'all'} onChange={(event) => list.update({ status: event.target.value })} sx={{ minWidth: 160 }}>
          {['all', 'outstanding', 'issued', 'partial', 'paid', 'overdue', 'cancelled'].map((status) => <MenuItem key={status} value={status}>{status === 'all' ? 'All' : labelOf(status)}</MenuItem>)}
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { id: 'number', header: 'Invoice', sortKey: 'invoiceNumber', mobile: 'title', render: (row) => row.invoiceNumber },
          { id: 'customer', header: 'Customer', sortKey: 'customerName', mobile: 'meta', render: (row) => row.customerName },
          { id: 'total', header: 'Total', sortKey: 'total', mobile: 'meta', render: (row) => inr(row.total) },
          { id: 'balance', header: 'Balance', sortKey: 'balance', mobile: 'chip', render: (row) => inr(row.balance) },
          { id: 'status', header: 'Status', sortKey: 'status', mobile: 'chip', render: (row) => <StatusChip value={row.status} label={labelOf(row.status)} /> },
          { id: 'due', header: 'Due', sortKey: 'dueDate', mobile: 'hide', render: (row) => formatDate(row.dueDate) },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        sort={list.params.get('sort') || undefined}
        onSort={(sort) => list.update({ sort })}
        onPage={(page) => list.update({ page }, false)}
        onRow={(row) => navigate(`/invoices/${row._id}`)}
        emptyTitle="No invoices"
        emptyBody="Generate an invoice from a service request once labour or parts are added."
        hasFilters={Boolean(search || list.params.get('status'))}
      />
    </div>
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams()
  const { enqueueSnackbar } = useSnackbar()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'card' | 'upi' | 'bank'>('upi')
  const [reference, setReference] = useState('')
  const load = () => {
    void api.get(`/invoices/${id}`).then((response) => {
      setInvoice(response.data.data)
      setAmount(String(response.data.data.balance || ''))
    }).catch((err) => setError(errorMessage(err)))
  }
  useEffect(() => { load() }, [id])
  if (error) return <Typography color="error">{error}</Typography>
  if (!invoice) return <Typography color="text.secondary">Loading invoice…</Typography>
  const garage = invoice.garage
  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={invoice.customerName}
        crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Invoices', to: '/invoices' }, { label: invoice.invoiceNumber }]}
        action={<Stack direction="row" spacing={1} className="no-print"><Button variant="outlined" onClick={() => printInvoice(invoice)}>Print</Button><Button variant="outlined" onClick={() => downloadInvoiceFile(invoice)}>Download PDF</Button><Button variant="contained" onClick={async () => {
          try {
            const response = await api.post(`/invoices/${invoice._id}/email`)
            enqueueSnackbar(response.data.message, { variant: 'success' })
          } catch (err) {
            enqueueSnackbar(errorMessage(err), { variant: 'error' })
          }
        }}>Email invoice</Button></Stack>}
      />
      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <div>
            <Typography variant="h6">{garage?.garageName || 'Apex Motors'}</Typography>
            <Typography color="text.secondary">{garage?.address} {garage?.city}</Typography>
            <Typography color="text.secondary">{garage?.phone} · GSTIN {garage?.gstin || '—'}</Typography>
          </div>
          <div>
            <StatusChip value={invoice.status} label={labelOf(invoice.status)} />
            <Typography sx={{ mt: 1 }}>Issued {formatDate(invoice.issuedAt)}</Typography>
            <Typography>Due {formatDate(invoice.dueDate)}</Typography>
            <Typography color="text.secondary">{invoice.vehicleLabel}</Typography>
            {invoice.requestNumber && <Typography color="text.secondary">Job {invoice.requestNumber}</Typography>}
          </div>
        </Stack>
        <Stack spacing={1} sx={{ mt: 3 }}>
          {invoice.items.map((item, index) => (
            <Stack key={`${item.name}-${index}`} direction="row" justifyContent="space-between">
              <Typography>{item.kind === 'part' ? item.sku : 'Labour'} · {item.name} × {item.quantity}</Typography>
              <Typography>{inr(item.lineTotal)}</Typography>
            </Stack>
          ))}
        </Stack>
        <Stack spacing={0.5} sx={{ mt: 2, maxWidth: 280, ml: 'auto' }}>
          <Row label="Subtotal" value={inr(invoice.subtotal)} />
          <Row label="Discount" value={inr(invoice.discount)} />
          <Row label={`GST ${invoice.taxRate}%`} value={inr(invoice.taxAmount)} />
          <Row label="Total" value={inr(invoice.total)} />
          <Row label="Paid" value={inr(invoice.amountPaid)} />
          <Row label="Balance" value={inr(invoice.balance)} />
        </Stack>
      </Card>
      <Card sx={{ p: 2, mt: 2 }} className="no-print">
        <Typography fontWeight={700}>Payments</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {(invoice.payments || []).map((payment) => (
            <Typography key={payment._id}>{formatDate(payment.paidAt)} · {payment.method.toUpperCase()} · {inr(payment.amount)} · {payment.reference || 'no reference'} · {payment.receivedByName}</Typography>
          ))}
          {!invoice.payments?.length && <Typography color="text.secondary">No payments recorded.</Typography>}
        </Stack>
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <TextField label="Amount (₹)" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} error={Number(amount) <= 0 || Number(amount) > invoice.balance} helperText={`Balance ${inr(invoice.balance)}`} />
            <TextField select label="Method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              {['cash', 'card', 'upi', 'bank'].map((item) => <MenuItem key={item} value={item}>{item.toUpperCase()}</MenuItem>)}
            </TextField>
            <TextField label="Reference" value={reference} onChange={(event) => setReference(event.target.value)} />
            <Button variant="contained" disabled={Number(amount) <= 0 || Number(amount) > invoice.balance} onClick={async () => {
              try {
                await api.post(`/invoices/${invoice._id}/payments`, { amount: Number(amount), method, reference })
                enqueueSnackbar('Payment recorded', { variant: 'success' })
                load()
              } catch (err) {
                enqueueSnackbar(errorMessage(err), { variant: 'error' })
              }
            }}>Record payment</Button>
          </Stack>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <Stack direction="row" justifyContent="space-between"><Typography>{label}</Typography><Typography fontWeight={700}>{value}</Typography></Stack>
}
