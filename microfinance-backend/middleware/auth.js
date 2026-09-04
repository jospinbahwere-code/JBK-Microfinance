const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "JBK_MICROFINANCE_SECRET_2026";

function verifierToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Accès refusé : token manquant."
        });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Token invalide."
        });
    }

    const token = parts[1];

    try {

        const decoded = jwt.verify(token, SECRET);

        req.utilisateur = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Token invalide ou expiré."
        });

    }
}

module.exports = verifierToken;