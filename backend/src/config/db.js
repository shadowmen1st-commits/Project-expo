import mongoose from 'mongoose';
import config from './env.js';

let mongoServer;

export const connectDB = async () => {
    try {
        mongoose.set('strictQuery', true);

        if (process.env.NODE_ENV === 'test') {
            const { MongoMemoryReplSet } = await import('mongodb-memory-server');
            mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
            const uri = mongoServer.getUri();
            await mongoose.connect(uri);
            // Financial tests must not race first transactions against background index creation.
            await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
            console.log('MongoDB Memory ReplSet successfully connected for testing.');
        } else {
            try {
                const dbName = process.env.DB_NAME || 'test';
                await mongoose.connect(config.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
                const host = mongoose.connection.host || 'MongoDB Atlas';
                console.log(`✅ MongoDB Connected to database: ${mongoose.connection.name} (host: ${host}, NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
            } catch (err) {
                console.warn('⚠️ Primary MongoDB connection failed:', err.message);
                try {
                    await mongoose.connect('mongodb://127.0.0.1:27017/test', { dbName: 'test', serverSelectionTimeoutMS: 3000 });
                    console.log(`MongoDB connected to local fallback database (test).`);
                } catch {
                    console.log('Starting MongoMemoryReplSet as fallback for database resilience...');
                    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
                    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
                    const uri = mongoServer.getUri();
                    await mongoose.connect(uri, { dbName: 'test' });
                    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
                    console.log('MongoDB Memory ReplSet fallback successfully connected.');
                }
            }
        }
    }
    catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

export const disconnectDB = async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
};
