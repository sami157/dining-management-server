const admin = require("firebase-admin");
const { getCollections } = require("../config/connectMongodb");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const verifyFirebaseToken = (isProteted = false) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.split(" ")[1];

            if (!idToken) {
                res.status(403).json({ message: "User not found" });
                return;
            }

            const decoded = await admin.auth().verifyIdToken(idToken);
            const { users } = await getCollections();
            const user = await users.findOne({ email: decoded.email });

            if (isProteted && (user.role!=='admin' && user.role !== 'super_admin')){
                res.status(403).json({ message: "Only Admins can access this content" });
                return;
            }

            req.user = user;
            next();
        } catch (err) {
            res.status(403).json({ message: "Unauthorized" });
        }
    };
};

module.exports = verifyFirebaseToken;