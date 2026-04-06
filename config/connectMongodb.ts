import dotenv = require('dotenv');
import { Db, MongoClient, ServerApiVersion, type ClientSession, type Collection } from 'mongodb';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error('MONGODB_URI is required');
}

type Collections = {
    users: Collection;
    mealSchedules: Collection;
    mealDeadlines: Collection;
    mealRegistrations: Collection;
    payments: Collection;
    deposits: Collection;
    expenses: Collection;
    memberBalances: Collection;
    monthlyFinalization: Collection;
    systemLogs: Collection;
};

let client: MongoClient | undefined;
let dbInstance: Db | undefined;

const connectMongoDB = async (): Promise<Db> => {
    if (dbInstance) return dbInstance; // reuse if already connected

    client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    dbInstance = client.db('diningManagementDB');
    return dbInstance;
};

const getMongoClient = async (): Promise<MongoClient> => {
    await connectMongoDB();
    if (!client) {
        throw new Error('Mongo client was not initialized');
    }
    return client;
};

const withMongoTransaction = async <T>(work: (session: ClientSession) => Promise<T>): Promise<T> => {
    const mongoClient = await getMongoClient();
    const session = mongoClient.startSession();

    try {
        return await session.withTransaction(async () => work(session));
    } finally {
        await session.endSession();
    }
};

const getCollections = async (): Promise<Collections> => {
    const db = await connectMongoDB();
    return {
        users: db.collection('users'),
        mealSchedules: db.collection('mealSchedules'),
        mealDeadlines: db.collection('mealDeadlines'),
        mealRegistrations: db.collection('mealRegistrations'),
        payments: db.collection('payments'),
        deposits: db.collection('deposits'),
        expenses: db.collection('expenses'),
        memberBalances: db.collection('memberBalances'),
        monthlyFinalization: db.collection('monthlyFinalization'),
        systemLogs: db.collection('systemLogs'),
    };
};

export = { connectMongoDB, getCollections, getMongoClient, withMongoTransaction };

