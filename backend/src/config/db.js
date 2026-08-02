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
            await mongoose.connect(config.MONGODB_URI);
            console.log('MongoDB successfully connected.');
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
