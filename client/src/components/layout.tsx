import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useSnackbar } from 'notistack'
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import BuildIcon from '@mui/icons-material/Build'
import EngineeringIcon from '@mui/icons-material/Engineering'
import HandymanIcon from '@mui/icons-material/Handyman'
import InventoryIcon from '@mui/icons-material/Inventory2'
import ReceiptIcon from '@mui/icons-material/ReceiptLong'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import InsightsIcon from '@mui/icons-material/Insights'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import HistoryIcon from '@mui/icons-material/History'
import SettingsIcon from '@mui/icons-material/Settings'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { AppDispatch, RootState } from '@/store'
import { setUser } from '@/store/authSlice'
import { setDrawer, setUnread, toggleCollapsed, toggleMode } from '@/store/uiSlice'
import { api } from '@/api/client'
import { connectSocket, disconnectSocket, subscribeRealtime } from '@/realtime/socket'
import type { Role } from '@/types'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  color: string
  roles: Role[]
}

const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, color: '#7ad7f0', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'] },
  { label: 'Customers', to: '/customers', icon: <PeopleIcon />, color: '#9eb6ff', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Vehicles', to: '/vehicles', icon: <DirectionsCarIcon />, color: '#7ddeb4', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'] },
  { label: 'Service Requests', to: '/service-requests', icon: <BuildIcon />, color: '#f0b06a', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'] },
  { label: 'Mechanics', to: '/mechanics', icon: <EngineeringIcon />, color: '#d7b0ff', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Services', to: '/services', icon: <HandymanIcon />, color: '#6ee0c0', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Parts', to: '/parts', icon: <InventoryIcon />, color: '#f2d27a', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Billing', to: '/billing', icon: <ReceiptIcon />, color: '#f0a898', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Invoices', to: '/invoices', icon: <RequestQuoteIcon />, color: '#9ad0f5', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { label: 'Reports', to: '/reports', icon: <InsightsIcon />, color: '#f0c56a', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Notifications', to: '/notifications', icon: <NotificationsIcon />, color: '#f2a0b8', roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'] },
  { label: 'Users', to: '/users', icon: <ManageAccountsIcon />, color: '#c4b6ff', roles: ['ADMIN'] },
  { label: 'Audit log', to: '/audit-logs', icon: <HistoryIcon />, color: '#e7c4a0', roles: ['ADMIN'] },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon />, color: '#9fd6e4', roles: ['ADMIN'] },
]

const GROUPS: { label: string; paths: string[] }[] = [
  { label: 'Overview', paths: ['/dashboard', '/reports'] },
  { label: 'Workshop', paths: ['/customers', '/vehicles', '/service-requests', '/mechanics', '/services', '/parts'] },
  { label: 'Office', paths: ['/billing', '/invoices', '/notifications'] },
  { label: 'Administration', paths: ['/users', '/audit-logs', '/settings'] },
]

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  RECEPTIONIST: 'Reception',
  MECHANIC: 'Mechanic',
  CUSTOMER: 'Customer',
}

const PAGE_TITLES: [string, string][] = [
  ['/service-requests', 'Service Requests'],
  ['/customers', 'Customers'],
  ['/vehicles', 'Vehicles'],
  ['/mechanics', 'Mechanics'],
  ['/services', 'Services'],
  ['/parts', 'Parts'],
  ['/billing', 'Billing'],
  ['/invoices', 'Invoices'],
  ['/reports', 'Reports'],
  ['/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/profile', 'Profile'],
  ['/users', 'Users'],
  ['/audit-logs', 'Audit log'],
  ['/dashboard', 'Dashboard'],
]

function pageTitle(pathname: string) {
  return PAGE_TITLES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] || 'Apex Motors'
}

function itemLabel(item: NavItem, role?: Role) {
  if (item.to === '/service-requests' && role === 'MECHANIC') return 'My Jobs'
  return item.label
}

export function AppLayout() {
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up('md'))
  const smDown = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useDispatch<AppDispatch>()
  const user = useSelector((state: RootState) => state.auth.user)
  const serverDown = useSelector((state: RootState) => state.auth.serverDown)
  const { mode, drawerOpen, collapsed, pendingRequests, connection, unread } = useSelector((state: RootState) => state.ui)
  const navigate = useNavigate()
  const location = useLocation()
  const { enqueueSnackbar } = useSnackbar()
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [search, setSearch] = useState('')
  const title = pageTitle(location.pathname)

  const items = useMemo(() => NAV.filter((item) => (user ? item.roles.includes(user.role) : false)), [user])
  const width = mdUp ? (collapsed ? 84 : 260) : 280

  useEffect(() => {
    connectSocket()
    return () => disconnectSocket()
  }, [user?._id])

  useEffect(() => {
    document.title = `${title} · Apex Motors`
  }, [title])

  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])

  useEffect(() => {
    const load = () => {
      void api.get('/notifications', { params: { limit: 1, unread: 'true' } }).then((response) => {
        dispatch(setUnread(response.data.meta?.unread || 0))
      })
    }
    load()
    return subscribeRealtime((event, payload) => {
      if (event !== 'notification:created') return
      load()
      const notice = payload as { title?: string; message?: string } | undefined
      enqueueSnackbar(notice?.title || 'New notification', { variant: 'info', autoHideDuration: 4000 })
    })
  }, [user?._id, dispatch, enqueueSnackbar])

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined)
    disconnectSocket()
    dispatch(setUser(null))
    navigate('/login')
  }

  const showLabels = !collapsed || !mdUp
  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#e8f4f8' }}>
      <Box sx={{ px: showLabels ? 2.5 : 1.25, pt: 2.5, pb: 1.5 }}>
        {showLabels ? (
          <>
            <Typography sx={{ fontSize: 11, fontWeight: 750, letterSpacing: '0.16em', color: 'rgba(232,244,248,0.62)' }}>APEX MOTORS</Typography>
            <Typography sx={{ mt: 0.4, fontSize: 22, fontWeight: 750, letterSpacing: -0.4, lineHeight: 1.15, color: '#fff' }}>Workshop</Typography>
            {user && (
              <Chip
                label={ROLE_LABEL[user.role]}
                size="small"
                variant="outlined"
                sx={{ mt: 1.25, height: 26, color: '#d7eef4', borderColor: 'rgba(255,255,255,0.28)', bgcolor: 'rgba(255,255,255,0.06)', fontWeight: 650 }}
              />
            )}
          </>
        ) : (
          <Typography sx={{ textAlign: 'center', fontWeight: 800, color: '#fff' }}>A</Typography>
        )}
      </Box>
      <List className="nav-scroll" sx={{ px: 1.25, py: 1, flex: 1, overflowY: 'auto' }}>
        {GROUPS.map((group) => {
          const groupItems = items.filter((item) => group.paths.includes(item.to))
          if (!groupItems.length) return null
          return (
            <Box key={group.label} sx={{ mb: 1 }}>
              {showLabels && (
                <Typography sx={{ px: 1.25, pt: 1.25, pb: 0.5, fontSize: 11, fontWeight: 750, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(232,244,248,0.5)' }}>
                  {group.label}
                </Typography>
              )}
              {groupItems.map((item) => {
                const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                const label = itemLabel(item, user?.role)
                return (
                  <Tooltip key={item.to} title={collapsed && mdUp ? label : ''} placement="right">
                    <ListItemButton
                      component={NavLink}
                      to={item.to}
                      selected={active}
                      onClick={() => dispatch(setDrawer(false))}
                      sx={{
                        borderRadius: 2.5,
                        mb: 0.4,
                        minHeight: 44,
                        minWidth: 0,
                        color: '#e8f4f8',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                        '&.Mui-selected': { bgcolor: '#1b7f96', color: '#fff', '&:hover': { bgcolor: '#1b7f96' } },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: item.color }}>{item.icon}</ListItemIcon>
                      {showLabels && <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: 650, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } } }} />}
                    </ListItemButton>
                  </Tooltip>
                )
              })}
            </Box>
          )
        })}
      </List>
    </Box>
  )

  const bottom = items.filter((item) => ['/dashboard', '/service-requests', user?.role === 'MECHANIC' ? '/vehicles' : '/customers', '/notifications'].includes(item.to)).slice(0, 4)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', overflowX: 'hidden' }}>
      <Drawer
        variant={mdUp ? 'permanent' : 'temporary'}
        open={mdUp || drawerOpen}
        onClose={() => dispatch(setDrawer(false))}
        ModalProps={{ keepMounted: true }}
        sx={{ width, flexShrink: 0, '& .MuiDrawer-paper': { width, boxSizing: 'border-box', bgcolor: '#0c4a5c', color: '#e8f4f8', borderRight: 'none', backgroundImage: 'none' } }}
      >
        {drawer}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'transparent', backgroundImage: 'none', boxShadow: 'none', color: 'text.primary' }} className="no-print">
          {pendingRequests > 0 && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 }} />}
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" aria-label={mdUp ? 'Collapse navigation' : 'Open navigation'} onClick={() => (mdUp ? dispatch(toggleCollapsed()) : dispatch(setDrawer(true)))} sx={{ color: 'primary.main' }}>
              {mdUp ? collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
            <TextField
              size="small"
              placeholder="Search jobs, plates, customers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && search.trim()) navigate(`/service-requests?search=${encodeURIComponent(search.trim())}`)
              }}
              sx={{ flex: 1, minWidth: 0, maxWidth: { xs: '100%', sm: 320 }, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', borderRadius: 999 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Typography noWrap sx={{ display: { xs: 'none', md: 'block' }, color: 'text.secondary', fontWeight: 650 }}>{user ? ROLE_LABEL[user.role] : title}</Typography>
            <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
            <Chip
              size="small"
              label={connection === 'connected' ? 'Connected' : connection === 'retrying' ? 'Retrying' : connection === 'reconnecting' ? 'Reconnecting' : 'Disconnected'}
              color={connection === 'connected' ? 'success' : connection === 'disconnected' ? 'default' : 'warning'}
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
            <IconButton aria-label="Toggle color mode" onClick={() => dispatch(toggleMode())} sx={{ color: '#d4922a' }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <IconButton aria-label="Notifications" onClick={() => navigate('/notifications')} sx={{ color: '#d4657a' }}>
              <Badge color="error" badgeContent={unread} max={99}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton aria-label="Account menu" onClick={(event) => setAnchor(event.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{user?.name.slice(0, 1)}</Avatar>
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem disabled>{user?.name} · {user?.role}</MenuItem>
              <MenuItem onClick={() => { setAnchor(null); navigate('/profile') }}>Profile</MenuItem>
              <MenuItem onClick={() => { setAnchor(null); void logout() }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        {serverDown && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'error.main', color: 'error.contrastText' }}>
            Server unavailable. Check your connection and that the API is running.
          </Box>
        )}
        <Box key={location.pathname} component="main" className="page-enter" sx={{ p: { xs: 1.5, sm: 2, md: 3 }, pb: { xs: 11, sm: 3 }, width: '100%', maxWidth: 1440, mx: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </Box>
        {smDown && (
          <BottomNavigation
            showLabels
            value={bottom.find((item) => location.pathname.startsWith(item.to))?.to || false}
            onChange={(_event, value) => {
              if (value === 'more') dispatch(setDrawer(true))
              else navigate(value)
            }}
            sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: '1px solid', borderColor: 'divider', zIndex: 10 }}
            className="no-print"
          >
            {bottom.map((item) => (
              <BottomNavigationAction key={item.to} label={itemLabel(item, user?.role)} value={item.to} icon={<Box sx={{ color: item.color, display: 'flex' }}>{item.icon}</Box>} />
            ))}
            <BottomNavigationAction label="More" value="more" icon={<MenuIcon sx={{ color: '#0f6d84' }} />} />
          </BottomNavigation>
        )}
      </Box>
    </Box>
  )
}
