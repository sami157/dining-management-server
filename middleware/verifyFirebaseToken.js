const admin = require("../config/firebaseAdmin");
const { getCollections } = require("../config/connectMongodb");

const verifyFirebaseToken = (allowedRoles = []) => {
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

            if (!Array.isArray(allowedRoles)) {
                res.status(500).json({ message: "Invalid auth middleware configuration" });
                return;
            }

            if (allowedRoles.length > 0 && !user) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }

            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            req.firebaseUser = decoded;
            req.user = user || null;
            next();
        } catch (err) {
            res.status(403).json({ message: "Unauthorized" });
        }
    };
};

module.exports = verifyFirebaseToken;
