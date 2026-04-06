// @ts-nocheck
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

const uri = process.env.MONGODB_URI;

let client;
let dbInstance;

const connectMongoDB = async () => {
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

const getMongoClient = async () => {
    await connectMongoDB();
    return client;
};

const withMongoTransaction = async (work) => {
    const mongoClient = await getMongoClient();
    const session = mongoClient.startSession();

    try {
        return await session.withTransaction(async () => work(session));
    } finally {
        await session.endSession();
    }
};

const getCollections = async () => {
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

module.exports = { connectMongoDB, getCollections, getMongoClient, withMongoTransaction };

