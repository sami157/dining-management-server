const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { BSON } = require('mongodb');
const dotenv = require('dotenv');
const { connectMongoDB } = require('../config/connectMongodb');

dns.setServers(['8.8.8.8']);
dotenv.config({ path: '.env.local' });

const timestamp = () => {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
};

const writeBsonDump = async (collection, filePath) => {
  const stream = fs.createWriteStream(filePath);
  let count = 0;

  try {
    const cursor = collection.find({});
    for await (const doc of cursor) {
      stream.write(BSON.serialize(doc));
      count += 1;
    }
  } finally {
    await new Promise((resolve, reject) => {
      stream.end(error => (error ? reject(error) : resolve()));
    });
  }

  return count;
};

const main = async () => {
  const db = await connectMongoDB();
  const backupRoot = path.join(process.cwd(), 'backups', 'mongo', timestamp(), db.databaseName);
  fs.mkdirSync(backupRoot, { recursive: true });

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const summary = [];

  for (const { name } of collections) {
    const collection = db.collection(name);
    const bsonPath = path.join(backupRoot, `${name}.bson`);
    const metadataPath = path.join(backupRoot, `${name}.metadata.json`);

    const [indexes, count] = await Promise.all([
      collection.indexes(),
      writeBsonDump(collection, bsonPath),
    ]);

    fs.writeFileSync(
      metadataPath,
      JSON.stringify({ indexes, collectionName: name, type: 'collection' })
    );

    summary.push({ collection: name, count });
  }

  fs.writeFileSync(
    path.join(backupRoot, 'prelude.json'),
    JSON.stringify({ databaseName: db.databaseName, backedUpAt: new Date().toISOString() }, null, 2)
  );

  console.log(JSON.stringify({ backupRoot, collections: summary }, null, 2));
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
