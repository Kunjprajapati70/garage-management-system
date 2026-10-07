import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, errorMessage } from '@/api/client'
import { ConfirmDialog, DataTable, PageHeader, StatusChip, filterRowSx, useServerList } from '@/components/ui'
import { Field } from '@/components/fields'
import type { RootState } from '@/store'
import type { CatalogService, Part } from '@/types'
import { inr } from '@/utils/format'

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  category: z.string().trim().min(2, 'Enter a category'),
  basePrice: z.coerce.number().min(0),
  estimatedHours: z.coerce.number().min(0),
  description: z.string().optional(),
})

const partSchema = z.object({
  sku: z.string().trim().min(2, 'Enter a SKU'),
  name: z.string().trim().min(2, 'Enter a name'),
  category: z.string().trim().min(2, 'Enter a category'),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  unitPrice: z.coerce.number().min(0),
  supplier: z.string().optional(),
  location: z.string().optional(),
})

export function ServicesPage() {
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const canEdit = role === 'ADMIN' || role === 'MANAGER'
  const list = useServerList<CatalogService>('/services', ['service:created', 'service:updated'])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState<CatalogService | null>(null)
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm({ resolver: zodResolver(serviceSchema), defaultValues: { name: '', category: '', basePrice: 0, estimatedHours: 1, description: '' } })
  useEffect(() => {
    const handle = setTimeout(() => list.update({ search }), 300)
    return () => clearTimeout(handle)
  }, [search])
  useEffect(() => {
    form.reset(editing ? { name: editing.name, category: editing.category, basePrice: editing.basePrice, estimatedHours: editing.estimatedHours, description: editing.description || '' } : { name: '', category: '', basePrice: 0, estimatedHours: 1, description: '' })
  }, [editing, open])
  return (
    <div>
      <PageHeader title="Services" subtitle="Labour the workshop sells, with a standard price and time." crumbs={[{ label: 'Services' }]} action={canEdit ? <Button variant="contained" onClick={() => { setEditing(null); setOpen(true) }}>Add service</Button> : undefined} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search services" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" select label="Status" value={list.params.get('active') || 'all'} onChange={(event) => list.update({ active: event.target.value === 'all' ? undefined : event.target.value })} sx={{ minWidth: 140 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { id: 'name', header: 'Service', sortKey: 'name', mobile: 'title', render: (row) => row.name },
          { id: 'category', header: 'Category', sortKey: 'category', mobile: 'meta', render: (row) => row.category },
          { id: 'price', header: 'Price', sortKey: 'basePrice', mobile: 'chip', render: (row) => inr(row.basePrice) },
          { id: 'hours', header: 'Duration', mobile: 'meta', render: (row) => `${row.estimatedHours} h` },
          { id: 'description', header: 'Description', mobile: 'hide', render: (row) => row.description || '—' },
          { id: 'active', header: 'Status', mobile: 'chip', render: (row) => <StatusChip value={row.isActive ? 'available' : 'cancelled'} label={row.isActive ? 'Active' : 'Inactive'} /> },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        onPage={(page) => list.update({ page }, false)}
        onSort={(sort) => list.update({ sort })}
        sort={list.params.get('sort') || undefined}
        onRow={canEdit ? (row) => { setEditing(row); setOpen(true) } : undefined}
        emptyTitle="No services in the catalogue"
        emptyBody="Add the labour operations your bays perform."
        hasFilters={Boolean(search || list.params.get('active'))}
      />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit service' : 'New service'}</DialogTitle>
        <DialogContent>
          <Stack component="form" id="service-form" spacing={2} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
            try {
              if (editing) await api.put(`/services/${editing._id}`, { ...values, isActive: editing.isActive })
              else await api.post('/services', values)
              enqueueSnackbar('Service saved', { variant: 'success' })
              setOpen(false)
              list.reload()
            } catch (error) {
              enqueueSnackbar(errorMessage(error), { variant: 'error' })
            }
          })}>
            <Field name="name" control={form.control} label="Name" />
            <Field name="category" control={form.control} label="Category" />
            <Field name="basePrice" control={form.control} label="Base price (₹)" type="number" />
            <Field name="estimatedHours" control={form.control} label="Estimated hours" type="number" />
            <Field name="description" control={form.control} label="Description" multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          {editing && role === 'ADMIN' && <Button color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="service-form" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this service?"
        message="The catalogue entry is removed. Jobs that already used it keep their line items."
        confirmLabel="Delete service"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!editing) return
          try {
            await api.delete(`/services/${editing._id}`)
            enqueueSnackbar('Service deleted', { variant: 'success' })
            setConfirmDelete(false)
            setOpen(false)
            list.reload()
          } catch (error) {
            enqueueSnackbar(errorMessage(error), { variant: 'error' })
          }
        }}
      />
    </div>
  )
}

export function PartsPage() {
  const role = useSelector((state: RootState) => state.auth.user?.role)
  const canEdit = role === 'ADMIN' || role === 'MANAGER'
  const list = useServerList<Part>('/parts', ['serviceRequest:parts', 'parts:updated'])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState<Part | null>(null)
  const [stockFor, setStockFor] = useState<Part | null>(null)
  const [delta, setDelta] = useState(1)
  const [reason, setReason] = useState('')
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm({ resolver: zodResolver(partSchema), defaultValues: { sku: '', name: '', category: '', quantity: 0, minStock: 5, unitPrice: 0, supplier: '', location: '' } })
  useEffect(() => {
    const handle = setTimeout(() => list.update({ search }), 300)
    return () => clearTimeout(handle)
  }, [search])
  useEffect(() => {
    form.reset(editing ? { sku: editing.sku, name: editing.name, category: editing.category, quantity: editing.quantity, minStock: editing.minStock, unitPrice: editing.unitPrice, supplier: editing.supplier || '', location: editing.location || '' } : { sku: '', name: '', category: '', quantity: 0, minStock: 5, unitPrice: 0, supplier: '', location: '' })
  }, [editing, open])
  return (
    <div>
      <PageHeader title="Parts" subtitle="Stock on hand, reorder level, and the bay it lives in." crumbs={[{ label: 'Parts' }]} action={canEdit ? <Button variant="contained" onClick={() => { setEditing(null); setOpen(true) }}>Add part</Button> : undefined} />
      {list.rows.some((row) => row.quantity <= row.minStock) && <Alert severity="warning" sx={{ mb: 2 }}>Low stock: one or more parts on this page are at or below the reorder level.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search SKU or name" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" select label="Stock" value={list.params.get('lowStock') || 'all'} onChange={(event) => list.update({ lowStock: event.target.value === 'true' ? 'true' : undefined })} sx={{ minWidth: 160 }}>
          <MenuItem value="all">All parts</MenuItem>
          <MenuItem value="true">Low stock</MenuItem>
        </TextField>
      </Stack>
      <DataTable
        columns={[
          { id: 'sku', header: 'SKU', sortKey: 'sku', mobile: 'title', render: (row) => row.sku },
          { id: 'name', header: 'Part', sortKey: 'name', mobile: 'meta', render: (row) => row.name },
          { id: 'qty', header: 'On hand', sortKey: 'quantity', mobile: 'chip', render: (row) => <StatusChip value={row.quantity <= row.minStock ? 'urgent' : 'available'} label={`${row.quantity}`} /> },
          { id: 'min', header: 'Min', mobile: 'hide', render: (row) => row.minStock },
          { id: 'price', header: 'Unit price', sortKey: 'unitPrice', mobile: 'meta', render: (row) => inr(row.unitPrice) },
          { id: 'supplier', header: 'Supplier', mobile: 'hide', render: (row) => row.supplier || '—' },
          { id: 'bin', header: 'Location', mobile: 'hide', render: (row) => row.location || '—' },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        onPage={(page) => list.update({ page }, false)}
        onSort={(sort) => list.update({ sort })}
        sort={list.params.get('sort') || undefined}
        onRow={canEdit ? (row) => { setEditing(row); setOpen(true) } : undefined}
        emptyTitle="No parts in stock"
        emptyBody="Add the parts your bays draw from."
        hasFilters={Boolean(search || list.params.get('lowStock'))}
      />
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit part' : 'New part'}</DialogTitle>
        <DialogContent>
          <Stack component="form" id="part-form" spacing={2} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
            try {
              if (editing) await api.put(`/parts/${editing._id}`, values)
              else await api.post('/parts', values)
              enqueueSnackbar('Part saved', { variant: 'success' })
              setOpen(false)
              list.reload()
            } catch (error) {
              enqueueSnackbar(errorMessage(error), { variant: 'error' })
            }
          })}>
            <Field name="sku" control={form.control} label="SKU" />
            <Field name="name" control={form.control} label="Name" />
            <Field name="category" control={form.control} label="Category" />
            <Field name="quantity" control={form.control} label="Quantity" type="number" />
            <Field name="minStock" control={form.control} label="Minimum stock" type="number" />
            <Field name="unitPrice" control={form.control} label="Unit price (₹)" type="number" />
            <Field name="supplier" control={form.control} label="Supplier" />
            <Field name="location" control={form.control} label="Bin location" />
          </Stack>
        </DialogContent>
        <DialogActions>
          {editing && <Button onClick={() => { setStockFor(editing); setOpen(false) }}>Adjust stock</Button>}
          {editing && role === 'ADMIN' && <Button color="error" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="part-form" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(stockFor)} onClose={() => setStockFor(null)} fullWidth maxWidth="xs">
        <DialogTitle>Adjust {stockFor?.sku}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField type="number" label="Quantity change" value={delta} onChange={(event) => setDelta(Number(event.target.value))} helperText="Positive receives stock. Negative writes it off." />
            <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} error={reason.trim().length > 0 && reason.trim().length < 3} helperText="Recorded in the audit log." />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockFor(null)}>Cancel</Button>
          <Button variant="contained" disabled={reason.trim().length < 3 || !delta} onClick={async () => {
            try {
              await api.post(`/parts/${stockFor?._id}/stock`, { quantity: delta, reason })
              enqueueSnackbar('Stock updated', { variant: 'success' })
              setStockFor(null)
              setReason('')
              list.reload()
            } catch (error) {
              enqueueSnackbar(errorMessage(error), { variant: 'error' })
            }
          }}>Apply</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this part?"
        message="The part leaves the catalogue. Stock already drawn onto jobs is not returned."
        confirmLabel="Delete part"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!editing) return
          try {
            await api.delete(`/parts/${editing._id}`)
            enqueueSnackbar('Part deleted', { variant: 'success' })
            setConfirmDelete(false)
            setOpen(false)
            list.reload()
          } catch (error) {
            enqueueSnackbar(errorMessage(error), { variant: 'error' })
          }
        }}
      />
    </div>
  )
}
