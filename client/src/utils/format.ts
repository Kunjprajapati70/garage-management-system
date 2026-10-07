import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function inr(value?: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  return dayjs(value).format('DD MMM YYYY')
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—'
  return dayjs(value).format('DD MMM YYYY, HH:mm')
}

export function fromNow(value?: string | Date | null) {
  if (!value) return ''
  return dayjs(value).fromNow()
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  diagnosing: 'Diagnosing',
  waiting_for_parts: 'Waiting for Parts',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
  issued: 'Issued',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  available: 'Available',
  busy: 'Busy',
  off_duty: 'Off duty',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export function labelOf(value?: string) {
  if (!value) return '—'
  return STATUS_LABEL[value] || value
}

export const TRANSITIONS: Record<string, string[]> = {
  pending: ['diagnosing', 'cancelled'],
  diagnosing: ['waiting_for_parts', 'in_progress', 'cancelled'],
  waiting_for_parts: ['diagnosing', 'in_progress', 'cancelled'],
  in_progress: ['waiting_for_parts', 'completed', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['pending'],
}
