import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo: MongoMemoryServer

export async function startMemoryDb() {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
}

export async function stopMemoryDb() {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
}

export async function clearCollections() {
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
}
