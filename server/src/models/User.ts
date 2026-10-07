import bcrypt from 'bcryptjs'
import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { ROLES, type Role } from '../constants.js'

export interface UserAttrs {
  name: string
  email: string
  password: string
  phone?: string
  role: Role
  customer?: Types.ObjectId
  isActive: boolean
  avatarUrl?: string
  refreshTokenHash?: string
  resetPasswordToken?: string
  resetPasswordExpires?: Date
  lastLoginAt?: Date
}

export interface UserDoc extends UserAttrs {
  _id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true, index: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    isActive: { type: Boolean, default: true, index: true },
    avatarUrl: { type: String },
    refreshTokenHash: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.password)
}

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    const record = ret as unknown as Record<string, unknown>
    delete record.password
    delete record.refreshTokenHash
    delete record.resetPasswordToken
    delete record.resetPasswordExpires
    return record
  },
})

export const User = model<UserDoc>('User', userSchema)
export type UserHydrated = HydratedDocument<UserDoc>
