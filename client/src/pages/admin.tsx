import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Alert, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api, errorMessage } from '@/api/client'
import { DataTable, PageHeader, filterRowSx, useServerList } from '@/components/ui'
import { Field } from '@/components/fields'
import type { RootState } from '@/store'
import { setUser } from '@/store/authSlice'
import { setUnread } from '@/store/uiSlice'
import type { AppNotification, AuditEntry, EmailEntry, User, WorkshopSettings } from '@/types'
import { formatDateTime, fromNow } from '@/utils/format'

const password = z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)

export function NotificationsPage() {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const list = useServerList<AppNotification>('/notifications', ['notification:created'])
  const dispatch = useDispatch()
  return (
    <div>
      <PageHeader title="Notifications" subtitle="New jobs, assignments, status changes, low stock, invoices, and payments." crumbs={[{ label: 'Notifications' }]} action={<Button onClick={async () => { await api.patch('/notifications/read-all'); dispatch(setUnread(0)); enqueueSnackbar('All caught up', { variant: 'success' }); list.reload() }}>Mark all read</Button>} />
      <TextField size="small" select label="Show" value={list.params.get('unread') || 'all'} onChange={(event) => list.update({ unread: event.target.value === 'true' ? 'true' : undefined })} sx={{ mb: 2, minWidth: 160 }}>
        <MenuItem value="all">All</MenuItem>
        <MenuItem value="true">Unread</MenuItem>
      </TextField>
      <DataTable
        columns={[
          { id: 'title', header: 'Notice', mobile: 'title', render: (row) => row.title },
          { id: 'message', header: 'Detail', mobile: 'meta', render: (row) => row.message },
          { id: 'when', header: 'When', mobile: 'chip', render: (row) => fromNow(row.createdAt) },
          { id: 'read', header: 'State', mobile: 'chip', render: (row) => (row.read ? 'Read' : 'Unread') },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        onPage={(page) => list.update({ page }, false)}
        onRow={async (row) => {
          if (!row.read) await api.patch(`/notifications/${row._id}/read`)
          if (row.link) navigate(row.link)
        }}
        emptyTitle="No notifications"
        emptyBody="You will see assignments and job updates here."
        hasFilters={list.params.get('unread') === 'true'}
      />
    </div>
  )
}

export function UsersPage() {
  const { enqueueSnackbar } = useSnackbar()
  const list = useServerList<User>('/users', [])
  const [open, setOpen] = useState(false)
  const form = useForm({
    resolver: zodResolver(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      password,
      role: z.enum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC']),
      specialization: z.string().optional(),
    })),
    defaultValues: { name: '', email: '', phone: '', password: '', role: 'RECEPTIONIST' as 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'MECHANIC', specialization: 'General Service' },
  })
  return (
    <div>
      <PageHeader title="Users" subtitle="Staff accounts and the role that controls what they can change." crumbs={[{ label: 'Users' }]} action={<Button variant="contained" onClick={() => setOpen(true)}>Add user</Button>} />
      <DataTable
        columns={[
          { id: 'name', header: 'Name', sortKey: 'name', mobile: 'title', render: (row) => row.name },
          { id: 'email', header: 'Email', mobile: 'meta', render: (row) => row.email },
          { id: 'role', header: 'Role', sortKey: 'role', mobile: 'chip', render: (row) => row.role },
          { id: 'active', header: 'Status', mobile: 'chip', render: (row) => (row.isActive ? 'Active' : 'Disabled') },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        onPage={(page) => list.update({ page }, false)}
        onSort={(sort) => list.update({ sort })}
        sort={list.params.get('sort') || undefined}
        onRow={async (row) => {
          const next = !row.isActive
          const confirmed = window.confirm(next ? `Enable ${row.name}?` : `Disable ${row.name}? They will be signed out.`)
          if (!confirmed) return
          try {
            await api.put(`/users/${row._id}`, { isActive: next })
            enqueueSnackbar(next ? 'User enabled' : 'User disabled', { variant: 'success' })
            list.reload()
          } catch (error) {
            enqueueSnackbar(errorMessage(error), { variant: 'error' })
          }
        }}
        emptyTitle="No users"
        emptyBody="Create the first staff account."
      />
      <Dialog open={open} onClose={() => { setOpen(false); form.reset() }} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle>New staff account</DialogTitle>
        <DialogContent>
          <Stack component="form" id="new-user-form" spacing={2} sx={{ mt: 1 }} onSubmit={form.handleSubmit(async (values) => {
            try {
              const response = await api.post('/users', { ...values, isActive: true })
              const message = response.data.message || 'User created'
              enqueueSnackbar(message, { variant: message.includes('not sent') ? 'warning' : 'success' })
              setOpen(false)
              form.reset()
              list.reload()
            } catch (error) {
              enqueueSnackbar(errorMessage(error), { variant: 'error' })
            }
          })}>
            <Field name="name" control={form.control} label="Name" />
            <Field name="email" control={form.control} label="Email" />
            <Field name="phone" control={form.control} label="Phone" />
            <Field name="password" control={form.control} label="Temporary password" type="password" />
            <TextField select label="Role" value={form.watch('role')} onChange={(event) => form.setValue('role', event.target.value as 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'MECHANIC')}>
              {['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'].map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
            </TextField>
            {form.watch('role') === 'MECHANIC' && <Field name="specialization" control={form.control} label="Specialisation" />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setOpen(false); form.reset() }}>Cancel</Button>
          <Button type="submit" form="new-user-form" variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export function AuditPage() {
  const list = useServerList<AuditEntry>('/audit-logs', [])
  const [search, setSearch] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((list.params.get('search') || '') !== search) list.update({ search })
    }, 300)
    return () => clearTimeout(handle)
  }, [search])
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Sign-ins, record changes, payments, and emails." crumbs={[{ label: 'Audit log' }]} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={filterRowSx}>
        <TextField size="small" label="Search summary" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" label="Action" value={list.params.get('action') || ''} onChange={(event) => list.update({ action: event.target.value })} />
        <TextField size="small" label="Entity" value={list.params.get('entity') || ''} onChange={(event) => list.update({ entity: event.target.value })} />
      </Stack>
      <DataTable
        columns={[
          { id: 'when', header: 'When', mobile: 'chip', render: (row) => formatDateTime(row.createdAt) },
          { id: 'who', header: 'Who', mobile: 'meta', render: (row) => `${row.userName || 'System'} (${row.role || '—'})` },
          { id: 'action', header: 'Action', mobile: 'chip', render: (row) => row.action },
          { id: 'summary', header: 'Summary', mobile: 'title', render: (row) => row.summary },
        ]}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        meta={list.meta}
        onPage={(page) => list.update({ page }, false)}
        emptyTitle="No audit events"
        emptyBody="Sensitive actions will be listed here."
        hasFilters={Boolean(search || list.params.get('action') || list.params.get('entity'))}
      />
    </div>
  )
}

export function SettingsPage() {
  const { enqueueSnackbar } = useSnackbar()
  const [tab, setTab] = useState(0)
  const [settings, setSettings] = useState<WorkshopSettings | null>(null)
  const [testTo, setTestTo] = useState('')
  const emails = useServerList<EmailEntry>('/email-logs', [])
  useEffect(() => {
    void api.get('/settings').then((response) => setSettings(response.data.data))
  }, [])
  if (!settings) return <Typography color="text.secondary">Loading settings…</Typography>
  const save = async () => {
    try {
      const response = await api.put('/settings', {
        garageName: settings.garageName,
        tagline: settings.tagline,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        gstin: settings.gstin,
        taxPercent: settings.taxPercent,
        emailNotifications: settings.emailNotifications,
      })
      setSettings({ ...response.data.data, smtp: settings.smtp })
      enqueueSnackbar('Settings saved', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' })
    }
  }
  return (
    <div>
      <PageHeader title="Settings" subtitle="Workshop profile, notification switches, and email delivery." crumbs={[{ label: 'Settings' }]} />
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Workshop" />
        <Tab label="Email" />
      </Tabs>
      {tab === 0 && (
        <Card sx={{ p: 2, maxWidth: 720 }}>
          <Stack spacing={2}>
            <TextField label="Garage name" value={settings.garageName} onChange={(event) => setSettings({ ...settings, garageName: event.target.value })} />
            <TextField label="Tagline" value={settings.tagline || ''} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} />
            <TextField label="Address" value={settings.address || ''} onChange={(event) => setSettings({ ...settings, address: event.target.value })} />
            <TextField label="City" value={settings.city || ''} onChange={(event) => setSettings({ ...settings, city: event.target.value })} />
            <TextField label="Phone" value={settings.phone || ''} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} />
            <TextField label="Email" value={settings.email || ''} onChange={(event) => setSettings({ ...settings, email: event.target.value })} />
            <TextField label="GSTIN" value={settings.gstin || ''} onChange={(event) => setSettings({ ...settings, gstin: event.target.value })} />
            <TextField label="GST %" type="number" value={settings.taxPercent} onChange={(event) => setSettings({ ...settings, taxPercent: Number(event.target.value) })} />
            {Object.entries(settings.emailNotifications).map(([key, value]) => (
              <FormControlLabel key={key} control={<Checkbox checked={value} onChange={(event) => setSettings({ ...settings, emailNotifications: { ...settings.emailNotifications, [key]: event.target.checked } })} />} label={`Send ${key} emails`} />
            ))}
            <Button variant="contained" onClick={() => void save()}>Save workshop settings</Button>
          </Stack>
        </Card>
      )}
      {tab === 1 && (
        <Stack spacing={2}>
          <Alert severity={settings.smtp?.configured ? 'success' : 'warning'}>
            {settings.smtp?.configured
              ? `SMTP is configured for ${settings.smtp.fromName} <${settings.smtp.fromEmail}>. Credentials stay in the server environment.`
              : `SMTP is not ready. Set ${settings.smtp?.missing.join(', ') || 'the SMTP variables'} in the server environment. Passwords are never shown here.`}
          </Alert>
          <Card sx={{ p: 2 }}>
            <Typography fontWeight={700}>SMTP</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              These values come from the server environment. The password is never sent to the browser.
            </Typography>
            <Stack spacing={1.5}>
              <TextField label="SMTP Host" value={settings.smtp?.host || ''} disabled />
              <TextField label="SMTP Port" value={settings.smtp?.port ?? ''} disabled />
              <TextField label="SMTP Secure" value={settings.smtp?.secure ? 'Yes' : 'No'} disabled />
              <TextField label="SMTP Username" value={settings.smtp?.userConfigured ? 'Configured on the server' : 'Not set'} disabled />
              <TextField label="SMTP Password" type="password" value="" placeholder="Hidden" disabled helperText="Stored only in the server environment." />
              <TextField label="From Name" value={settings.smtp?.fromName || ''} disabled />
              <TextField label="From Email" value={settings.smtp?.fromEmail || ''} disabled />
            </Stack>
          </Card>
          <Card sx={{ p: 2 }}>
            <Typography fontWeight={700}>Send test email</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
              <TextField label="Recipient" value={testTo} onChange={(event) => setTestTo(event.target.value)} fullWidth />
              <Button variant="contained" onClick={async () => {
                try {
                  const response = await api.post('/settings/email/test', { to: testTo })
                  enqueueSnackbar(response.data.message, { variant: 'success' })
                  emails.reload()
                } catch (error) {
                  enqueueSnackbar(errorMessage(error), { variant: 'error' })
                }
              }}>Send test email</Button>
            </Stack>
          </Card>
          <DataTable
            columns={[
              { id: 'to', header: 'To', mobile: 'title', render: (row) => row.to },
              { id: 'subject', header: 'Subject', mobile: 'meta', render: (row) => row.subject },
              { id: 'template', header: 'Template', mobile: 'meta', render: (row) => row.template },
              { id: 'status', header: 'Status', mobile: 'chip', render: (row) => row.status },
              { id: 'when', header: 'When', mobile: 'hide', render: (row) => formatDateTime(row.createdAt) },
            ]}
            rows={emails.rows}
            loading={emails.loading}
            error={emails.error}
            onRetry={emails.reload}
            meta={emails.meta}
            onPage={(page) => emails.update({ page }, false)}
            emptyTitle="No email activity"
            emptyBody="Test messages and customer emails are recorded here. The message shows a clear SMTP error when delivery fails."
          />
        </Stack>
      )}
    </div>
  )
}

const profileSchema = z.object({
  name: z.string().min(2, 'Enter your name'),
  phone: z.string().min(8, 'Enter a phone number'),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
})

export function ProfilePage() {
  const user = useSelector((state: RootState) => state.auth.user)
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name || '', phone: user?.phone || '', currentPassword: '', newPassword: '' } })
  return (
    <div>
      <PageHeader title="Profile" subtitle={user?.email} crumbs={[{ label: 'Profile' }]} />
      <Card sx={{ p: 2, maxWidth: 560 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Role: {user?.role}</Typography>
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
          <Button variant="outlined" component="label">
            Upload photo
            <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const body = new FormData()
              body.append('avatar', file)
              try {
                const response = await api.post('/auth/avatar', body)
                dispatch(setUser(response.data.data))
                enqueueSnackbar('Photo updated', { variant: 'success' })
              } catch (error) {
                enqueueSnackbar(errorMessage(error), { variant: 'error' })
              }
            }} />
          </Button>
          <Typography fontWeight={700}>Change password</Typography>
          <Field name="currentPassword" control={form.control} label="Current password" type="password" />
          <Field name="newPassword" control={form.control} label="New password" type="password" />
          <Button type="submit" variant="contained">Save profile</Button>
        </Stack>
      </Card>
    </div>
  )
}
