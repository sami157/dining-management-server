const admin = require("firebase-admin");
const serviceAccount = require("../key.json");
const { usersCollection } = require("../config/connectMongodb")
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const verifyFirebaseToken = () => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.split(" ")[1];

            if (!idToken) {
                res.json({message: 'Access token is required'})
                return
            }

            const decoded = await admin.auth().verifyIdToken(idToken);
            const email = decoded.email;
            const user = await usersCollection.findOne({ email });
            req.user = user;
            next();
        } catch (err) {
            res.status(403).json({ message: "Unauthorized" });
        }
    };
};

module.exports = verifyFirebaseToken;