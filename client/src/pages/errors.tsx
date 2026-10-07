import { Box, Button, Card, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Logo } from '@/components/ui'

function ErrorScreen({ code, title, body, action }: { code: string; title: string; body: string; action: string }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <Card sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
        <Stack spacing={1.5} alignItems="center">
          <Logo />
          <Typography variant="h3" color="primary" sx={{ fontWeight: 800, letterSpacing: -1 }}>{code}</Typography>
          <Typography variant="h5">{title}</Typography>
          <Typography color="text.secondary">{body}</Typography>
          <Button variant="contained" onClick={() => navigate(code === '401' ? '/login' : '/dashboard')}>{action}</Button>
        </Stack>
      </Card>
    </Box>
  )
}

export function ForbiddenPage() {
  return <ErrorScreen code="403" title="You do not have access to this area" body="Your role can use the modules shown in the navigation. Ask an administrator if your duties have changed." action="Back to dashboard" />
}

export function NotFoundPage() {
  return <ErrorScreen code="404" title="That page is not on the workshop desk" body="The address may be mistyped, or the record may have been removed." action="Back to dashboard" />
}

export function ServerErrorPage() {
  return <ErrorScreen code="500" title="The workshop system hit an unexpected error" body="Refresh the page. If it continues, the API logs will have the detail." action="Back to dashboard" />
}

export function UnauthorizedPage() {
  return <ErrorScreen code="401" title="Your session has ended" body="Sign in again to continue work on the floor or the desk." action="Sign in" />
}
