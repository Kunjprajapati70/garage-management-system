import { env } from '../config/env.js'
import { deliverEmail, verifyAndSendTest } from './email.js'

interface MailResult {
  sent: boolean
  message: string
}

export function sendEmail(input: Parameters<typeof deliverEmail>[0]): Promise<MailResult> {
  return deliverEmail(input)
}

export function sendWelcomeEmail(to: string, name: string) {
  return deliverEmail({
    to,
    subject: 'Welcome to Apex Motors',
    title: 'Your workshop account is ready',
    intro: `Hello ${name}, an Apex Motors account was created for you. Sign in with this email address and the password shared through a secure channel.`,
    template: 'welcome',
    flag: 'welcome',
  })
}

export function sendServiceCreatedEmail(to: string, requestNumber: string, vehicle: string) {
  return deliverEmail({
    to,
    subject: `Service request ${requestNumber}`,
    title: 'We have opened your service request',
    intro: `Your vehicle is booked in. We will update you as the job moves through the workshop.`,
    rows: [
      { label: 'Request', value: requestNumber },
      { label: 'Vehicle', value: vehicle },
    ],
    template: 'service-created',
    flag: 'serviceRequest',
  })
}

export function sendMechanicAssignmentEmail(to: string, requestNumber: string, mechanic: string) {
  return deliverEmail({
    to,
    subject: `Assigned: ${requestNumber}`,
    title: 'A mechanic is on this job',
    intro: `${mechanic} is assigned to ${requestNumber}.`,
    rows: [
      { label: 'Request', value: requestNumber },
      { label: 'Mechanic', value: mechanic },
    ],
    template: 'assignment',
    flag: 'assignment',
  })
}

export function sendServiceStatusEmail(to: string, requestNumber: string, status: string) {
  return deliverEmail({
    to,
    subject: `${requestNumber} is ${status}`,
    title: 'Service status updated',
    intro: `The workshop moved ${requestNumber} to ${status}.`,
    rows: [
      { label: 'Request', value: requestNumber },
      { label: 'Status', value: status },
    ],
    template: 'status',
    flag: 'status',
  })
}

export function sendInvoiceEmail(to: string, invoiceNumber: string, total: string) {
  return deliverEmail({
    to,
    subject: `Invoice ${invoiceNumber}`,
    title: 'Your invoice is ready',
    intro: `Invoice ${invoiceNumber} has been issued.`,
    rows: [
      { label: 'Invoice', value: invoiceNumber },
      { label: 'Total', value: total },
    ],
    template: 'invoice',
    flag: 'invoice',
  })
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return deliverEmail({
    to,
    subject: 'Reset your Apex Motors password',
    title: 'Password reset',
    intro: 'Use the link below to choose a new password. It expires shortly.',
    cta: { href: resetUrl, label: 'Reset password' },
    template: 'password-reset',
    force: true,
  })
}

export function sendTestEmail(to: string) {
  return verifyAndSendTest(to)
}

export function smtpFromAddress() {
  return { name: env.SMTP_FROM_NAME, email: env.SMTP_FROM_EMAIL }
}
