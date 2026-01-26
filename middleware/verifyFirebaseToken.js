const admin = require("firebase-admin");
const { users } = require("../config/connectMongodb")

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

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
            const user = await users.findOne({ email });
            req.user = user;
            next();
        } catch (err) {
            res.status(403).json({ message: "Unauthorized" });
        }
    };
};

module.exports = verifyFirebaseToken;