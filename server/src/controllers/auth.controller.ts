import crypto from 'crypto'
import type { Request, Response } from 'express'
import { User } from '../models/User.js'
import { Customer } from '../models/Customer.js'
import type { Role } from '../constants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { compareToken, hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js'
import { clearAuthCookies, setAuthCookies } from '../utils/cookies.js'
import { writeAudit } from '../services/audit.js'
import { deliverEmail } from '../services/email.js'
import { sendLoginMail } from '../services/credentials.js'
import { clientOrigins } from '../config/env.js'
import { blankToUndefined } from '../utils/helpers.js'

async function issueSession(user: { _id: { toString(): string }; role: Role; name: string; email: string; refreshTokenHash?: string }) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
  })
  const refreshToken = signRefreshToken(user._id.toString())
  user.refreshTokenHash = await hashToken(refreshToken)
  return { accessToken, refreshToken }
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const email = req.body.email.toLowerCase()
  const phone = req.body.phone.trim()
  if (await User.findOne({ email })) throw new ApiError(409, 'An account with this email already exists')
  let customer = await Customer.findOne({ phone })
  if (customer) {
    const linked = await User.findOne({ customer: customer._id })
    if (linked) throw new ApiError(409, 'This phone number already has a customer portal login')
    if (!customer.email) customer.email = email
    customer.name = req.body.name
    await customer.save()
  } else {
    customer = await Customer.create({
      name: req.body.name,
      email,
      phone,
      vehicleCount: 0,
      isActive: true,
    })
  }
  const user = await User.create({
    name: req.body.name,
    email,
    phone,
    password: req.body.password,
    role: 'CUSTOMER',
    customer: customer._id,
    isActive: true,
  })
  void sendLoginMail({
    to: user.email,
    name: user.name,
    password: String(req.body.password),
    account: 'Customer portal',
    relatedId: user._id.toString(),
  })
  await writeAudit(req, 'CREATE', 'User', `Customer portal account for ${user.email}`, user._id.toString())
  sendSuccess(res, { id: user._id, email: user.email, role: user.role }, 'Customer account created. Sign in to book a service.', 201)
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password +refreshTokenHash')
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw new ApiError(401, 'Email or password is incorrect')
  }
  if (!user.isActive) throw new ApiError(403, 'This account is waiting for approval or has been disabled')
  const session = await issueSession(user)
  user.lastLoginAt = new Date()
  await user.save()
  setAuthCookies(res, session.accessToken, session.refreshToken)
  await writeAudit(req, 'LOGIN', 'User', `${user.name} signed in`, user._id.toString())
  sendSuccess(res, { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, avatarUrl: user.avatarUrl }, 'Signed in')
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, { $unset: { refreshTokenHash: 1 } })
    await writeAudit(req, 'LOGOUT', 'User', `${req.user.name} signed out`, req.user.id)
  }
  clearAuthCookies(res)
  sendSuccess(res, null, 'Signed out')
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.gms_refresh as string | undefined
  if (!token) throw new ApiError(401, 'Refresh session is missing')
  let payload: { sub: string }
  try {
    payload = verifyRefreshToken(token)
  } catch {
    clearAuthCookies(res)
    throw new ApiError(401, 'Refresh session is invalid')
  }
  const user = await User.findById(payload.sub).select('+refreshTokenHash')
  if (!user || !user.isActive || !user.refreshTokenHash) {
    clearAuthCookies(res)
    throw new ApiError(401, 'Refresh session is invalid')
  }
  const matches = await compareToken(token, user.refreshTokenHash)
  if (!matches) {
    user.refreshTokenHash = undefined
    await user.save()
    clearAuthCookies(res)
    throw new ApiError(401, 'Refresh session is invalid')
  }
  const session = await issueSession(user)
  await user.save()
  setAuthCookies(res, session.accessToken, session.refreshToken)
  sendSuccess(res, { id: user._id, role: user.role }, 'Session refreshed')
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id)
  if (!user) throw new ApiError(401, 'Account not found')
  sendSuccess(res, user)
})

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id)
  if (!user) throw new ApiError(404, 'Account not found')
  user.name = req.body.name
  user.phone = blankToUndefined(req.body.phone)
  await user.save()
  if (user.role === 'CUSTOMER' && user.customer) {
    await Customer.findByIdAndUpdate(user.customer, { name: user.name, phone: user.phone })
  }
  if (user.role === 'MECHANIC') {
    const { Mechanic } = await import('../models/Mechanic.js')
    const { ServiceRequest } = await import('../models/ServiceRequest.js')
    const mechanic = await Mechanic.findOneAndUpdate({ user: user._id }, { name: user.name, phone: user.phone }, { new: true })
    if (mechanic) await ServiceRequest.updateMany({ assignedMechanic: mechanic._id }, { mechanicName: user.name })
  }
  await writeAudit(req, 'UPDATE', 'User', `${user.name} updated their profile`, user._id.toString())
  sendSuccess(res, user, 'Profile updated')
})

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('+password +refreshTokenHash')
  if (!user) throw new ApiError(404, 'Account not found')
  const matches = await user.comparePassword(req.body.currentPassword)
  if (!matches) throw new ApiError(400, 'Current password is incorrect', [{ field: 'currentPassword', message: 'Current password is incorrect' }])
  user.password = req.body.newPassword
  user.refreshTokenHash = undefined
  await user.save()
  clearAuthCookies(res)
  await writeAudit(req, 'PASSWORD_RESET', 'User', `${user.name} changed their password`, user._id.toString())
  sendSuccess(res, null, 'Password updated. Please sign in again.')
})

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, 'Choose a JPEG, PNG, or WebP image under 2 MB')
  const user = await User.findByIdAndUpdate(req.user!.id, { avatarUrl: `/uploads/avatars/${req.file.filename}` }, { new: true })
  sendSuccess(res, user, 'Profile photo updated')
})

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const generic = 'If an account exists for that email, a reset link has been sent.'
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+resetPasswordToken')
  if (!user || !user.isActive) {
    sendSuccess(res, null, generic)
    return
  }
  const token = crypto.randomBytes(32).toString('hex')
  user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000)
  await user.save()
  const link = `${clientOrigins[0]}/reset-password?token=${token}`
  const result = await deliverEmail({
    to: user.email,
    subject: 'Reset your Apex Motors password',
    title: 'Password reset',
    intro: `Hello ${user.name}, use the button below to choose a new password. The link expires in one hour.`,
    cta: { href: link, label: 'Reset password' },
    template: 'password-reset',
    force: true,
    relatedModel: 'User',
    relatedId: user._id.toString(),
  })
  if (process.env.NODE_ENV === 'development' && !result.sent) {
    console.info(`[password-reset] ${link}`)
  }
  await writeAudit(req, 'PASSWORD_RESET', 'User', `Password reset requested for ${user.email}`, user._id.toString())
  sendSuccess(res, null, generic)
})

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const hashed = crypto.createHash('sha256').update(req.body.token).digest('hex')
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires')
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired')
  user.password = req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined
  user.refreshTokenHash = undefined
  await user.save()
  await writeAudit(req, 'PASSWORD_RESET', 'User', `Password reset completed for ${user.email}`, user._id.toString())
  sendSuccess(res, null, 'Password has been reset. You can sign in with the new password.')
})
