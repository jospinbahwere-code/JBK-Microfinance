const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "gestion_micro"
});

db.connect((err) => {
    if (err) {
        console.log("Erreur MySQL :", err.message);
    } else {
        console.log("Connexion MySQL réussie !");
    }
});

module.exports = db;