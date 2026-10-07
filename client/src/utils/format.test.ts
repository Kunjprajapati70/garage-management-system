import { inr, labelOf } from '@/utils/format'

describe('workshop formatting', () => {
  it('formats rupees for the Indian locale', () => {
    expect(inr(12500)).toContain('12,500')
  })

  it('labels service statuses for people, not raw codes', () => {
    expect(labelOf('waiting_for_parts')).toBe('Waiting for Parts')
    expect(labelOf('in_progress')).toBe('In Progress')
  })
})
