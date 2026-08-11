const express = require("express");
const router = express.Router();

const db = require("../config/database");
const bcrypt = require("bcryptjs");
const verifierToken = require("../middleware/auth");
// Afficher tous les utilisateurs

router.get("/", verifierToken, (req, res)=>{

    const sql = "SELECT * FROM utilisateur";


    db.query(sql, (err,result)=>{

        if(err){
            return res.status(500).json(err);
        }


        res.json(result);

    });

});



// Ajouter un utilisateur (par administrateur)

router.post("/", verifierToken, async (req,res)=>{


    const {
        nom,
        email,
        mot_de_passe,
        role
    } = req.body;

    const motDePasseHash = await bcrypt.hash(mot_de_passe, 10);

    const sql = `
    INSERT INTO utilisateur
    (nom, email, mot_de_passe, role, actif)
    VALUES (?, ?, ?, ?, ?)
    `;



    db.query(
    sql,
    [
        nom,
        email,
        motDePasseHash,
        role,
        1
    ],

        (err,result)=>{


            if(err){
                return res.status(500).json(err);
            }


            res.json({

                message:"Utilisateur créé avec succès",
                id_utilisateur: result.insertId

            });


        }
    );


});



// Modifier l'état d'un utilisateur

router.put("/:id", verifierToken, (req,res)=>{


    const {actif} = req.body;


    const sql = `
    UPDATE utilisateur
    SET actif=?
    WHERE id_utilisateur=?
    `;


    db.query(
        sql,
        [
            actif,
            req.params.id
        ],

        (err,result)=>{


            if(err){
                return res.status(500).json(err);
            }


            res.json({
                message:"Statut utilisateur modifié"
            });


        }
    );


});



module.exports = router;