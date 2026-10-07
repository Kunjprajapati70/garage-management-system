import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Box, CircularProgress, CssBaseline, Slide, Stack, ThemeProvider, Typography, type SlideProps } from '@mui/material'
import { SnackbarProvider } from 'notistack'
import { api } from '@/api/client'
import { AppLayout } from '@/components/layout'
import { setReady, setUser } from '@/store/authSlice'
import type { RootState } from '@/store'
import { buildTheme } from '@/theme'
import type { Role } from '@/types'
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from '@/pages/auth'
import { ForbiddenPage, NotFoundPage, ServerErrorPage, UnauthorizedPage } from '@/pages/errors'
import { DashboardPage } from '@/pages/dashboard'
import { CustomerDetailPage, CustomersPage } from '@/pages/customers'
import { VehicleDetailPage, VehicleFormPage, VehiclesPage } from '@/pages/vehicles'
import { RequestCreatePage, RequestsPage } from '@/pages/requests'
import { RequestDetailPage } from '@/pages/requestDetail'
import { MechanicDetailPage, MechanicsPage } from '@/pages/mechanics'
import { PartsPage, ServicesPage } from '@/pages/catalog'
import { InvoiceDetailPage, InvoicesPage } from '@/pages/invoices'
import { BillingPage } from '@/pages/billing'
import { Logo } from '@/components/ui'
import { ReportsPage } from '@/pages/reports'
import { AuditPage, NotificationsPage, ProfilePage, SettingsPage, UsersPage } from '@/pages/admin'
import { PortalAppointmentPage, PortalAppointmentsPage, PortalBookPage, PortalDashboard, PortalInvoicePage, PortalInvoicesPage, PortalLayout, PortalProfilePage, PortalVehiclesPage } from '@/pages/portal'

const ALL: Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC']
const DESK: Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, ready } = useSelector((state: RootState) => state.auth)
  const location = useLocation()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'CUSTOMER' ? '/portal' : '/403'} replace />
  return children
}

function Guest({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSelector((state: RootState) => state.auth)
  if (!ready) return null
  if (user) return <Navigate to={user.role === 'CUSTOMER' ? '/portal' : '/dashboard'} replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Guest><LoginPage /></Guest>} />
      <Route path="/register" element={<Guest><RegisterPage /></Guest>} />
      <Route path="/forgot-password" element={<Guest><ForgotPage /></Guest>} />
      <Route path="/reset-password" element={<ResetPage />} />
      <Route path="/401" element={<UnauthorizedPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route element={<Guard roles={['CUSTOMER']}><PortalLayout /></Guard>}>
        <Route path="/portal" element={<PortalDashboard />} />
        <Route path="/portal/book" element={<PortalBookPage />} />
        <Route path="/portal/vehicles" element={<PortalVehiclesPage />} />
        <Route path="/portal/appointments" element={<PortalAppointmentsPage />} />
        <Route path="/portal/appointments/:id" element={<PortalAppointmentPage />} />
        <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
        <Route path="/portal/invoices/:id" element={<PortalInvoicePage />} />
        <Route path="/portal/profile" element={<PortalProfilePage />} />
      </Route>
      <Route path="/unauthorized" element={<Navigate to="/401" replace />} />
      <Route element={<Guard roles={ALL}><AppLayout /></Guard>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/customers" element={<Guard roles={DESK}><CustomersPage /></Guard>} />
        <Route path="/customers/:id" element={<Guard roles={DESK}><CustomerDetailPage /></Guard>} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/vehicles/new" element={<Guard roles={DESK}><VehicleFormPage /></Guard>} />
        <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/vehicles/:id/edit" element={<Guard roles={DESK}><VehicleFormPage /></Guard>} />
        <Route path="/service-requests" element={<RequestsPage />} />
        <Route path="/service-requests/new" element={<Guard roles={DESK}><RequestCreatePage /></Guard>} />
        <Route path="/service-requests/:id" element={<RequestDetailPage />} />
        <Route path="/mechanics" element={<Guard roles={DESK}><MechanicsPage /></Guard>} />
        <Route path="/mechanics/:id" element={<Guard roles={[...DESK, 'MECHANIC']}><MechanicDetailPage /></Guard>} />
        <Route path="/services" element={<Guard roles={DESK}><ServicesPage /></Guard>} />
        <Route path="/parts" element={<Guard roles={DESK}><PartsPage /></Guard>} />
        <Route path="/billing" element={<Guard roles={DESK}><BillingPage /></Guard>} />
        <Route path="/invoices" element={<Guard roles={DESK}><InvoicesPage /></Guard>} />
        <Route path="/invoices/:id" element={<Guard roles={DESK}><InvoiceDetailPage /></Guard>} />
        <Route path="/reports" element={<Guard roles={['ADMIN', 'MANAGER']}><ReportsPage /></Guard>} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/users" element={<Guard roles={['ADMIN']}><UsersPage /></Guard>} />
        <Route path="/audit-logs" element={<Guard roles={['ADMIN']}><AuditPage /></Guard>} />
        <Route path="/settings" element={<Guard roles={['ADMIN']}><SettingsPage /></Guard>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/forbidden" element={<Navigate to="/403" replace />} />
        <Route path="/server-error" element={<Navigate to="/500" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const dispatch = useDispatch()
  const mode = useSelector((state: RootState) => state.ui.mode)
  const ready = useSelector((state: RootState) => state.auth.ready)
  useEffect(() => {
    void api.get('/auth/me').then((response) => dispatch(setUser(response.data.data))).catch(() => dispatch(setReady()))
  }, [dispatch])
  return (
    <ThemeProvider theme={buildTheme(mode)}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={4000} TransitionComponent={(props: SlideProps) => <Slide {...props} direction="up" />} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {!ready ? (
          <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
            <Stack spacing={2} alignItems="center">
              <Logo />
              <Typography>Loading Apex Motors</Typography>
              <CircularProgress size={28} />
            </Stack>
          </Box>
        ) : (
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        )}
      </SnackbarProvider>
    </ThemeProvider>
  )
}
