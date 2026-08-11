const express = require("express");
const router = express.Router();

const db = require("../config/database");



// GET : Récupérer toutes les transactions


router.get("/", (req, res) => {

    const sql = `
    SELECT
        t.id_transaction,
        t.type_operation,
        t.montant,
        t.date_operation,
        t.libelle,
        t.compte_source,
        t.compte_destination,
        t.id_utilisateur,
        u.nom AS nom_utilisateur
    FROM transaction t
    LEFT JOIN utilisateur u
        ON t.id_utilisateur = u.id_utilisateur
    ORDER BY t.date_operation DESC
`;

    db.query(sql, (err, result) => {

        if (err) {

            console.error("Erreur récupération transactions :", err);

            return res.status(500).json({
                message: "Erreur lors de la récupération des transactions",
                erreur: err.message
            });
        }

        console.log("TRANSACTIONS ENVOYÉES À REACT :", result);

        res.json(result);
    });
});



// POST : Effectuer une opération


router.post("/", (req, res) => {

    console.log("==================");
    console.log("POST TRANSACTION");
    console.log("Données reçues :", req.body);
    console.log("==================");

    const {
        type_operation,
        montant,
        libelle,
        compte_source,
        compte_destination,
        id_utilisateur
    } = req.body;



    // Vérification du montant


    if (!montant || Number(montant) <= 0) {

        return res.status(400).json({
            message: "Le montant doit être supérieur à 0"
        });
    }

    // Vérification du type

    if (!["Depot", "Retrait", "Virement"].includes(type_operation)) {

        return res.status(400).json({
            message: "Type d'opération invalide"
        });
    }


    const montantNumber = Number(montant);


    // DÉMARRER LA TRANSACTION MYSQL

    db.beginTransaction((err) => {

        if (err) {

            console.error("Erreur START TRANSACTION :", err);

            return res.status(500).json({
                message: "Impossible de démarrer la transaction",
                erreur: err.message
            });
        }


        // =================================================
        // Fonction ROLLBACK
        // =================================================

        const rollback = (message, status = 400) => {

            db.rollback(() => {

                console.log("ROLLBACK effectué :", message);

                res.status(status).json({
                    message
                });

            });

        };


        // =================================================
        // DÉPÔT
        // =================================================

        if (type_operation === "Depot") {

            if (!compte_destination) {

                return rollback(
                    "Le compte de destination est obligatoire"
                );
            }


            db.query(
                "SELECT * FROM compte WHERE id_compte = ? FOR UPDATE",
                [compte_destination],
                (err, comptes) => {

                    if (err) {

                        console.error(
                            "Erreur vérification compte dépôt :",
                            err
                        );

                        return rollback(
                            "Erreur lors de la vérification du compte",
                            500
                        );
                    }


                    if (comptes.length === 0) {

                        return rollback(
                            "Compte de destination introuvable",
                            404
                        );
                    }


                    // Ajouter l'argent au compte

                    db.query(
                        `
                        UPDATE compte
                        SET solde = solde + ?
                        WHERE id_compte = ?
                        `,
                        [montantNumber, compte_destination],
                        (err) => {

                            if (err) {

                                console.error(
                                    "Erreur mise à jour dépôt :",
                                    err
                                );

                                return rollback(
                                    "Erreur lors de la mise à jour du solde",
                                    500
                                );
                            }


                            enregistrerTransaction();
                        }
                    );
                }
            );

            return;
        }


        // =================================================
        // RETRAIT
        // =================================================

        if (type_operation === "Retrait") {

            if (!compte_source) {

                return rollback(
                    "Le compte source est obligatoire"
                );
            }


            db.query(
                "SELECT * FROM compte WHERE id_compte = ? FOR UPDATE",
                [compte_source],
                (err, comptes) => {

                    if (err) {

                        console.error(
                            "Erreur vérification compte retrait :",
                            err
                        );

                        return rollback(
                            "Erreur lors de la vérification du compte",
                            500
                        );
                    }


                    if (comptes.length === 0) {

                        return rollback(
                            "Compte introuvable",
                            404
                        );
                    }


                    const compte = comptes[0];

                    const nouveauSolde =
                        Number(compte.solde) - montantNumber;


                    // Vérifier le solde minimum

                    if (
                        nouveauSolde <
                        Number(compte.solde_minimum)
                    ) {

                        return rollback(
                            "Solde insuffisant pour effectuer ce retrait"
                        );
                    }


                    // Effectuer le retrait

                    db.query(
                        `
                        UPDATE compte
                        SET solde = solde - ?
                        WHERE id_compte = ?
                        `,
                        [montantNumber, compte_source],
                        (err) => {

                            if (err) {

                                console.error(
                                    "Erreur retrait :",
                                    err
                                );

                                return rollback(
                                    "Erreur lors du retrait",
                                    500
                                );
                            }


                            enregistrerTransaction();
                        }
                    );
                }
            );

            return;
        }


        // =================================================
        // VIREMENT
        // =================================================

        if (type_operation === "Virement") {

            if (!compte_source || !compte_destination) {

                return rollback(
                    "Les deux comptes sont obligatoires"
                );
            }


            if (
                Number(compte_source) ===
                Number(compte_destination)
            ) {

                return rollback(
                    "Le compte source et le compte destination doivent être différents"
                );
            }


            // Vérifier le compte source

            db.query(
                "SELECT * FROM compte WHERE id_compte = ? FOR UPDATE",
                [compte_source],
                (err, comptesSource) => {

                    if (err) {

                        console.error(
                            "Erreur compte source :",
                            err
                        );

                        return rollback(
                            "Erreur lors de la vérification du compte source",
                            500
                        );
                    }


                    if (comptesSource.length === 0) {

                        return rollback(
                            "Compte source introuvable",
                            404
                        );
                    }


                    const source = comptesSource[0];

                    const nouveauSolde =
                        Number(source.solde) - montantNumber;


                    // Vérifier le solde minimum

                    if (
                        nouveauSolde <
                        Number(source.solde_minimum)
                    ) {

                        return rollback(
                            "Solde insuffisant pour effectuer ce virement"
                        );
                    }


                    // Vérifier le compte destination

                    db.query(
                        "SELECT * FROM compte WHERE id_compte = ? FOR UPDATE",
                        [compte_destination],
                        (err, comptesDestination) => {

                            if (err) {

                                console.error(
                                    "Erreur compte destination :",
                                    err
                                );

                                return rollback(
                                    "Erreur lors de la vérification du compte destination",
                                    500
                                );
                            }


                            if (comptesDestination.length === 0) {

                                return rollback(
                                    "Compte destination introuvable",
                                    404
                                );
                            }


                            // Débiter le compte source

                            db.query(
                                `
                                UPDATE compte
                                SET solde = solde - ?
                                WHERE id_compte = ?
                                `,
                                [
                                    montantNumber,
                                    compte_source
                                ],
                                (err) => {

                                    if (err) {

                                        console.error(
                                            "Erreur débit source :",
                                            err
                                        );

                                        return rollback(
                                            "Erreur lors du débit du compte source",
                                            500
                                        );
                                    }


                                    // Créditer destination

                                    db.query(
                                        `
                                        UPDATE compte
                                        SET solde = solde + ?
                                        WHERE id_compte = ?
                                        `,
                                        [
                                            montantNumber,
                                            compte_destination
                                        ],
                                        (err) => {

                                            if (err) {

                                                console.error(
                                                    "Erreur crédit destination :",
                                                    err
                                                );

                                                return rollback(
                                                    "Erreur lors du crédit du compte destination",
                                                    500
                                                );
                                            }


                                            enregistrerTransaction();

                                        }
                                    );

                                }
                            );

                        }
                    );

                }
            );

            return;
        }


        // =================================================
        // ENREGISTRER LA TRANSACTION
        // =================================================

        function enregistrerTransaction() {

            console.log(
                "Enregistrement de la transaction..."
            );


            const sql = `
                INSERT INTO \`transaction\`
                (
                    type_operation,
                    montant,
                    libelle,
                    compte_source,
                    compte_destination,
                    id_utilisateur
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `;


            db.query(
                sql,
                [
                    type_operation,
                    montantNumber,
                    libelle || null,
                    compte_source || null,
                    compte_destination || null,
                    id_utilisateur || null
                ],
                (err, result) => {

                    if (err) {

                        console.error(
                            "ERREUR INSERT TRANSACTION :",
                            err
                        );


                        return db.rollback(() => {

                            res.status(500).json({
                                message:
                                    "Erreur lors de l'enregistrement de la transaction",
                                erreur: err.message
                            });

                        });

                    }


                    // =================================================
                    // TOUT EST BON → COMMIT
                    // =================================================

                    db.commit((err) => {

                        if (err) {

                            console.error(
                                "Erreur COMMIT :",
                                err
                            );


                            return db.rollback(() => {

                                res.status(500).json({
                                    message:
                                        "Erreur lors de la validation de la transaction",
                                    erreur: err.message
                                });

                            });
                        }


                        console.log(
                            "TRANSACTION VALIDÉE AVEC SUCCÈS"
                        );


                        res.status(201).json({

                            message:
                                "Transaction effectuée avec succès",

                            id_transaction:
                                result.insertId

                        });

                    });

                }
            );

        }

    });

});


module.exports = router;