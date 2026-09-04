const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcryptjs");

// One-time setup route to create the initial Administrateur account
// This route only allows creating an admin when the utilisateur table is empty.
router.post("/admin", async (req, res) => {
  const { nom, email, mot_de_passe } = req.body;

  if (!nom || !email || !mot_de_passe) {
    return res.status(400).json({ message: "nom, email et mot_de_passe sont requis" });
  }

  db.query("SELECT COUNT(*) AS cnt FROM utilisateur", (err, result) => {
    if (err) {
      console.error("Erreur vérification utilisateurs :", err);
      return res.status(500).json({ message: "Erreur serveur" });
    }

    const count = result[0].cnt;

    if (count > 0) {
      return res.status(403).json({ message: "La table utilisateur contient déjà des enregistrements. Cette route de configuration est désactivée." });
    }

    const hash = bcrypt.hashSync(mot_de_passe, 10);

    const sql = `
      INSERT INTO utilisateur
      (nom, email, mot_de_passe, role, actif)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [nom, email, hash, "Administrateur", 1], (insertErr, insertResult) => {
      if (insertErr) {
        console.error("Erreur création administrateur :", insertErr);
        return res.status(500).json({ message: "Erreur lors de la création de l'administrateur" });
      }

      res.json({ message: "Administrateur créé", id_utilisateur: insertResult.insertId });
    });
  });
});

module.exports = router;
