const express = require("express");
const router = express.Router();

const db = require("../config/database");


// GET : Afficher tous les crédits

router.get("/", (req, res) => {

    const sql = `
    SELECT
        credit.*,
        client.nom,

        COALESCE(
            SUM(remboursement.montant),
            0
        ) AS montant_rembourse_paye

    FROM credit

    JOIN client
        ON credit.id_client = client.id_client

    LEFT JOIN remboursement
        ON credit.id_credit = remboursement.id_credit

    GROUP BY credit.id_credit

    ORDER BY credit.date_octroi DESC
`;

    db.query(sql, (err, result) => {

        if (err) {
            console.error("Erreur récupération crédits :", err);

            return res.status(500).json({
                message: "Erreur lors de la récupération des crédits",
                erreur: err.message
            });
        }

        console.log("CREDITS ENVOYÉS À REACT :", result);

        res.json(result);
    });
});


// POST : Ajouter un crédit
router.post("/", (req, res) => {

    const {
        montant,
        taux,
        duree,
        id_client
    } = req.body;

    console.log("NOUVEAU CREDIT");
    console.log("Données reçues :", req.body);


    // Vérification du montant
    if (!montant || Number(montant) <= 0) {

        return res.status(400).json({
            message: "Le montant du crédit doit être supérieur à 0"
        });

    }


    // Vérification du taux
    if (taux === undefined || Number(taux) < 0) {

        return res.status(400).json({
            message: "Le taux d'intérêt est invalide"
        });

    }


    // Vérification de la durée
    if (!duree || Number(duree) <= 0) {

        return res.status(400).json({
            message: "La durée doit être supérieure à 0"
        });

    }


    // Vérification du client
    if (!id_client) {

        return res.status(400).json({
            message: "Le client est obligatoire"
        });

    }


    // Vérifier que le client existe
    db.query(
        "SELECT * FROM client WHERE id_client = ?",
        [id_client],
        (err, clients) => {

            if (err) {

                console.error(
                    "Erreur vérification client :",
                    err
                );

                return res.status(500).json({
                    message: "Erreur lors de la vérification du client",
                    erreur: err.message
                });

            }


            if (clients.length === 0) {

                return res.status(404).json({
                    message: "Client introuvable"
                });

            }


            // Calcul du montant total à rembourser
            const montant_rembourse =
                Number(montant) +
                (Number(montant) * Number(taux) / 100);


            // Enregistrer le crédit
            const sql = `
                INSERT INTO credit
                (
                    montant,
                    taux,
                    duree,
                    montant_rembourse,
                    statut,
                    id_client
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `;


            db.query(
                sql,
                [
                    Number(montant),
                    Number(taux),
                    Number(duree),
                    montant_rembourse,
                    "En cours",
                    Number(id_client)
                ],
                (err, result) => {

                    if (err) {

                        console.error(
                            "ERREUR INSERT CREDIT :",
                            err
                        );

                        return res.status(500).json({
                            message: "Erreur lors de l'enregistrement du crédit",
                            erreur: err.message
                        });

                    }


                    console.log(
                        "Crédit enregistré. ID :",
                        result.insertId
                    );


                    res.status(201).json({

                        message: "Crédit accordé avec succès",

                        id_credit: result.insertId

                    });

                }
            );

        }
    );

});


module.exports = router;