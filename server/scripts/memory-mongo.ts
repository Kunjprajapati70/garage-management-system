import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create({ instance: { port: 27017, dbName: 'garage_ms' } })
console.log(`READY ${mongo.getUri()}`)
setInterval(() => undefined, 1 << 30)
