const express = require("express");
const router = express.Router();
const db = require("../config/database");

router.get("/", (req, res) => {
    db.query(`SELECT compte.*, client.nom FROM compte JOIN client ON compte.id_client = client.id_client`, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

router.post("/", (req, res) => {
    const { id_client, type_compte, depot_initial } = req.body;
    const depotInitial = Number(depot_initial);
    if (!id_client || !["Courant", "Epargne"].includes(type_compte)) {
        return res.status(400).json({ message: "Le client et le type de compte sont obligatoires" });
    }
    if (!Number.isFinite(depotInitial) || depotInitial < 0) {
        return res.status(400).json({ message: "Le dépôt initial est invalide" });
    }
    if (type_compte === "Epargne" && depotInitial < 10000) {
        return res.status(400).json({ message: "Le dépôt initial est obligatoire pour un compte épargne" });
    }

    db.query("SELECT id_client FROM client WHERE id_client = ?", [id_client], (clientError, clients) => {
        if (clientError) return res.status(500).json(clientError);
        if (clients.length === 0) return res.status(404).json({ message: "Client introuvable" });

        db.query(
            "SELECT id_compte FROM compte WHERE id_client = ? LIMIT 1",
            [id_client],
            (accountError, accounts) => {
                if (accountError) return res.status(500).json(accountError);
                if (accounts.length > 0) {
                    return res.status(409).json({ message: "Ce client possède déjà un compte" });
                }

                const numeroCompte = `CP${Date.now()}${id_client}`;
                const soldeMinimum = type_compte === "Epargne" ? 10000 : 0;
                db.query(
                    `INSERT INTO compte
                    (numero_compte, type_compte, solde, solde_minimum, decouvert_autorise, id_client)
                    VALUES (?, ?, ?, ?, 0, ?)`,
                    [numeroCompte, type_compte, depotInitial, soldeMinimum, id_client],
                    (err, result) => {
                        if (err) return res.status(500).json(err);
                        res.status(201).json({ message: "Compte ouvert avec succès", id_compte: result.insertId });
                    }
                );
            }
        );
    });
});

module.exports = router;
