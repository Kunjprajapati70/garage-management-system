import path from 'path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import swaggerUi from 'swagger-ui-express'
import { clientOrigins, env } from './config/env.js'
import { api } from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { openApiSpec } from './docs/openapi.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )
  app.use(cors({ origin: clientOrigins, credentials: true }))
  app.use(compression())
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
  }
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use(mongoSanitize())

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { success: false, message: 'Too many requests. Try again in a few minutes.', errors: [] },
  })
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { success: false, message: 'Too many sign-in attempts. Try again later.', errors: [] },
  })

  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)
  app.use('/api/auth/forgot-password', authLimiter)
  app.use('/api', limiter)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Apex Motors API' }))
  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec))
  app.use('/api', api)
  app.use(notFound)
  app.use(errorHandler)
  return app
}
