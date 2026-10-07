import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { ApiError } from '../utils/ApiError.js'

function storageFor(folder: string) {
  const destination = path.join(process.cwd(), 'uploads', folder)
  fs.mkdirSync(destination, { recursive: true })
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`)
    },
  })
}

function imageFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
    cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are allowed'))
    return
  }
  cb(null, true)
}

export const avatarUpload = multer({
  storage: storageFor('avatars'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const logoUpload = multer({
  storage: storageFor('logos'),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
})
