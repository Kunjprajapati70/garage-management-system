import path from 'path'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
import { z } from 'zod'

const envFile = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'server', '.env')].find((file) => existsSync(file))
if (envFile) dotenv.config({ path: envFile })
else dotenv.config()

if (process.env.NODE_ENV === 'test') {
  process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-value'
  process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-value'
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/garage_ms_test'
  process.env.CLIENT_URL ||= 'http://localhost:5173'
}

process.env.JWT_ACCESS_SECRET ||= process.env.JWT_SECRET
process.env.JWT_REFRESH_SECRET ||= process.env.JWT_SECRET
process.env.JWT_ACCESS_EXPIRES ||= process.env.JWT_EXPIRES_IN

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM_NAME: z.string().optional().default('Apex Motors'),
  SMTP_FROM_EMAIL: z.string().optional().default(''),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = parsed.data

export const clientOrigins = env.CLIENT_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const cookieSecure = env.CLIENT_URL.startsWith('https://')
