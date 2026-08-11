const express = require("express");
const cors = require("cors");
require("./config/database.js");

const clientsRoutes = require("./routes/clients");
const compteRoutes = require("./routes/comptes");
const transactionRoutes = require("./routes/transactions");
const utilisateurRoutes = require("./routes/utilisateur");
const creditRoutes = require("./routes/credit");
const remboursementRoutes = require("./routes/remboursements");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/transactions", transactionRoutes);
app.use("/comptes", compteRoutes);
app.use("/clients", clientsRoutes);
app.use("/utilisateurs", utilisateurRoutes);
app.use("/credits", creditRoutes);
app.use("/remboursements", remboursementRoutes);
app.use("/auth", authRoutes);
app.get("/", (req, res) => {
    res.send("API Microfinance fonctionne !");
});

app.listen(5000, () => {
    console.log("Serveur lancé sur le port 5000");
});