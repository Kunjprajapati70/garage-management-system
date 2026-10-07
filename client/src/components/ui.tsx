import { useEffect, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Pagination,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material'
import { subscribeRealtime } from '@/realtime/socket'
import type { Meta } from '@/types'
import { api, errorMessage } from '@/api/client'

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: 'primary.main',
        color: 'secondary.main',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: size * 0.42,
      }}
    >
      A
    </Box>
  )
}

const CRUMB_PATH: Record<string, string> = {
  Dashboard: '/dashboard',
  Customers: '/customers',
  Vehicles: '/vehicles',
  'Service requests': '/service-requests',
  Mechanics: '/mechanics',
  Services: '/services',
  Parts: '/parts',
  Billing: '/billing',
  Invoices: '/invoices',
  Reports: '/reports',
  Notifications: '/notifications',
  Settings: '/settings',
  Profile: '/profile',
  Users: '/users',
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  action,
  root = { label: 'Overview', to: '/dashboard' },
}: {
  title: string
  subtitle?: string
  crumbs?: { label: string; to?: string }[]
  action?: React.ReactNode
  root?: { label: string; to: string }
}) {
  return (
    <Stack spacing={1} sx={{ mb: 2.5 }}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumbs aria-label="Breadcrumb" sx={{ '& .MuiTypography-root, & .MuiLink-root': { fontSize: 13, color: 'text.secondary' } }}>
          <Link component={RouterLink} to={root.to} underline="hover" color="inherit">{root.label}</Link>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1
            const to = crumb.to || CRUMB_PATH[crumb.label]
            if (last || !to) {
              return <Typography key={`${crumb.label}-${index}`} color="text.primary">{crumb.label}</Typography>
            }
            return (
              <Link key={`${crumb.label}-${index}`} component={RouterLink} to={to} underline="hover" color="inherit">
                {crumb.label}
              </Link>
            )
          })}
        </Breadcrumbs>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.65rem', sm: '2rem' }, fontWeight: 800, letterSpacing: -0.6 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', width: { xs: '100%', sm: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 auto', sm: '0 0 auto' } } }}>
            {action}
          </Box>
        )}
      </Stack>
    </Stack>
  )
}

const CHIP_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'warning',
  diagnosing: 'info',
  waiting_for_parts: 'secondary',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'default',
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
  available: 'success',
  busy: 'warning',
  off_duty: 'default',
  paid: 'success',
  issued: 'info',
  partial: 'warning',
  overdue: 'error',
  draft: 'default',
}

export function StatusChip({ value, label }: { value: string; label: string }) {
  return <Chip size="small" label={label} color={CHIP_COLOR[value] || 'default'} sx={{ textTransform: 'capitalize' }} />
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ py: { xs: 4, sm: 6 }, px: 2, textAlign: 'center' }}>
      <Typography variant="h6">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
        {body}
      </Typography>
      {action}
    </Box>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export interface Column<T> {
  id: string
  header: string
  render: (row: T) => React.ReactNode
  sortKey?: string
  mobile?: 'title' | 'meta' | 'chip' | 'hide'
}

export function DataTable<T extends { _id: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  meta,
  onPage,
  sort,
  onSort,
  onRow,
  emptyTitle,
  emptyBody,
  emptyAction,
  hasFilters,
}: {
  columns: Column<T>[]
  rows: T[]
  loading: boolean
  error?: string
  onRetry?: () => void
  meta?: Meta
  onPage?: (page: number) => void
  sort?: string
  onSort?: (sort: string) => void
  onRow?: (row: T) => void
  emptyTitle: string
  emptyBody: string
  emptyAction?: React.ReactNode
  hasFilters?: boolean
}) {
  if (error) return <Card sx={{ p: 2 }}><ErrorState message={error} onRetry={onRetry} /></Card>
  if (loading) {
    return (
      <Card sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" height={52} />
          ))}
        </Stack>
      </Card>
    )
  }
  if (!rows.length) {
    return (
      <Card>
        <EmptyState
          title={hasFilters ? 'No matching records' : emptyTitle}
          body={hasFilters ? 'Try a different search or clear the filters.' : emptyBody}
          action={emptyAction}
        />
      </Card>
    )
  }
  const activeSort = sort?.replace(/^-/, '')
  const direction = sort?.startsWith('-') ? 'desc' : 'asc'
  return (
    <Stack spacing={2}>
      <Card sx={{ overflow: 'hidden' }}>
      <TableContainer sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto', maxWidth: '100%' }}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} sortDirection={activeSort === column.sortKey ? direction : false}>
                  {column.sortKey && onSort ? (
                    <TableSortLabel
                      active={activeSort === column.sortKey}
                      direction={activeSort === column.sortKey ? direction : 'asc'}
                      onClick={() => onSort(activeSort === column.sortKey && direction === 'asc' ? `-${column.sortKey}` : column.sortKey!)}
                    >
                      {column.header}
                    </TableSortLabel>
                  ) : (
                    column.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id} hover={Boolean(onRow)} onClick={onRow ? () => onRow(row) : undefined} sx={{ cursor: onRow ? 'pointer' : 'default', '&:hover': { backgroundColor: 'action.hover' } }}>
                {columns.map((column) => (
                  <TableCell key={column.id} sx={{ overflowWrap: 'anywhere', maxWidth: 320 }}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, p: 1.5 }}>
        {rows.map((row) => {
          const title = columns.find((column) => column.mobile === 'title') || columns[0]
          const chips = columns.filter((column) => column.mobile === 'chip')
          const metaCols = columns.filter((column) => column.mobile === 'meta')
          return (
            <Card key={row._id} variant="outlined">
              <CardActionArea onClick={onRow ? () => onRow(row) : undefined} sx={{ p: 1.5, alignItems: 'stretch' }}>
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title.render(row)}</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" justifyContent="flex-end" sx={{ flexShrink: 0, maxWidth: '46%' }}>
                      {chips.map((column) => (
                        <Box key={column.id}>{column.render(row)}</Box>
                      ))}
                    </Stack>
                  </Stack>
                  {metaCols.map((column) => (
                    <Typography key={column.id} variant="body2" color="text.secondary">
                      {column.header}: {column.render(row)}
                    </Typography>
                  ))}
                </Stack>
              </CardActionArea>
            </Card>
          )
        })}
      </Stack>
      </Card>
      {meta && onPage && meta.totalPages > 1 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </Typography>
          <Pagination color="primary" siblingCount={0} page={meta.page} count={meta.totalPages} onChange={(_event, page) => onPage(page)} sx={{ '& .MuiPagination-ul': { flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-end' } } }} />
        </Stack>
      )}
    </Stack>
  )
}

export function useServerList<T>(path: string, events: string[], options?: { limit?: number }) {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<T[]>([])
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: options?.limit || 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const key = events.join('|')

  useEffect(() => {
    return subscribeRealtime((event) => {
      if (events.includes(event)) setTick((value) => value + 1)
    })
  }, [key])

  const load = async () => {
    setLoading(true)
    try {
      const query = Object.fromEntries(params.entries())
      if (!query.limit && options?.limit) query.limit = String(options.limit)
      const response = await api.get(path, { params: query })
      setRows(response.data.data)
      setMeta(response.data.meta)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [params.toString(), tick, path])

  const update = (patch: Record<string, string | number | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([name, value]) => {
      if (value === undefined || value === '' || value === 'all') next.delete(name)
      else next.set(name, String(value))
    })
    if (resetPage && patch.page === undefined) next.set('page', '1')
    setParams(next)
  }

  return { params, rows, meta, loading, error, reload: load, update }
}

export const filterRowSx = {
  mb: 2,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  '& > .MuiFormControl-root, & > .MuiTextField-root': { flex: '1 1 180px', minWidth: 0, maxWidth: { xs: '100%', md: 320 } },
}

export function ChartCaption({ x, y }: { x: string; y: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
      X-axis: {x} · Y-axis: {y}
    </Typography>
  )
}
