import { createContext, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import BuildIcon from '@mui/icons-material/Build'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import MenuIcon from '@mui/icons-material/Menu'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import { useSnackbar } from 'notistack'
import { api, errorMessage } from '@/api/client'
import { PageHeader, StatusChip } from '@/components/ui'
import { Field } from '@/components/fields'
import { setUser } from '@/store/authSlice'
import { toggleMode } from '@/store/uiSlice'
import { disconnectSocket } from '@/realtime/socket'
import type { RootState } from '@/store'
import type { Invoice } from '@/types'
import { formatDate, inr, labelOf } from '@/utils/format'
import { downloadInvoiceFile, printInvoice } from '@/utils/invoiceDocument'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

interface PortalVehicle {
  _id: string
  make: string
  model: string
  year: number
  licensePlate: string
  fuelType?: string
  transmission?: string
  mileage?: number
}

interface PortalService {
  _id: string
  name: string
  category: string
  basePrice: number
}

interface PortalAppointment {
  _id: string
  requestNumber: string
  vehicleLabel: string
  status: string
  priority?: string
  description?: string
  diagnosis?: string
  mechanicName?: string
  estimatedCompletion?: string
  createdAt: string
  estimatedCost?: number
  actualCost?: number
  services?: { name: string; quantity: number; unitPrice: number }[]
}

interface PortalInvoice {
  _id: string
  invoiceNumber: string
  total: number
  balance: number
  status: string
  vehicleLabel?: string
  dueDate?: string
  issuedAt?: string
  requestNumber?: string
}

interface PortalData {
  customer: { name: string; phone: string; email?: string; city?: string }
  vehicles: PortalVehicle[]
  appointments: PortalAppointment[]
  invoices: PortalInvoice[]
  services: PortalService[]
  summary: { vehicles: number; openAppointments: number; outstanding: number; nextDate?: string | null }
}

const PortalContext = createContext<{ data: PortalData | null; error: string; reload: () => void }>({ data: null, error: '', reload: () => undefined })

function usePortal() {
  return useContext(PortalContext)
}

const NAV = [
  { label: 'Dashboard', to: '/portal', icon: <DashboardIcon />, color: '#7ad7f0' },
  { label: 'Book service', to: '/portal/book', icon: <EventAvailableIcon />, color: '#f0b06a' },
  { label: 'Vehicles', to: '/portal/vehicles', icon: <DirectionsCarIcon />, color: '#7ddeb4' },
  { label: 'Appointments', to: '/portal/appointments', icon: <BuildIcon />, color: '#d7b0ff' },
  { label: 'Invoices', to: '/portal/invoices', icon: <RequestQuoteIcon />, color: '#9ad0f5' },
]

function activeNav(pathname: string, to: string) {
  if (to === '/portal') return pathname === '/portal'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function PortalLayout() {
  const theme = useTheme()
  const location = useLocation()
  const mdUp = useMediaQuery(theme.breakpoints.up('md'))
  const smDown = useMediaQuery(theme.breakpoints.down('sm'))
  const user = useSelector((state: RootState) => state.auth.user)
  const mode = useSelector((state: RootState) => state.ui.mode)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState('')

  const reload = () => {
    void api.get('/portal').then((response) => {
      setData(response.data.data)
      setError('')
    }).catch((err) => setError(errorMessage(err)))
  }

  useEffect(() => { reload() }, [])
  useEffect(() => { document.documentElement.dataset.theme = mode }, [mode])

  const signOut = async () => {
    await api.post('/auth/logout').catch(() => undefined)
    disconnectSocket()
    dispatch(setUser(null))
    navigate('/login')
  }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e8f4f8' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 750, letterSpacing: '0.16em', color: 'rgba(232,244,248,0.62)' }}>APEX MOTORS</Typography>
        <Typography sx={{ mt: 0.4, fontSize: 22, fontWeight: 750, letterSpacing: -0.4, color: '#fff' }}>My garage</Typography>
        <Typography sx={{ mt: 0.75, color: '#d7eef4', fontWeight: 650 }}>{user?.name}</Typography>
      </Box>
      <List className="nav-scroll" sx={{ px: 1.25, py: 1, flex: 1 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            selected={activeNav(location.pathname, item.to)}
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 2.5,
              mb: 0.4,
              minHeight: 44,
              color: '#e8f4f8',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              '&.Mui-selected': { bgcolor: '#1b7f96', color: '#fff', '&:hover': { bgcolor: '#1b7f96' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: item.color }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: 650, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <PortalContext.Provider value={{ data, error, reload }}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Drawer
          variant={mdUp ? 'permanent' : 'temporary'}
          open={mdUp || open}
          onClose={() => setOpen(false)}
          sx={{ width: mdUp ? 260 : 280, flexShrink: 0, '& .MuiDrawer-paper': { width: mdUp ? 260 : 280, boxSizing: 'border-box', bgcolor: '#0c4a5c', borderRight: 'none', backgroundImage: 'none' } }}
        >
          {drawer}
        </Drawer>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'transparent', backgroundImage: 'none', boxShadow: 'none' }}>
            <Toolbar sx={{ gap: 1 }}>
              {!mdUp && <IconButton aria-label="Open navigation" onClick={() => setOpen(true)} sx={{ color: 'primary.main' }}><MenuIcon /></IconButton>}
              <Typography sx={{ fontWeight: 750, display: { xs: 'none', sm: 'block' } }}>Customer portal</Typography>
              <Box sx={{ flex: 1 }} />
              <IconButton aria-label="Toggle color mode" onClick={() => dispatch(toggleMode())} sx={{ color: '#d4922a' }}>
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <IconButton aria-label="Account menu" onClick={(event) => setAnchor(event.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{user?.name.slice(0, 1)}</Avatar>
              </IconButton>
              <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); navigate('/portal/profile') }}>Profile</MenuItem>
                <MenuItem onClick={() => { setAnchor(null); void signOut() }}><LogoutIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Sign out</MenuItem>
              </Menu>
            </Toolbar>
          </AppBar>
          <Box component="main" className="page-enter" sx={{ p: { xs: 1.5, sm: 2, md: 3 }, pb: { xs: 11, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Outlet />
          </Box>
          {smDown && (
            <Stack direction="row" sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', zIndex: 10 }}>
              {NAV.map((item) => (
                <Button key={item.to} component={NavLink} to={item.to} sx={{ flex: 1, minWidth: 0, py: 1, borderRadius: 0, color: 'text.secondary', '&.active': { color: 'primary.main' } }}>
                  <Stack alignItems="center" spacing={0.25}>
                    <Box sx={{ color: item.color, display: 'flex' }}>{item.icon}</Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{item.label.split(' ')[0]}</Typography>
                  </Stack>
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </PortalContext.Provider>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card sx={(theme) => ({ height: '100%', borderLeft: '6px solid', borderLeftColor: theme.palette.mode === 'dark' ? '#7ec4d6' : '#14627a' })}>
      <CardContent sx={{ py: 2, px: 2.25, '&:last-child': { pb: 2 } }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ mt: 1.5, fontWeight: 750, letterSpacing: -0.6, fontSize: { xs: '1.45rem', sm: '1.75rem' }, lineHeight: 1 }}>{value}</Typography>
      </CardContent>
    </Card>
  )
}

export function PortalDashboard() {
  const { data } = usePortal()
  const navigate = useNavigate()
  if (!data) return <Typography color="text.secondary">Loading your garage…</Typography>
  const open = data.appointments.filter((item) => !['completed', 'cancelled'].includes(item.status)).slice(0, 4)
  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Dashboard"
        subtitle={`Hello ${data.customer.name}. Book a service and follow every job from here.`}
        crumbs={[]}
        root={{ label: 'Dashboard', to: '/portal' }}
        action={<Button variant="contained" onClick={() => navigate('/portal/book')}>Book service</Button>}
      />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' }}>
        <Metric label="Vehicles" value={data.summary.vehicles} />
        <Metric label="Open jobs" value={data.summary.openAppointments} />
        <Metric label="Next visit" value={data.summary.nextDate ? formatDate(data.summary.nextDate) : 'None'} />
        <Metric label="To pay" value={inr(data.summary.outstanding)} />
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' } }}>
        <Card>
          <CardContent>
            <Typography fontWeight={750} sx={{ mb: 1.5 }}>Open appointments</Typography>
            <Stack spacing={1.25}>
              {open.map((item) => (
                <Box key={item._id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/portal/appointments/${item._id}`)}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontWeight={700}>{item.requestNumber}</Typography>
                    <StatusChip value={item.status} label={labelOf(item.status)} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{item.vehicleLabel} · Preferred {formatDate(item.estimatedCompletion)}</Typography>
                </Box>
              ))}
              {!open.length && <Typography color="text.secondary">No open jobs. Book a service when the car needs the workshop.</Typography>}
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography fontWeight={750} sx={{ mb: 1.5 }}>Invoices</Typography>
            <Stack spacing={1.25}>
              {data.invoices.slice(0, 4).map((item) => (
                <Box key={item._id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/portal/invoices/${item._id}`)}>
                  <Typography fontWeight={700}>{item.invoiceNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">{labelOf(item.status)} · Balance {inr(item.balance)}</Typography>
                </Box>
              ))}
              {!data.invoices.length && <Typography color="text.secondary">Invoices appear after the workshop bills a job.</Typography>}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}

export function PortalBookPage() {
  const { data, reload } = usePortal()
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const [vehicleId, setVehicleId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [preferredDate, setPreferredDate] = useState('')
  const [notes, setNotes] = useState('')
  const [serviceQuery, setServiceQuery] = useState('')

  useEffect(() => {
    if (!vehicleId && data?.vehicles[0]) setVehicleId(data.vehicles[0]._id)
  }, [data, vehicleId])

  if (!data) return <Typography color="text.secondary">Loading services…</Typography>
  const services = data.services.filter((service) => service.name.toLowerCase().includes(serviceQuery.trim().toLowerCase()))
  return (
    <Stack spacing={2}>
      <PageHeader title="Book a service" subtitle="Choose your vehicle, a preferred date, and the work you want done." crumbs={[{ label: 'Book service' }]} root={{ label: 'Dashboard', to: '/portal' }} />
      {!data.vehicles.length && <Alert severity="info">Add a vehicle before you book.</Alert>}
      <Card sx={(theme) => ({ borderLeft: '6px solid', borderLeftColor: theme.palette.mode === 'dark' ? '#7ec4d6' : '#14627a' })}>
        <CardContent>
          <Stack spacing={1.5}>
            <TextField select label="Vehicle" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} disabled={!data.vehicles.length}>
              {data.vehicles.map((item) => <MenuItem key={item._id} value={item._id}>{item.year} {item.make} {item.model} · {item.licensePlate}</MenuItem>)}
            </TextField>
            <TextField type="date" label="Preferred date" value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Find a service" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} />
            <Box sx={{ maxHeight: 280, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1 }}>
              {services.map((service) => (
                <FormControlLabel
                  key={service._id}
                  control={<Checkbox checked={serviceIds.includes(service._id)} onChange={(event) => setServiceIds((current) => event.target.checked ? [...current, service._id] : current.filter((id) => id !== service._id))} />}
                  label={`${service.name} · ${inr(service.basePrice)}`}
                />
              ))}
            </Box>
            <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} />
            <Button
              variant="contained"
              disabled={!vehicleId || !serviceIds.length || !preferredDate}
              onClick={async () => {
                try {
                  const response = await api.post('/portal/appointments', { vehicleId, serviceIds, preferredDate, notes })
                  enqueueSnackbar(response.data.message, { variant: 'success' })
                  reload()
                  navigate(`/portal/appointments/${response.data.data._id}`)
                } catch (err) {
                  enqueueSnackbar(errorMessage(err), { variant: 'error' })
                }
              }}
            >
              Book appointment
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export function PortalVehiclesPage() {
  const { data, reload } = usePortal()
  const { enqueueSnackbar } = useSnackbar()
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: new Date().getFullYear(), licensePlate: '', fuelType: 'Petrol', transmission: 'Manual', mileage: 0 })
  if (!data) return <Typography color="text.secondary">Loading vehicles…</Typography>
  return (
    <Stack spacing={2}>
      <PageHeader title="Vehicles" subtitle="Cars registered to your portal account." crumbs={[{ label: 'Vehicles' }]} root={{ label: 'Dashboard', to: '/portal' }} />
      {data.vehicles.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          {data.vehicles.map((item) => (
            <Card key={item._id} sx={(theme) => ({ borderLeft: '6px solid', borderLeftColor: theme.palette.mode === 'dark' ? '#7ec4d6' : '#14627a' })}>
              <CardContent>
                <Typography fontWeight={750}>{item.year} {item.make} {item.model}</Typography>
                <Typography color="text.secondary">{item.licensePlate} · {item.fuelType || 'Petrol'} · {item.transmission || 'Manual'}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
      {!data.vehicles.length && <Typography color="text.secondary" sx={{ textAlign: 'center' }}>No vehicles yet.</Typography>}
      <Card sx={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
          <CardContent>
            <Typography fontWeight={750} sx={{ mb: 1.5 }}>Add a vehicle</Typography>
            <Stack spacing={1.25}>
              <TextField label="Car Name" value={vehicle.make} onChange={(event) => setVehicle({ ...vehicle, make: event.target.value })} />
              <TextField label="Model" value={vehicle.model} onChange={(event) => setVehicle({ ...vehicle, model: event.target.value })} />
              <TextField label="Year" type="number" value={vehicle.year} onChange={(event) => setVehicle({ ...vehicle, year: Number(event.target.value) })} />
              <TextField label="Plate" value={vehicle.licensePlate} onChange={(event) => setVehicle({ ...vehicle, licensePlate: event.target.value })} />
              <TextField label="Mileage" type="number" value={vehicle.mileage} onChange={(event) => setVehicle({ ...vehicle, mileage: Number(event.target.value) })} />
              <TextField select label="Fuel" value={vehicle.fuelType} onChange={(event) => setVehicle({ ...vehicle, fuelType: event.target.value })}>
                {['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select label="Transmission" value={vehicle.transmission} onChange={(event) => setVehicle({ ...vehicle, transmission: event.target.value })}>
                {['Manual', 'Automatic'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <Button variant="contained" onClick={async () => {
                try {
                  await api.post('/portal/vehicles', vehicle)
                  enqueueSnackbar('Vehicle added', { variant: 'success' })
                  setVehicle({ make: '', model: '', year: new Date().getFullYear(), licensePlate: '', fuelType: 'Petrol', transmission: 'Manual', mileage: 0 })
                  reload()
                } catch (err) {
                  enqueueSnackbar(errorMessage(err), { variant: 'error' })
                }
              }}>Add vehicle</Button>
            </Stack>
          </CardContent>
        </Card>
    </Stack>
  )
}

export function PortalAppointmentsPage() {
  const { data } = usePortal()
  const navigate = useNavigate()
  if (!data) return <Typography color="text.secondary">Loading appointments…</Typography>
  return (
    <Stack spacing={2}>
      <PageHeader title="Appointments" subtitle="Every service request on your vehicles." crumbs={[{ label: 'Appointments' }]} root={{ label: 'Dashboard', to: '/portal' }} action={<Button variant="contained" onClick={() => navigate('/portal/book')}>Book service</Button>} />
      <Stack spacing={1.25}>
        {data.appointments.map((item) => (
          <Card key={item._id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/portal/appointments/${item._id}`)}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={750}>{item.requestNumber}</Typography>
                <StatusChip value={item.status} label={labelOf(item.status)} />
              </Stack>
              <Typography color="text.secondary">{item.vehicleLabel}</Typography>
              <Typography variant="body2" color="text.secondary">Preferred {formatDate(item.estimatedCompletion)} · Estimate {inr(item.estimatedCost || item.actualCost || 0)}</Typography>
            </CardContent>
          </Card>
        ))}
        {!data.appointments.length && <Typography color="text.secondary">Bookings will show here.</Typography>}
      </Stack>
    </Stack>
  )
}

export function PortalAppointmentPage() {
  const { id } = useParams()
  const { reload } = usePortal()
  const { enqueueSnackbar } = useSnackbar()
  const [item, setItem] = useState<PortalAppointment | null>(null)
  const [error, setError] = useState('')
  const load = () => {
    void api.get(`/portal/appointments/${id}`).then((response) => setItem(response.data.data)).catch((err) => setError(errorMessage(err)))
  }
  useEffect(() => { load() }, [id])
  if (error) return <Alert severity="error">{error}</Alert>
  if (!item) return <Typography color="text.secondary">Loading appointment…</Typography>
  return (
    <Stack spacing={2}>
      <PageHeader title={item.requestNumber} subtitle={item.vehicleLabel} crumbs={[{ label: 'Appointments', to: '/portal/appointments' }, { label: item.requestNumber }]} root={{ label: 'Dashboard', to: '/portal' }} />
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <StatusChip value={item.status} label={labelOf(item.status)} />
            <Typography>Preferred date: {formatDate(item.estimatedCompletion)}</Typography>
            <Typography>Estimate: {inr(item.estimatedCost || item.actualCost || 0)}</Typography>
            {item.mechanicName && <Typography>Mechanic: {item.mechanicName}</Typography>}
            <Typography color="text.secondary">{item.description}</Typography>
            {item.diagnosis && <Typography>Diagnosis: {item.diagnosis}</Typography>}
            <Typography fontWeight={700} sx={{ mt: 1 }}>Services</Typography>
            {(item.services || []).map((service) => (
              <Typography key={service.name}>{service.name} · {inr(service.unitPrice)}</Typography>
            ))}
            {item.status === 'pending' && (
              <Button color="error" variant="outlined" sx={{ mt: 1, alignSelf: 'flex-start' }} onClick={async () => {
                try {
                  const response = await api.post(`/portal/appointments/${item._id}/cancel`)
                  enqueueSnackbar(response.data.message, { variant: 'success' })
                  reload()
                  load()
                } catch (err) {
                  enqueueSnackbar(errorMessage(err), { variant: 'error' })
                }
              }}>Cancel appointment</Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}

export function PortalInvoicesPage() {
  const { data } = usePortal()
  const navigate = useNavigate()
  if (!data) return <Typography color="text.secondary">Loading invoices…</Typography>
  return (
    <Stack spacing={2}>
      <PageHeader title="Invoices" subtitle="Bills issued for your vehicles. Download or print from the invoice." crumbs={[{ label: 'Invoices' }]} root={{ label: 'Dashboard', to: '/portal' }} />
      <Stack spacing={1.25}>
        {data.invoices.map((item) => (
          <Card key={item._id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/portal/invoices/${item._id}`)}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={750}>{item.invoiceNumber}</Typography>
                <StatusChip value={item.status} label={labelOf(item.status)} />
              </Stack>
              <Typography color="text.secondary">{item.vehicleLabel || 'Workshop invoice'} · Due {formatDate(item.dueDate)}</Typography>
              <Typography variant="body2">Total {inr(item.total)} · Balance {inr(item.balance)}</Typography>
            </CardContent>
          </Card>
        ))}
        {!data.invoices.length && <Typography color="text.secondary">Invoices appear after the workshop bills a job.</Typography>}
      </Stack>
    </Stack>
  )
}

export function PortalInvoicePage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void api.get(`/portal/invoices/${id}`).then((response) => setInvoice(response.data.data)).catch((err) => setError(errorMessage(err)))
  }, [id])
  if (error) return <Alert severity="error">{error}</Alert>
  if (!invoice) return <Typography color="text.secondary">Loading invoice…</Typography>
  return (
    <Stack spacing={2}>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={`${invoice.customerName} · ${labelOf(invoice.status)}`}
        crumbs={[{ label: 'Invoices', to: '/portal/invoices' }, { label: invoice.invoiceNumber }]}
        root={{ label: 'Dashboard', to: '/portal' }}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => printInvoice(invoice)}>Print</Button>
            <Button variant="contained" onClick={() => downloadInvoiceFile(invoice)}>Download PDF</Button>
          </Stack>
        }
      />
      <Card>
        <CardContent>
          <Typography>{invoice.vehicleLabel}</Typography>
          <Typography color="text.secondary">Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueDate)}</Typography>
          <Stack spacing={0.75} sx={{ mt: 2 }}>
            {invoice.items.map((line) => (
              <Stack key={`${line.name}-${line.quantity}`} direction="row" justifyContent="space-between">
                <Typography>{line.name} × {line.quantity}</Typography>
                <Typography>{inr(line.lineTotal)}</Typography>
              </Stack>
            ))}
          </Stack>
          <Typography sx={{ mt: 2 }} fontWeight={750}>Total {inr(invoice.total)}</Typography>
          <Typography>Paid {inr(invoice.amountPaid)} · Balance {inr(invoice.balance)}</Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}

const profileSchema = z.object({
  name: z.string().min(2, 'Enter your name'),
  phone: z.string().min(8, 'Enter a phone number'),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
})

export function PortalProfilePage() {
  const user = useSelector((state: RootState) => state.auth.user)
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name || '', phone: user?.phone || '', currentPassword: '', newPassword: '' } })
  return (
    <Stack spacing={2}>
      <PageHeader title="Profile" subtitle={user?.email} crumbs={[{ label: 'Profile' }]} root={{ label: 'Dashboard', to: '/portal' }} />
      <Card sx={{ p: 2, maxWidth: 560 }}>
        <Stack component="form" spacing={2} onSubmit={form.handleSubmit(async (values) => {
          try {
            const response = await api.put('/auth/profile', { name: values.name, phone: values.phone })
            dispatch(setUser(response.data.data))
            if (values.newPassword) {
              if (!values.currentPassword) {
                enqueueSnackbar('Enter your current password to change it', { variant: 'error' })
                return
              }
              await api.put('/auth/password', { currentPassword: values.currentPassword, newPassword: values.newPassword })
              enqueueSnackbar('Password updated. Sign in again.', { variant: 'success' })
              dispatch(setUser(null))
              return
            }
            enqueueSnackbar('Profile saved', { variant: 'success' })
          } catch (error) {
            enqueueSnackbar(errorMessage(error), { variant: 'error' })
          }
        })}>
          <Field name="name" control={form.control} label="Name" />
          <Field name="phone" control={form.control} label="Phone" />
          <Typography fontWeight={700}>Change password</Typography>
          <Field name="currentPassword" control={form.control} label="Current password" type="password" />
          <Field name="newPassword" control={form.control} label="New password" type="password" />
          <Button type="submit" variant="contained">Save profile</Button>
        </Stack>
      </Card>
    </Stack>
  )
}
