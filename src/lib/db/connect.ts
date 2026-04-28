import mongoose from 'mongoose';
import { loggers } from '@/utils/logger';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return;
  }
  
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as mongoose.ConnectOptions;
    
    await mongoose.connect(MONGODB_URI, options);
    
    isConnected = true;
    loggers.db.info('MongoDB connected successfully');
  } catch (error) {
    loggers.db.error('Error connecting to MongoDB:', error);
    throw error;
  }
}; 