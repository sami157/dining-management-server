"use strict";
const admin = require("firebase-admin");
const encodedServiceKey = process.env.FB_SERVICE_KEY;
if (!encodedServiceKey) {
    throw new Error('FB_SERVICE_KEY is required');
}
const decodedServiceKey = Buffer.from(encodedServiceKey, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decodedServiceKey);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
module.exports = admin;
