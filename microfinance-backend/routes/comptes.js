const express = require("express");
const router = express.Router();

const db = require("../config/database");


// Afficher tous les comptes
router.get("/", (req, res) => {

    const sql = `
        SELECT compte.*, client.nom 
        FROM compte
        JOIN client ON compte.id_client = client.id_client
    `;

    db.query(sql, (err, result) => {

        if(err){
            return res.status(500).json(err);
        }

        res.json(result);
    });

});


// Ouvrir un compte
router.post("/", (req,res)=>{

    const {
        id_client,
        type_compte,
        depot_initial,
        activer_decouvert,
        montant_decouvert
    } = req.body;


    let solde = depot_initial || 0;
    let decouvert_autorise = 0;
    let solde_minimum = 0;


    // Règles du compte courant
    if(type_compte === "Courant"){

        if(activer_decouvert){

            decouvert_autorise = montant_decouvert;
            solde_minimum = -montant_decouvert;

        }

    }


    // Règles du compte épargne
    if(type_compte === "Epargne"){

        if(!depot_initial || depot_initial <= 0){

            return res.status(400).json({
                message:"Le dépôt initial est obligatoire pour un compte épargne"
            });

        }

        decouvert_autorise = 0;
        solde_minimum = 10000;

    }


    // Génération simple du numéro compte
    const numero_compte =
    "CP" + Date.now();



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
    VALUES (?, ?, ?, ?, ?, ?)
    `;


    db.query(sql,
    [
        numero_compte,
        type_compte,
        solde,
        solde_minimum,
        decouvert_autorise,
        id_client
    ],
    (err,result)=>{

        if(err){
            return res.status(500).json(err);
        }


        res.json({
            message:"Compte ouvert avec succès",
            id_compte:result.insertId
        });

    });


});


module.exports = router;