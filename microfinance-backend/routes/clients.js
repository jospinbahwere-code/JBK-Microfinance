const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", (req, res) => {
    db.query("SELECT * FROM client", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// A client and their first account are created in the same MySQL transaction.
router.post("/", (req, res) => {
    const { nom, telephone, email, adresse } = req.body;
    const typeCompte = req.body.type_compte || "Courant";
    const depotInitial = Number(req.body.depot_initial || 0);

    if (!nom || !telephone || !adresse || !["Courant", "Epargne"].includes(typeCompte)) {
        return res.status(400).json({ message: "Les informations du client et le type de compte sont obligatoires" });
    }
    if (!Number.isFinite(depotInitial) || depotInitial < 0) {
        return res.status(400).json({ message: "Le dépôt initial est invalide" });
    }
    if (typeCompte === "Epargne" && depotInitial < 10000) {
        return res.status(400).json({ message: "Le dépôt initial minimum d'un compte épargne est de 10 000 CDF" });
    }

    const nomNettoye = String(nom).trim();
    const telephoneNettoye = String(telephone).trim();
    const emailNettoye = email ? String(email).trim() : null;

    const duplicateCheckSql = `
        SELECT id_client, nom, telephone, email
        FROM client
        WHERE telephone = ?
           OR LOWER(TRIM(email)) = LOWER(TRIM(?))
           OR LOWER(TRIM(nom)) = LOWER(TRIM(?))
        LIMIT 10
    `;

    db.query(duplicateCheckSql, [telephoneNettoye, emailNettoye || "", nomNettoye], (duplicateError, existingClients) => {
        if (duplicateError) {
            return res.status(500).json({ message: "Erreur lors de la vérification des informations client" });
        }

        if (existingClients.length > 0) {
            const duplicateDetails = existingClients.find((client) => {
                const samePhone = client.telephone && String(client.telephone).trim() === telephoneNettoye;
                const sameEmail = client.email && String(client.email).trim().toLowerCase() === (emailNettoye || "").toLowerCase();
                const sameName = client.nom && String(client.nom).trim().toLowerCase() === nomNettoye.toLowerCase();
                return samePhone || sameEmail || sameName;
            });

            if (duplicateDetails) {
                return res.status(409).json({
                    message: "Ces informations existent déjà pour un client."
                });
            }
        }

        const soldeMinimum = typeCompte === "Epargne" ? 10000 : 0;
        db.beginTransaction((transactionError) => {
            if (transactionError) return res.status(500).json({ message: "Impossible de créer le client" });
            const rollback = (message, status = 500) => db.rollback(() => res.status(status).json({ message }));

            db.query(
                "INSERT INTO client (nom, telephone, email, adresse) VALUES (?, ?, ?, ?)",
                [nomNettoye, telephoneNettoye, emailNettoye || null, adresse],
                (clientError, clientResult) => {
                    if (clientError) return rollback("Erreur lors de l'enregistrement du client");

                    const idClient = clientResult.insertId;
                    const numeroCompte = `CP${Date.now()}${idClient}`;
                    db.query(
                        `INSERT INTO compte
                        (numero_compte, type_compte, solde, solde_minimum, decouvert_autorise, id_client)
                        VALUES (?, ?, ?, ?, 0, ?)`,
                        [numeroCompte, typeCompte, depotInitial, soldeMinimum, idClient],
                        (compteError, compteResult) => {
                            if (compteError) return rollback("Erreur lors de l'ouverture du compte");
                            db.commit((commitError) => {
                                if (commitError) return rollback("Erreur lors de la validation du client");
                                res.status(201).json({
                                    message: "Client et compte enregistrés avec succès",
                                    id_client: idClient,
                                    id_compte: compteResult.insertId
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

module.exports = router;
