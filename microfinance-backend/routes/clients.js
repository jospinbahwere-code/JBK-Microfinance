const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Vérifier que chaque client possède au moins un compte
function ensureClientAccounts(callback) {
  const sql = `
    INSERT INTO compte
    (
      numero_compte,
      type_compte,
      solde,
      solde_minimum,
      decouvert_autorise,
      id_client
    )
    SELECT
      CONCAT('CP', UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)), c.id_client),
      'Courant',
      0,
      0,
      0,
      c.id_client
    FROM client c
    WHERE NOT EXISTS (
      SELECT 1
      FROM compte cp
      WHERE cp.id_client = c.id_client
    )
  `;

  db.query(sql, callback);
}

// Afficher tous les clients
router.get("/", (req, res) => {
  const sql = "SELECT * FROM client";

  ensureClientAccounts((accountError) => {
    if (accountError) {
      return res.status(500).json({
        message: "Impossible de vérifier les comptes des clients",
        erreur: accountError.message
      });
    }

    db.query(sql, (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Impossible de récupérer les clients",
          erreur: err.message
        });
      }

      res.json(result);
    });
  });
});

// Ajouter un client et créer automatiquement son compte
router.post("/", (req, res) => {
  const {
    nom,
    telephone,
    email,
    adresse,
    type_compte = "Courant"
  } = req.body;

  // Validation des informations obligatoires
  if (!nom || !nom.trim()) {
    return res.status(400).json({
      message: "Le nom du client est obligatoire"
    });
  }

  if (!telephone || !telephone.trim()) {
    return res.status(400).json({
      message: "Le numéro de téléphone est obligatoire"
    });
  }

  if (!adresse || !adresse.trim()) {
    return res.status(400).json({
      message: "L'adresse du client est obligatoire"
    });
  }

  // Vérification du type de compte
  if (!["Courant", "Epargne"].includes(type_compte)) {
    return res.status(400).json({
      message: "Le type de compte est invalide"
    });
  }

  // Vérification des doublons
  const duplicateSql = `
    SELECT id_client, nom, email
    FROM client
    WHERE LOWER(TRIM(nom)) = LOWER(TRIM(?))
      OR (
        NULLIF(TRIM(?), '') IS NOT NULL
        AND LOWER(TRIM(email)) = LOWER(TRIM(?))
      )
    LIMIT 1
  `;

  db.query(
    duplicateSql,
    [nom, email || "", email || ""],
    (duplicateError, duplicates) => {
      if (duplicateError) {
        return res.status(500).json({
          message: "Impossible de vérifier les coordonnées du client",
          erreur: duplicateError.message
        });
      }

      if (duplicates.length > 0) {
        return res.status(409).json({
          message: "Ces informations existent déjà pour une autre personne"
        });
      }

      // Récupération d'une connexion du pool
      db.getConnection((connectionError, connection) => {
        if (connectionError) {
          return res.status(500).json({
            message: "Impossible d'obtenir une connexion à la base de données",
            erreur: connectionError.message
          });
        }

        // Démarrage de la transaction
        connection.beginTransaction((transactionError) => {
          if (transactionError) {
            connection.release();

            return res.status(500).json({
              message: "Impossible de démarrer la création du client",
              erreur: transactionError.message
            });
          }

          // Fonction de rollback
          const rollback = (err) => {
            connection.rollback(() => {
              connection.release();

              return res.status(500).json({
                message: "Le client et son compte n'ont pas pu être créés",
                erreur: err.message
              });
            });
          };

          // Création du client
          const clientSql = `
            INSERT INTO client
            (nom, telephone, email, adresse)
            VALUES (?, ?, ?, ?)
          `;

          connection.query(
            clientSql,
            [
              nom.trim(),
              telephone.trim(),
              email ? email.trim() : null,
              adresse.trim()
            ],
            (clientError, result) => {
              if (clientError) {
                return rollback(clientError);
              }

              // Création automatique du compte
              const accountSql = `
                INSERT INTO compte
                (
                  numero_compte,
                  type_compte,
                  solde,
                  solde_minimum,
                  decouvert_autorise,
                  id_client
                )
                VALUES (?, ?, 0, ?, 0, ?)
              `;

              const soldeMinimum =
                type_compte === "Epargne" ? 10000 : 0;

              const numeroCompte =
                `CP${Date.now()}${result.insertId}`;

              connection.query(
                accountSql,
                [
                  numeroCompte,
                  type_compte,
                  soldeMinimum,
                  result.insertId
                ],
                (accountError, accountResult) => {
                  if (accountError) {
                    return rollback(accountError);
                  }

                  // Validation définitive de la transaction
                  connection.commit((commitError) => {
                    if (commitError) {
                      return rollback(commitError);
                    }

                    connection.release();

                    return res.status(201).json({
                      message: "Client et compte créés avec succès",
                      id_client: result.insertId,
                      id_compte: accountResult.insertId,
                      numero_compte: numeroCompte,
                      type_compte,
                      solde: 0
                    });
                  });
                }
              );
            }
          );
        });
      });
    }
  );
});

module.exports = router;