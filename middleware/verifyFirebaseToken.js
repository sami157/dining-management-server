const admin = require("../config/firebaseAdmin");
const { getCollections } = require("../config/connectMongodb");

const parseRoles = (roles) => {
    if (!roles) {
        return [];
    }

    if (roles === true) {
        return ["admin", "super_admin"];
    }

    if (Array.isArray(roles)) {
        return roles.map((role) => role.trim()).filter(Boolean);
    }

    return String(roles)
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean);
};

const verifyFirebaseToken = (roles = "") => {
    const allowedRoles = parseRoles(roles);

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
            const user = await users.findOne({ email: decoded.email, isActive: { $ne: false } });

            if (!user) {
                res.status(403).json({ message: "Unauthorized" });
                return;
            }

            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                res.status(403).json({ message: "You are not authorized to access this content" });
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
