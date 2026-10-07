import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type Mode = 'light' | 'dark'
export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'retrying'

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('gms-theme') : null
const initialMode: Mode = stored === 'dark' || stored === 'light' ? stored : 'light'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    mode: initialMode,
    drawerOpen: false,
    collapsed: false,
    pendingRequests: 0,
    connection: 'disconnected' as ConnectionState,
    unread: 0,
  },
  reducers: {
    toggleMode(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light'
      localStorage.setItem('gms-theme', state.mode)
    },
    setDrawer(state, action: PayloadAction<boolean>) {
      state.drawerOpen = action.payload
    },
    toggleCollapsed(state) {
      state.collapsed = !state.collapsed
    },
    beginRequest(state) {
      state.pendingRequests += 1
    },
    endRequest(state) {
      state.pendingRequests = Math.max(0, state.pendingRequests - 1)
    },
    setConnection(state, action: PayloadAction<ConnectionState>) {
      state.connection = action.payload
    },
    setUnread(state, action: PayloadAction<number>) {
      state.unread = action.payload
    },
  },
})

export const { toggleMode, setDrawer, toggleCollapsed, beginRequest, endRequest, setConnection, setUnread } = uiSlice.actions
export default uiSlice.reducer
