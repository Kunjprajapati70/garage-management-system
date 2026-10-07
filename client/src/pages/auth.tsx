import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Alert, Box, Button, Card, Link, Stack, Typography } from '@mui/material'
import { useDispatch } from 'react-redux'
import { api, errorMessage } from '@/api/client'
import { setUser } from '@/store/authSlice'
import { Field } from '@/components/fields'
import { Logo } from '@/components/ui'

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const [brand, setBrand] = useState('Apex Motors')
  useEffect(() => {
    void api.get('/settings/public').then((response) => {
      if (response.data.data?.garageName) setBrand(response.data.data.garageName)
    }).catch(() => undefined)
  }, [])
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' }, bgcolor: 'background.default' }}>
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 6, color: '#fff', background: 'linear-gradient(160deg, #0e4d6c 0%, #083448 55%, #1d3557 100%)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Logo />
          <Typography variant="h6">{brand}</Typography>
        </Stack>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 750, maxWidth: 460 }}>
            The workshop desk for jobs, parts, and payments.
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 460, opacity: 0.85 }}>
            Reception, the floor, and the office stay on the same service request from the first call to the invoice.
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Service bays · Inventory · Billing
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, sm: 4 } }}>
        <Card sx={{ width: '100%', maxWidth: 440, p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={0.5} sx={{ mb: 2, display: { md: 'none' } }} direction="row" alignItems="center">
            <Logo />
            <Typography fontWeight={800}>{brand}</Typography>
          </Stack>
          <Typography variant="h5">{title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5, mt: 0.5 }}>
            {subtitle}
          </Typography>
          {children}
        </Card>
      </Box>
    </Box>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const justRegistered = Boolean((location.state as { registered?: boolean } | null)?.registered)
  const [formError, setFormError] = useState('')
  const form = useForm({
    resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required') })),
    defaultValues: { email: '', password: '' },
  })
  const fillDemo = (email: string, password: string) => {
    form.setValue('email', email, { shouldDirty: true, shouldValidate: true })
    form.setValue('password', password, { shouldDirty: true, shouldValidate: true })
  }
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      const response = await api.post('/auth/login', values)
      dispatch(setUser(response.data.data))
      navigate(response.data.data.role === 'CUSTOMER' ? '/portal' : '/dashboard')
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })
  return (
    <AuthShell title="Sign in" subtitle="Staff use a workshop account. Customers use the portal account they created.">
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {justRegistered && <Alert severity="success">Your customer account is ready. Sign in to book a service.</Alert>}
        {formError && <Alert severity="error">{formError}</Alert>}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Demo accounts fill the email and password. Sign in when you are ready.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button type="button" size="small" variant="outlined" onClick={() => fillDemo('admin@apexmotors.local', 'ChangeMe_Admin_123')}>Admin</Button>
            <Button type="button" size="small" variant="outlined" onClick={() => fillDemo('manager@apexmotors.local', 'ChangeMe_User_123')}>Manager</Button>
            <Button type="button" size="small" variant="outlined" onClick={() => fillDemo('receptionist@apexmotors.local', 'ChangeMe_User_123')}>Reception</Button>
            <Button type="button" size="small" variant="outlined" onClick={() => fillDemo('mechanic@apexmotors.local', 'ChangeMe_User_123')}>Mechanic</Button>
            <Button type="button" size="small" variant="outlined" onClick={() => fillDemo('portal.guest@apexmotors.local', 'Portal@123')}>Customer</Button>
          </Stack>
        </Box>
        <Field name="email" control={form.control} label="Email" type="email" autoComplete="username" />
        <Field name="password" control={form.control} label="Password" type="password" autoComplete="current-password" />
        <Button type="submit" variant="contained" size="large" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <Stack direction="row" justifyContent="space-between">
          <Link component={RouterLink} to="/forgot-password">Forgot password</Link>
          <Link component={RouterLink} to="/register">Customer sign up</Link>
        </Stack>
      </Stack>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const form = useForm({
    resolver: zodResolver(
      z.object({
        name: z.string().min(2, 'Enter your name'),
        email: z.string().email('Enter a valid email'),
        phone: z.string().min(8, 'Enter a phone number'),
        password,
      }),
    ),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      await api.post('/auth/register', values)
      navigate('/login', { state: { registered: true } })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })
  return (
    <AuthShell title="Create your account" subtitle="Sign up to book a service appointment and follow your vehicle. Staff accounts are issued by the workshop.">
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {formError && <Alert severity="error">{formError}</Alert>}
        <Field name="name" control={form.control} label="Full name" />
        <Field name="email" control={form.control} label="Email" type="email" />
        <Field name="phone" control={form.control} label="Phone" />
        <Field name="password" control={form.control} label="Password" type="password" />
        <Button type="submit" variant="contained" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
        <Link component={RouterLink} to="/login">Back to sign in</Link>
      </Stack>
    </AuthShell>
  )
}

export function ForgotPage() {
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const form = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })), defaultValues: { email: '' } })
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      const response = await api.post('/auth/forgot-password', values)
      setMessage(response.data.message)
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })
  return (
    <AuthShell title="Reset password" subtitle="We will email a reset link if the account is active.">
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {message && <Alert severity="success">{message}</Alert>}
        {formError && <Alert severity="error">{formError}</Alert>}
        <Field name="email" control={form.control} label="Email" type="email" />
        <Button type="submit" variant="contained" disabled={form.formState.isSubmitting || Boolean(message)}>
          Send reset link
        </Button>
        <Link component={RouterLink} to="/login">Back to sign in</Link>
      </Stack>
    </AuthShell>
  )
}

export function ResetPage() {
  const navigate = useNavigate()
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [formError, setFormError] = useState(token ? '' : 'This reset link is missing a token.')
  const form = useForm({ resolver: zodResolver(z.object({ password })), defaultValues: { password: '' } })
  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      await api.post('/auth/reset-password', { token, password: values.password })
      navigate('/login', { state: { reset: true } })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  })
  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters with upper, lower, and a number.">
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        {formError && <Alert severity="error">{formError}</Alert>}
        <Field name="password" control={form.control} label="New password" type="password" />
        <Button type="submit" variant="contained" disabled={!token || form.formState.isSubmitting}>
          Update password
        </Button>
      </Stack>
    </AuthShell>
  )
}
