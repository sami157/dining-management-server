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

const db = client.db('diningManagementDB');
const mealScheduleCollection = db.collection('mealSchedules')

const connectMongoDB = () => {
    async function run() {
        try {
            await client.connect();
        } finally {
        }
    }
    run().catch(console.dir);
}

module.exports = {
    connectMongoDB,
    mealScheduleCollection
}