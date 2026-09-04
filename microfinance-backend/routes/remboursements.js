const express = require("express");
const router = express.Router();

const db = require("../config/database");

// GET : Afficher tous les remboursements


router.get("/", (req, res) => {

    const sql = `
        SELECT 
            remboursement.*,
            credit.montant AS montant_credit,
            client.nom,
            utilisateur.nom AS nom_utilisateur
        FROM remboursement
        JOIN credit 
            ON remboursement.id_credit = credit.id_credit
        JOIN client
            ON credit.id_client = client.id_client
        LEFT JOIN utilisateur
            ON remboursement.id_utilisateur = utilisateur.id_utilisateur
        ORDER BY remboursement.date_remboursement DESC
    `;

    db.query(sql, (err, result) => {

        if (err) {
            console.error("Erreur récupération remboursements :", err);

            return res.status(500).json({
                message: "Erreur lors de la récupération des remboursements",
                erreur: err.message
            });
        }

        console.log("REMBOURSEMENTS ENVOYÉS À REACT :", result);

        res.json(result);
    });
});



// POST : Ajouter un remboursement


router.post("/", (req, res) => {

    const {
        montant,
        id_credit,
        id_utilisateur
    } = req.body;

    console.log("NOUVEAU REMBOURSEMENT");
    console.log("Données reçues :", req.body);


    // Vérifier le montant

    if (!montant || Number(montant) <= 0) {

        return res.status(400).json({
            message: "Le montant du remboursement doit être supérieur à 0"
        });

    }


    // Vérifier le crédit

    if (!id_credit) {

        return res.status(400).json({
            message: "Le crédit est obligatoire"
        });

    }


    // Vérifier l'utilisateur

    if (!id_utilisateur) {

        return res.status(400).json({
            message: "L'utilisateur est obligatoire"
        });

    }


    // Récupérer le crédit

    db.query(
        "SELECT * FROM credit WHERE id_credit = ?",
        [id_credit],
        (err, credits) => {

            if (err) {

                console.error(
                    "Erreur récupération crédit :",
                    err
                );

                return res.status(500).json({
                    message: "Erreur lors de la récupération du crédit",
                    erreur: err.message
                });

            }


            if (credits.length === 0) {

                return res.status(404).json({
                    message: "Crédit introuvable"
                });

            }


            const credit = credits[0];

            const montantTotal =
                Number(credit.montant_rembourse);


            // Calculer ce qui a déjà été payé

            db.query(
                `
                SELECT COALESCE(SUM(montant), 0) AS total_paye
                FROM remboursement
                WHERE id_credit = ?
                `,
                [id_credit],
                (err, result) => {

                    if (err) {

                        console.error(
                            "Erreur calcul remboursements :",
                            err
                        );

                        return res.status(500).json({
                            message: "Erreur lors du calcul des remboursements",
                            erreur: err.message
                        });

                    }


                    const dejaPaye =
                        Number(result[0].total_paye);

                    const resteAvantPaiement = montantTotal - dejaPaye;
                    const mensualite = Math.min(
                        montantTotal / Number(credit.duree),
                        resteAvantPaiement
                    );

                    if (Math.abs(Number(montant) - mensualite) > 0.01) {
                        return res.status(400).json({
                            message: `La mensualité attendue est de ${mensualite.toFixed(2)} CDF`
                        });
                    }


                    const nouveauTotal =
                        dejaPaye + Number(montant);


                    // Empêcher de rembourser plus que le crédit

                    if (nouveauTotal > montantTotal) {

                        const reste =
                            montantTotal - dejaPaye;

                        return res.status(400).json({
                            message:
                                `Le remboursement dépasse le montant restant. Il reste ${reste} CDF à payer.`
                        });

                    }


                    // Déterminer le statut

                    const statut =
                        nouveauTotal >= montantTotal
                            ? "Remboursé"
                            : "En cours";


                    // Enregistrer le remboursement

                    const sql = `
                        INSERT INTO remboursement
                        (
                            montant,
                            id_credit,
                            id_utilisateur
                        )
                        VALUES (?, ?, ?)
                    `;


                    db.query(
                        sql,
                        [
                            Number(montant),
                            Number(id_credit),
                            Number(id_utilisateur)
                        ],
                        (err, result) => {

                            if (err) {

                                console.error(
                                    "Erreur insertion remboursement :",
                                    err
                                );

                                return res.status(500).json({
                                    message:
                                        "Erreur lors de l'enregistrement du remboursement",
                                    erreur: err.message
                                });

                            }


                            // Mettre à jour uniquement le statut
                            // Le montant_rembourse reste le montant TOTAL à payer

                            db.query(
                                `
                                UPDATE credit
                                SET statut = ?
                                WHERE id_credit = ?
                                `,
                                [
                                    statut,
                                    Number(id_credit)
                                ],
                                (err) => {

                                    if (err) {

                                        console.error(
                                            "Erreur mise à jour crédit :",
                                            err
                                        );

                                        return res.status(500).json({
                                            message:
                                                "Remboursement enregistré mais erreur de mise à jour du crédit",
                                            erreur: err.message
                                        });

                                    }


                                    console.log(
                                        "Remboursement enregistré. ID :",
                                        result.insertId
                                    );


                                    res.status(201).json({

                                        message:
                                            "Remboursement enregistré avec succès",

                                        id_remboursement:
                                            result.insertId,

                                        total_paye:
                                            nouveauTotal,

                                        reste:
                                            montantTotal - nouveauTotal,

                                        statut

                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );

});


module.exports = router;