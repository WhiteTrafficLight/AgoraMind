import mongoose from 'mongoose';

// Global variable to maintain connection across hot reloads
const globalWithMongoose = global as typeof global & {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (globalWithMongoose.mongoose.conn) {
    return globalWithMongoose.mongoose.conn;
  }

  // Read env at call time, not at module load. This keeps build-phase
  // page-data collection from tripping on missing env vars when no
  // route actually connects (e.g., the Playwright smoke job).
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }
  if (!dbName) {
    throw new Error('Please define the MONGODB_DB environment variable inside .env.local');
  }

  if (!globalWithMongoose.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      dbName,
    };
    globalWithMongoose.mongoose.promise = mongoose.connect(uri, opts).then((m) => m);
  }

  globalWithMongoose.mongoose.conn = await globalWithMongoose.mongoose.promise;
  return globalWithMongoose.mongoose.conn;
}

export default connectDB;
