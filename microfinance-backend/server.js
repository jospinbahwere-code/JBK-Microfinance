const express = require("express");
const cors = require("cors");
require("./config/database.js");
const db = require("./config/database.js");

const clientsRoutes = require("./routes/clients");
const compteRoutes = require("./routes/comptes");
const transactionRoutes = require("./routes/transactions");
const utilisateurRoutes = require("./routes/utilisateur");
const creditRoutes = require("./routes/credit");
const remboursementRoutes = require("./routes/remboursements");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const setupRoutes = require("./routes/setup");

const app = express();

// Remove overdrafts from existing accounts and create an account for legacy clients.
db.query(`
    UPDATE compte
    SET decouvert_autorise = 0,
        solde_minimum = CASE WHEN type_compte = 'Epargne' THEN 10000 ELSE 0 END
`, (err) => {
    if (err) console.error("Erreur de normalisation des comptes :", err.message);
});

db.query(`
    INSERT INTO compte (numero_compte, type_compte, solde, solde_minimum, decouvert_autorise, id_client)
    SELECT CONCAT('CP', UNIX_TIMESTAMP(NOW(3)) * 1000, c.id_client), 'Courant', 0, 0, 0, c.id_client
    FROM client c
    LEFT JOIN compte co ON co.id_client = c.id_client
    WHERE co.id_client IS NULL
`, (err) => {
    if (err) console.error("Erreur de création des comptes manquants :", err.message);
});

// The unique index is the database-level guarantee that one client owns one account.
db.query(`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'compte'
      AND INDEX_NAME = 'uq_compte_id_client'
`, (err, result) => {
    if (err || result[0].total > 0) return;

    db.query(
        "ALTER TABLE compte ADD UNIQUE INDEX uq_compte_id_client (id_client)",
        (indexError) => {
            if (indexError) {
                console.error("Impossible d'appliquer l'unicité client-compte :", indexError.message);
            }
        }
    );
});

// Garantir l'unicité des informations de base des clients pour éviter les doublons.
db.query(`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client'
      AND INDEX_NAME = 'uq_client_telephone'
`, (err, result) => {
    if (!err && result[0].total === 0) {
        db.query("ALTER TABLE client ADD UNIQUE INDEX uq_client_telephone (telephone)", (indexError) => {
            if (indexError) {
                console.error("Impossible d'appliquer l'unicité téléphone client :", indexError.message);
            }
        });
    }
});

db.query(`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client'
      AND INDEX_NAME = 'uq_client_email'
`, (err, result) => {
    if (!err && result[0].total === 0) {
        db.query("ALTER TABLE client ADD UNIQUE INDEX uq_client_email (email)", (indexError) => {
            if (indexError) {
                console.error("Impossible d'appliquer l'unicité email client :", indexError.message);
            }
        });
    }
});

db.query(`
    SELECT COUNT(*) AS total
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'client'
      AND INDEX_NAME = 'uq_client_identity'
`, (err, result) => {
    if (!err && result[0].total === 0) {
        db.query("ALTER TABLE client ADD UNIQUE INDEX uq_client_identity (nom, telephone, email)", (indexError) => {
            if (indexError) {
                console.error("Impossible d'appliquer l'unicité identité client :", indexError.message);
            }
        });
    }
});

app.use(cors());
app.use(express.json());
app.use("/transactions", transactionRoutes);
app.use("/comptes", compteRoutes);
app.use("/clients", clientsRoutes);
app.use("/utilisateurs", utilisateurRoutes);
app.use("/credits", creditRoutes);
app.use("/remboursements", remboursementRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/setup", setupRoutes);
app.get("/", (req, res) => {
    res.send("API Microfinance fonctionne !");
});

app.listen(5000, () => {
    console.log("Serveur lancé sur le port 5000");
});
