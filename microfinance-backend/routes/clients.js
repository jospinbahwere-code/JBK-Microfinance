const express = require("express");
const router = express.Router();

const db = require("../config/database");


// Afficher tous les clients
router.get("/", (req, res) => {

    const sql = "SELECT * FROM client";

    db.query(sql, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(result);
    });

});

// Ajouter un client
router.post("/", (req,res)=>{

    const {nom, telephone, email, adresse} = req.body;


    const sql = `
        INSERT INTO client
        (nom, telephone, email, adresse)
        VALUES (?, ?, ?, ?)
    `;


    db.query(sql,
    [nom, telephone, email, adresse],
    (err,result)=>{

        if(err){
            return res.status(500).json(err);
        }

        res.json({
            message:"Client ajouté",
            id:result.insertId
        });

    });

});


module.exports = router;