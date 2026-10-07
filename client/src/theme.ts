import { createTheme } from '@mui/material/styles'

export function buildTheme(mode: 'light' | 'dark') {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#7ec4d6' : '#0f6d84', contrastText: dark ? '#062027' : '#ffffff' },
      secondary: { main: dark ? '#9fd0de' : '#14627a' },
      background: {
        default: dark ? '#0d1c22' : '#e7eef2',
        paper: dark ? '#143038' : '#ffffff',
      },
      text: {
        primary: dark ? '#e7f3f6' : '#12232c',
        secondary: dark ? '#b7cdd4' : '#5c727c',
      },
      divider: dark ? '#24525c' : '#d9e4ea',
      success: { main: dark ? '#8ed4aa' : '#1b7a4a' },
      warning: { main: dark ? '#f0b45a' : '#b86e09' },
      error: { main: dark ? '#f0a097' : '#b43328' },
      info: { main: dark ? '#8ec4e6' : '#1a6f96' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 750, letterSpacing: -0.5 },
      h5: { fontWeight: 750, letterSpacing: -0.3 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 700 },
      button: { fontWeight: 650, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { overflowX: 'hidden' },
          body: { overflowX: 'hidden' },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 42,
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 650,
            transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
            '&:hover': { transform: 'translateY(-1px)' },
            '&:focus-visible': { outline: `2px solid ${dark ? '#7ec4d6' : '#0f6d84'}`, outlineOffset: 2 },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              '&:hover': { transform: 'none' },
            },
          },
          sizeSmall: { minHeight: 36 },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'background-color 180ms ease',
            '&:focus-visible': { outline: `2px solid ${dark ? '#7ec4d6' : '#0f6d84'}`, outlineOffset: 2 },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: dark ? '#24525c' : '#e4edf1',
            borderRadius: 16,
            boxShadow: dark ? '0 10px 28px rgba(0,0,0,0.22)' : '0 10px 28px rgba(12, 55, 70, 0.05)',
            transition: 'box-shadow 200ms ease',
            '&:hover': {
              boxShadow: dark ? '0 14px 32px rgba(0,0,0,0.3)' : '0 14px 32px rgba(12, 55, 70, 0.08)',
            },
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiDialog: {
        defaultProps: { transitionDuration: { enter: 220, exit: 160 } },
        styleOverrides: {
          paper: {
            borderRadius: 16,
            '@media (max-width:600px)': { margin: 12, maxHeight: 'calc(100% - 24px)', width: 'calc(100% - 24px)' },
          },
        },
      },
      MuiDrawer: {
        defaultProps: { transitionDuration: { enter: 240, exit: 180 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            minHeight: 46,
            transition: 'background-color 180ms ease, transform 180ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            whiteSpace: 'nowrap',
            backgroundColor: dark ? '#10262c' : '#f3f7f9',
            color: dark ? '#e7f3f6' : '#12232c',
          },
          root: { borderColor: dark ? '#24525c' : '#e4edf1', verticalAlign: 'middle' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 150ms ease',
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 12, alignItems: 'center' } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 650 } },
      },
      MuiTextField: {
        defaultProps: {
          slotProps: { inputLabel: { shrink: true } },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            position: 'relative',
            transform: 'none',
            maxWidth: '100%',
            marginBottom: 6,
            fontWeight: 700,
            fontSize: '0.8125rem',
            lineHeight: 1.3,
            color: dark ? '#b7cdd4' : '#3d5660',
            '&.MuiInputLabel-shrink': { transform: 'none' },
            '&.Mui-focused': { color: dark ? '#7ec4d6' : '#0f6d84' },
          },
          outlined: {
            transform: 'none',
            '&.MuiInputLabel-shrink': { transform: 'none' },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? '#10262c' : '#ffffff',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          },
          notchedOutline: {
            '& legend': { width: '0.01px' },
          },
        },
      },
    },
  })
}
