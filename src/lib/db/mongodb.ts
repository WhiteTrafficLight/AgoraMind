import { MongoClient } from 'mongodb';

// Lazy-initialized MongoClient connection. Reads MONGODB_URI on first
// call rather than at module load, so build-phase page-data collection
// can evaluate this module without tripping on a missing env var when
// no route actually calls getMongoClient().

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient> | null = null;

function buildClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }
  const client = new MongoClient(uri, {});
  return client.connect();
}

export function getMongoClient(): Promise<MongoClient> {
  // In dev, cache on the global so HMR doesn't open new connections.
  if (process.env.NODE_ENV === 'development') {
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = buildClientPromise();
    }
    return globalWithMongo._mongoClientPromise;
  }
  if (!clientPromise) {
    clientPromise = buildClientPromise();
  }
  return clientPromise;
}

export default getMongoClient;
