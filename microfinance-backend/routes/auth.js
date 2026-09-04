const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const jwt = require("jsonwebtoken");

const db = require("../config/database");

// Connexion utilisateur
router.post("/login", (req, res) => {

    const { email, mot_de_passe } = req.body;

    if (!email || !mot_de_passe) {
        return res.status(400).json({
            message: "Email et mot de passe obligatoires"
        });
    }

    const sql = `
        SELECT
            id_utilisateur,
            nom,
            email,
            mot_de_passe,
            role,
            actif
        FROM utilisateur
        WHERE email = ?
    `;

    db.query(sql, [email], async (err, result) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                message: "Erreur serveur"
            });
        }

        if (result.length === 0) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect"
            });
        }

        const utilisateur = result[0];

        // Vérifier si le compte est actif
        if (utilisateur.actif !== 1) {
            return res.status(403).json({
                message: "Ce compte utilisateur est désactivé"
            });
        }

        // Vérifier le mot de passe
        const motDePasseCorrect = await bcrypt.compare(
            mot_de_passe,
            utilisateur.mot_de_passe
        );

        if (!motDePasseCorrect) {
            return res.status(401).json({
                message: "Email ou mot de passe incorrect"
            });
        }

        // Ne jamais renvoyer le mot de passe au frontend
        delete utilisateur.mot_de_passe;

        // Création du token de connexion
        const token = jwt.sign(
            {
                id: utilisateur.id_utilisateur,
                role: utilisateur.role,
                email: utilisateur.email
            },
            process.env.JWT_SECRET || "JBK_MICROFINANCE_SECRET_2026",
            {
                expiresIn: "8h"
            }
        );

        res.json({
            message: "Connexion réussie",
            token,
            utilisateur
        });

    });

});

module.exports = router;