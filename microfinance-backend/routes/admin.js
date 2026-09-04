const express = require("express");
const router = express.Router();
const db = require("../config/database");
const verifierToken = require("../middleware/auth");

// Route sécurisée pour vider les données non-utilisateurs
router.post("/clear", verifierToken, (req, res) => {
  // Seul l'administrateur peut effectuer cette opération
  if (!req.utilisateur || req.utilisateur.role !== "Administrateur") {
    return res.status(403).json({ message: "Accès refusé : privilèges insuffisants." });
  }

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: "Impossible de démarrer la transaction" });

    const rollback = (message, status = 500) => db.rollback(() => res.status(status).json({ message }));

    // Supprimer les données transactionnelles tout en conservant la table utilisateur
    db.query("DELETE FROM `transaction`", (err) => {
      if (err) return rollback("Erreur lors de la suppression des transactions");

      db.query("DELETE FROM remboursement", (err) => {
        if (err) return rollback("Erreur lors de la suppression des remboursements");

        db.query("DELETE FROM credit", (err) => {
          if (err) return rollback("Erreur lors de la suppression des crédits");

          db.query("DELETE FROM compte", (err) => {
            if (err) return rollback("Erreur lors de la suppression des comptes");

            db.query("DELETE FROM client", (err) => {
              if (err) return rollback("Erreur lors de la suppression des clients");

              db.commit((err) => {
                if (err) return rollback("Erreur lors de la validation des suppressions");

                return res.json({ message: "Données supprimées (utilisateurs préservés)." });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
