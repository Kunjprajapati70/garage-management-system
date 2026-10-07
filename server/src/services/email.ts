import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { EmailLog, Setting } from '../models/Setting.js'
import { escapeHtml } from '../utils/helpers.js'

export interface SmtpPublicStatus {
  configured: boolean
  host: string
  port: number
  secure: boolean
  fromName: string
  fromEmail: string
  userConfigured: boolean
  missing: string[]
}

export function getSmtpStatus(): SmtpPublicStatus {
  const missing: string[] = []
  if (!env.SMTP_HOST) missing.push('SMTP_HOST')
  if (!env.SMTP_FROM_EMAIL) missing.push('SMTP_FROM_EMAIL')
  return {
    configured: missing.length === 0,
    host: env.SMTP_HOST ? env.SMTP_HOST.replace(/^(.).*(.)$/, '$1***$2') : '',
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL,
    userConfigured: Boolean(env.SMTP_USER),
    missing,
  }
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  })
}

export function renderEmail(title: string, intro: string, rows: { label: string; value: string }[] = [], cta?: { href: string; label: string }) {
  const details = rows
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;color:#5c6b76;width:180px">${escapeHtml(row.label)}</td><td style="padding:8px 0;color:#12202b;font-weight:600">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('')
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.href)}" style="background:#0e4d6c;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf0">
      <tr><td style="background:#0e4d6c;color:#fff;padding:20px 28px">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">Apex Motors</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(title)}</div>
      </td></tr>
      <tr><td style="padding:28px;color:#24343f;font-size:15px;line-height:1.6">
        <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
        ${details ? `<table width="100%" cellpadding="0" cellspacing="0">${details}</table>` : ''}
        ${button}
        <p style="margin:24px 0 0;color:#6b7c88;font-size:13px">This message was sent by the Apex Motors workshop system. Please do not reply if your mailbox is unattended.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
  const text = [title, '', intro, ...rows.map((row) => `${row.label}: ${row.value}`), cta ? `${cta.label}: ${cta.href}` : '']
    .filter(Boolean)
    .join('\n')
  return { html, text }
}

async function notificationsEnabled(flag: keyof {
  welcome: boolean
  serviceRequest: boolean
  assignment: boolean
  status: boolean
  completed: boolean
  invoice: boolean
}) {
  const settings = await Setting.findOne({ key: 'general' }).lean()
  if (!settings?.emailNotifications) return true
  return settings.emailNotifications[flag] !== false
}

export async function deliverEmail(input: {
  to: string
  subject: string
  title: string
  intro: string
  rows?: { label: string; value: string }[]
  cta?: { href: string; label: string }
  template: string
  flag?: 'welcome' | 'serviceRequest' | 'assignment' | 'status' | 'completed' | 'invoice'
  force?: boolean
  relatedModel?: string
  relatedId?: string
}) {
  const preview = input.intro.slice(0, 500)
  if (!input.to) {
    await EmailLog.create({ to: 'missing', subject: input.subject, template: input.template, status: 'skipped', error: 'No recipient', preview, relatedModel: input.relatedModel, relatedId: input.relatedId })
    return { sent: false, message: 'Recipient email is missing' }
  }
  if (input.flag && !input.force && !(await notificationsEnabled(input.flag))) {
    await EmailLog.create({ to: input.to, subject: input.subject, template: input.template, status: 'skipped', error: 'Disabled in settings', preview, relatedModel: input.relatedModel, relatedId: input.relatedId })
    return { sent: false, message: 'Email notification is disabled' }
  }
  const status = getSmtpStatus()
  if (!status.configured) {
    await EmailLog.create({ to: input.to, subject: input.subject, template: input.template, status: 'skipped', error: `SMTP is not configured (${status.missing.join(', ')})`, preview, relatedModel: input.relatedModel, relatedId: input.relatedId })
    if (env.NODE_ENV === 'development') {
      console.info(`[email skipped] ${input.template} -> ${input.to}: ${input.subject}`)
    }
    return { sent: false, message: `SMTP is not configured. Set ${status.missing.join(', ')} and try again.` }
  }
  const rendered = renderEmail(input.title, input.intro, input.rows, input.cta)
  try {
    const transport = createTransport()
    await transport.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: input.to,
      subject: input.subject,
      html: rendered.html,
      text: rendered.text,
    })
    await EmailLog.create({ to: input.to, subject: input.subject, template: input.template, status: 'sent', preview, relatedModel: input.relatedModel, relatedId: input.relatedId })
    return { sent: true, message: 'Email sent' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send email'
    await EmailLog.create({ to: input.to, subject: input.subject, template: input.template, status: 'failed', error: message, preview, relatedModel: input.relatedModel, relatedId: input.relatedId })
    return { sent: false, message }
  }
}

export async function verifyAndSendTest(to: string) {
  const status = getSmtpStatus()
  if (!status.configured) {
    return { ok: false, message: `SMTP is not configured. Missing ${status.missing.join(', ')}.` }
  }
  try {
    const transport = createTransport()
    await transport.verify()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMTP verification failed'
    return { ok: false, message: `SMTP verification failed: ${message}` }
  }
  const result = await deliverEmail({
    to,
    subject: 'Apex Motors SMTP test',
    title: 'SMTP test successful',
    intro: 'This is a test message from the Apex Motors garage management system. Your SMTP settings can deliver mail.',
    rows: [{ label: 'From', value: env.SMTP_FROM_EMAIL }, { label: 'Host', value: env.SMTP_HOST }],
    template: 'smtp-test',
    force: true,
  })
  return { ok: result.sent, message: result.sent ? `Test email sent to ${to}` : result.message }
}
