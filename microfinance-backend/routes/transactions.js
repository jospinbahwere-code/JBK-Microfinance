const express = require("express");

const router = express.Router();

const db = require("../config/database");

// =====================================================
// Vérifier que la colonne nom_effectuant existe
// =====================================================

db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'transaction'
       AND column_name = 'nom_effectuant'`,
    (err, result) => {
        if (err) {
            console.error(
                "Erreur vérification colonne nom_effectuant :",
                err
            );
            return;
        }

        if (result[0].count === 0) {
            db.query(
                "ALTER TABLE `transaction` ADD COLUMN nom_effectuant VARCHAR(255) NULL",
                (alterErr) => {
                    if (alterErr) {
                        console.error(
                            "Erreur ajout colonne nom_effectuant :",
                            alterErr
                        );
                    } else {
                        console.log(
                            "Colonne nom_effectuant ajoutée avec succès."
                        );
                    }
                }
            );
        }
    }
);

// =====================================================
// GET : Récupérer toutes les transactions
// =====================================================

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
            t.nom_effectuant,
            u.nom AS nom_utilisateur
        FROM \`transaction\` t
        LEFT JOIN utilisateur u
            ON t.id_utilisateur = u.id_utilisateur
        ORDER BY t.date_operation DESC
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error(
                "Erreur récupération transactions :",
                err
            );

            return res.status(500).json({
                message:
                    "Erreur lors de la récupération des transactions",
                erreur: err.message
            });
        }

        console.log(
            "TRANSACTIONS ENVOYÉES À REACT :",
            result
        );

        res.json(result);
    });
});

// =====================================================
// POST : Effectuer une opération
// =====================================================

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
        id_utilisateur,
        nom_effectuant
    } = req.body;

    // =================================================
    // VALIDATIONS
    // =================================================

    if (!montant || Number(montant) <= 0) {
        return res.status(400).json({
            message: "Le montant doit être supérieur à 0"
        });
    }

    if (
        !["Depot", "Retrait", "Virement"].includes(
            type_operation
        )
    ) {
        return res.status(400).json({
            message: "Type d'opération invalide"
        });
    }

    if (!id_utilisateur) {
        return res.status(400).json({
            message:
                "L'agent ayant effectué l'opération est obligatoire"
        });
    }

    if (
        !nom_effectuant ||
        !String(nom_effectuant).trim()
    ) {
        return res.status(400).json({
            message:
                "La personne ayant effectué l'opération est obligatoire"
        });
    }

    const montantNumber = Number(montant);

    // =================================================
    // RÉCUPÉRER UNE CONNEXION DU POOL
    // =================================================

    db.getConnection((connectionError, connection) => {
        if (connectionError) {
            console.error(
                "Erreur récupération connexion :",
                connectionError
            );

            return res.status(500).json({
                message:
                    "Impossible d'obtenir une connexion à la base de données",
                erreur: connectionError.message
            });
        }

        // =================================================
        // DÉMARRER LA TRANSACTION
        // =================================================

        connection.beginTransaction((transactionError) => {
            if (transactionError) {
                console.error(
                    "Erreur START TRANSACTION :",
                    transactionError
                );

                connection.release();

                return res.status(500).json({
                    message:
                        "Impossible de démarrer la transaction",
                    erreur: transactionError.message
                });
            }

            // =================================================
            // ROLLBACK
            // =================================================

            const rollback = (
                message,
                status = 400
            ) => {
                connection.rollback(() => {
                    console.log(
                        "ROLLBACK effectué :",
                        message
                    );

                    connection.release();

                    return res.status(status).json({
                        message
                    });
                });
            };

            // =================================================
            // ENREGISTRER LA TRANSACTION
            // =================================================

            const enregistrerTransaction = () => {
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
                        id_utilisateur,
                        nom_effectuant
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                connection.query(
                    sql,
                    [
                        type_operation,
                        montantNumber,
                        libelle || null,
                        compte_source || null,
                        compte_destination || null,
                        id_utilisateur,
                        String(nom_effectuant).trim()
                    ],
                    (err, result) => {
                        if (err) {
                            console.error(
                                "ERREUR INSERT TRANSACTION :",
                                err
                            );

                            return rollback(
                                "Erreur lors de l'enregistrement de la transaction",
                                500
                            );
                        }

                        // =================================================
                        // COMMIT
                        // =================================================

                        connection.commit(
                            (commitError) => {
                                if (commitError) {
                                    console.error(
                                        "Erreur COMMIT :",
                                        commitError
                                    );

                                    return connection.rollback(
                                        () => {
                                            connection.release();

                                            res.status(500).json({
                                                message:
                                                    "Erreur lors de la validation de la transaction",
                                                erreur:
                                                    commitError.message
                                            });
                                        }
                                    );
                                }

                                console.log(
                                    "TRANSACTION VALIDÉE AVEC SUCCÈS"
                                );

                                connection.release();

                                return res.status(201).json({
                                    message:
                                        "Transaction effectuée avec succès",
                                    id_transaction:
                                        result.insertId
                                });
                            }
                        );
                    }
                );
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

                connection.query(
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

                        // Ajouter l'argent
                        connection.query(
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

                connection.query(
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
                            Number(compte.solde) -
                            montantNumber;

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
                        connection.query(
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
                if (
                    !compte_source ||
                    !compte_destination
                ) {
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
                connection.query(
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

                        if (
                            comptesSource.length === 0
                        ) {
                            return rollback(
                                "Compte source introuvable",
                                404
                            );
                        }

                        const source =
                            comptesSource[0];

                        const nouveauSolde =
                            Number(source.solde) -
                            montantNumber;

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
                        connection.query(
                            "SELECT * FROM compte WHERE id_compte = ? FOR UPDATE",
                            [compte_destination],
                            (
                                err,
                                comptesDestination
                            ) => {
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

                                if (
                                    comptesDestination.length ===
                                    0
                                ) {
                                    return rollback(
                                        "Compte destination introuvable",
                                        404
                                    );
                                }

                                // Débiter source
                                connection.query(
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
                                        connection.query(
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
        });
    });
});

module.exports = router;