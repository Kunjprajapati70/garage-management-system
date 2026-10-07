import crypto from 'crypto'
import { clientOrigins } from '../config/env.js'
import { deliverEmail } from './email.js'

export function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(12)
  let body = ''
  for (let index = 0; index < 10; index += 1) body += alphabet[bytes[index] % alphabet.length]
  return `A${body}9`
}

export function sendLoginMail(input: { to: string; name: string; password: string; account: string; relatedId: string }) {
  return deliverEmail({
    to: input.to,
    subject: 'Your Apex Motors login',
    title: 'Your login is ready',
    intro: `Hello ${input.name}, sign in with the user ID and password below.`,
    rows: [
      { label: 'User ID', value: input.to },
      { label: 'Password', value: input.password },
      { label: 'Account', value: input.account },
    ],
    cta: { href: `${clientOrigins[0]}/login`, label: 'Sign in' },
    template: 'login-credentials',
    force: true,
    relatedModel: 'User',
    relatedId: input.relatedId,
  })
}
