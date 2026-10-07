import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  ready: boolean
  serverDown: boolean
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, ready: false, serverDown: false } as AuthState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload
      state.ready = true
      if (action.payload) state.serverDown = false
    },
    setReady(state) {
      state.ready = true
    },
    setServerDown(state, action: PayloadAction<boolean>) {
      state.serverDown = action.payload
    },
  },
})

export const { setUser, setReady, setServerDown } = authSlice.actions
export default authSlice.reducer
