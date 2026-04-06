import admin = require('firebase-admin');
import type { ServiceAccount } from 'firebase-admin';

const encodedServiceKey = process.env.FB_SERVICE_KEY;

if (!encodedServiceKey) {
  throw new Error('FB_SERVICE_KEY is required');
}

const decodedServiceKey = Buffer.from(encodedServiceKey, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedServiceKey) as ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export = admin;

