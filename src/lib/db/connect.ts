import mongoose from 'mongoose';

// MongoDB 연결 상태
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
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}; 