import axios, { type AxiosError } from 'axios'
import { store } from '@/store'
import { setServerDown, setUser } from '@/store/authSlice'
import { beginRequest, endRequest } from '@/store/uiSlice'
import { apiBase } from '@/api/origin'

interface ErrorBody {
  message?: string
  errors?: { field?: string; message: string }[]
}

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
})

let refreshPromise: Promise<void> | null = null

api.interceptors.request.use((config) => {
  store.dispatch(beginRequest())
  return config
})

api.interceptors.response.use(
  (response) => {
    store.dispatch(endRequest())
    if (store.getState().auth.serverDown) store.dispatch(setServerDown(false))
    return response
  },
  async (error: AxiosError<ErrorBody>) => {
    store.dispatch(endRequest())
    if (error.code === 'ERR_NETWORK' || !error.response) {
      store.dispatch(setServerDown(true))
      return Promise.reject(error)
    }
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined
    const url = original?.url || ''
    const skipRefresh = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/forgot-password', '/auth/reset-password'].some((path) => url.includes(path))
    if (error.response.status === 401 && original && !original._retry && !skipRefresh) {
      original._retry = true
      try {
        refreshPromise ||= axios
          .post(`${apiBase}/auth/refresh`, {}, { withCredentials: true })
          .then(() => undefined)
          .finally(() => {
            refreshPromise = null
          })
        await refreshPromise
        return api(original)
      } catch {
        store.dispatch(setUser(null))
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)

export function errorMessage(error: unknown) {
  if (axios.isAxiosError<ErrorBody>(error)) {
    if (error.code === 'ERR_NETWORK' || !error.response) return 'Server unavailable. Check that the API is running.'
    return error.response.data?.message || 'Request failed'
  }
  return 'Something went wrong'
}

export function fieldErrors(error: unknown) {
  if (axios.isAxiosError<ErrorBody>(error)) return error.response?.data?.errors || []
  return []
}
