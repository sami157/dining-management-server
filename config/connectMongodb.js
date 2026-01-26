const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();
const uri = `${process.env.MONGODB_URI}`
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const connectMongoDB = () => {
    async function run() {
        try {
            await client.connect();
        } finally {
        }
    }
    run().catch(console.dir);
}

const db = client.db('diningManagementDB');
const users = db.collection('users')
const mealSchedules = db.collection('mealSchedules')
const mealRegistrations = db.collection('mealRegistrations');
const payments = db.collection('payments');
const deposits = db.collection('deposits');
const expenses = db.collection('expenses');
const memberBalances = db.collection('memberBalances');
const monthlyFinalization = db.collection('monthlyFinalization');


module.exports = {
    connectMongoDB,
    users,
    mealSchedules,
    mealRegistrations,
    payments,
    deposits,
    expenses,
    memberBalances,
    monthlyFinalization
}