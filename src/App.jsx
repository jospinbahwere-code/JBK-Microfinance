import { useEffect, useMemo, useState } from "react";
import "./App.css";
import api from "./api/axios";

const roleAccess = {
  Administrateur: [
    "dashboard",
    "clients",
    "accounts",
    "transactions",
    "credits",
    "reports",
    "users",
  ],
  Gestionnaire: [
    "dashboard",
    "clients",
    "accounts",
    "transactions",
    "reports",
  ],
  Caissier: [
    "dashboard",
    "clients",
    "accounts",
    "transactions",
  ],
  Comptable: [
    "dashboard",
    "accounts",
    "transactions",
    "reports",
  ],
  "Agent de crédit": [
    "dashboard",
    "clients",
    "credits",
  ],
};

const nav = [
  ["dashboard", "Tableau de bord"],
  ["clients", "Clients"],
  ["accounts", "Comptes"],
  ["transactions", "Opérations"],
  ["credits", "Crédits"],
  ["reports", "Rapports"],
  ["users", "Utilisateurs"],
];

const money = (n) =>
  `${new Intl.NumberFormat("fr-FR").format(Number(n) || 0)} CDF`;

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [credits, setCredits] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [users, setUsers] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() =>
    localStorage.getItem("jbk_token")
  );

  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);

  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [statementClientId, setStatementClientId] = useState(null);

  const [clientFormError, setClientFormError] = useState("");
  const [transactionFormError, setTransactionFormError] = useState("");
  const [accountFormError, setAccountFormError] = useState("");
  const [creditFormError, setCreditFormError] = useState("");
  const [paymentFormError, setPaymentFormError] = useState("");
  const [userFormError, setUserFormError] = useState("");

  const name = (id) =>
    clients.find((client) => client.id === Number(id))?.name ||
    "Client inconnu";

  const allowed = currentUser ? roleAccess[currentUser.role] || [] : [];

  const totals = useMemo(
    () => ({
      balance: accounts.reduce(
        (sum, account) => sum + Number(account.balance || 0),
        0
      ),

      deposits: transactions
        .filter((item) => item.type === "Dépôt")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),

      withdrawals: transactions
        .filter((item) => item.type === "Retrait")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),

      loans: credits.reduce(
        (sum, credit) =>
          sum +
          Math.max(
            0,
            Number(credit.totalToPay || 0) -
              Number(credit.paid || 0)
          ),
        0
      ),
    }),
    [accounts, transactions, credits]
  );

  const toast = (message) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 3500);
  };

  const clearFormErrors = () => {
    setClientFormError("");
    setTransactionFormError("");
    setAccountFormError("");
    setCreditFormError("");
    setPaymentFormError("");
    setUserFormError("");
  };

  const open = (kind) => {
    clearFormErrors();
    setModal(kind);
  };

  async function chargerClients() {
    try {
      const res = await api.get("/clients");

      const clientsFormates = res.data.map((client) => ({
        id: client.id_client,
        name: client.nom,
        phone: client.telephone,
        email: client.email,
        address: client.adresse,
      }));

      setClients(clientsFormates);
    } catch (err) {
      console.error("Erreur chargement clients :", err);
    }
  }

  async function chargerComptes() {
    try {
      const res = await api.get("/comptes");

      const comptesFormates = res.data.map((compte) => ({
        id: compte.id_compte,
        number: compte.numero_compte,
        type: compte.type_compte,
        balance: Number(compte.solde || 0),
        minBalance: Number(compte.solde_minimum || 0),
        overdraftLimit: Number(compte.decouvert_autorise || 0),
        openedAt: compte.date_ouverture,
        status: compte.statut,
        clientId: compte.id_client,
      }));

      setAccounts(comptesFormates);
    } catch (err) {
      console.error("Erreur chargement comptes :", err);
    }
  }

  async function chargerTransactions() {
    try {
      const res = await api.get("/transactions");

      const transactionsFormatees = res.data.map((transaction) => ({
        id: transaction.id_transaction,

        type:
          transaction.type_operation === "Depot"
            ? "Dépôt"
            : transaction.type_operation === "Retrait"
            ? "Retrait"
            : "Virement",

        amount: Number(transaction.montant || 0),
        date: transaction.date_operation,
        label: transaction.libelle,

        accountId:
          transaction.compte_source ??
          transaction.compte_destination,

        targetId: transaction.compte_destination,

        userId: transaction.id_utilisateur,
        user: transaction.nom_utilisateur,
        performedBy: transaction.nom_effectuant,
      }));

      setTransactions(transactionsFormatees);
    } catch (err) {
      console.error("Erreur chargement transactions :", err);
    }
  }

  async function chargerUtilisateurs() {
    try {
      const res = await api.get("/utilisateurs");

      const utilisateursFormates = res.data.map((utilisateur) => ({
        id: utilisateur.id_utilisateur,
        name: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        active: Boolean(utilisateur.actif),
      }));

      setUsers(utilisateursFormates);
    } catch (err) {
      console.error("Erreur chargement utilisateurs :", err);
    }
  }

  async function chargerCredits() {
    try {
      const res = await api.get("/credits");

      const creditsFormates = res.data.map((credit) => {
        const totalToPay = Number(credit.montant_rembourse || 0);
        const duration = Number(credit.duree || 0);

        return {
          id: credit.id_credit,
          clientId: credit.id_client,
          amount: Number(credit.montant || 0),
          rate: Number(credit.taux || 0),
          duration,
          issuedAt: credit.date_octroi,
          paid: Number(credit.montant_rembourse_paye || 0),
          totalToPay,
          monthlyPayment:
            duration > 0 ? totalToPay / duration : totalToPay,
          status: credit.statut,
        };
      });

      setCredits(creditsFormates);
    } catch (err) {
      console.error("Erreur chargement crédits :", err);
    }
  }

  async function chargerRemboursements() {
    try {
      const res = await api.get("/remboursements");

      const remboursementsFormates = res.data.map((repayment) => ({
        id: repayment.id_remboursement,
        creditId: repayment.id_credit,
        amount: Number(repayment.montant || 0),
        date: repayment.date_remboursement,
        agent: repayment.nom_utilisateur,
      }));

      setRepayments(remboursementsFormates);
    } catch (err) {
      console.error(
        "Erreur chargement remboursements :",
        err
      );
    }
  }

  useEffect(() => {
    if (!token) return;

    chargerClients();
    chargerComptes();
    chargerTransactions();
    chargerUtilisateurs();
    chargerCredits();
    chargerRemboursements();
  }, [token]);

  const submit = async (kind, form) => {
    clearFormErrors();

    /*
     * ==========================
     * CLIENT
     * ==========================
     */
    if (kind === "client") {
      if (!form.name?.trim()) {
        setClientFormError("Veuillez saisir le nom complet.");
        return;
      }

      if (!form.phone?.trim()) {
        setClientFormError("Veuillez saisir le numéro de téléphone.");
        return;
      }

      if (!form.address?.trim()) {
        setClientFormError("Veuillez saisir l'adresse.");
        return;
      }

      try {
        await api.post("/clients", {
          nom: form.name.trim(),
          telephone: form.phone.trim(),
          email: form.email?.trim() || null,
          adresse: form.address.trim(),
          type_compte: form.accountType,
        });

        await chargerClients();
        await chargerComptes();

        setModal(null);

        toast("Client et compte enregistrés avec succès.");
      } catch (err) {
        console.error("Erreur création client :", err);

        setClientFormError(
          err.response?.data?.message ||
            "Erreur lors de l'enregistrement du client."
        );
      }

      return;
    }

    /*
     * ==========================
     * COMPTE
     * ==========================
     */
    if (kind === "account") {
      const opening = Number(form.opening || 0);
      const isSavings = form.type === "Epargne";

      if (!form.clientId) {
        setAccountFormError(
          "Veuillez sélectionner un client."
        );
        return;
      }

      if (opening < 0) {
        setAccountFormError(
          "Le dépôt initial ne peut pas être négatif."
        );
        return;
      }

      if (isSavings && opening < 10000) {
        setAccountFormError(
          "Le compte épargne exige un dépôt initial minimum de 10 000 CDF."
        );
        return;
      }

      try {
        await api.post("/comptes", {
          id_client: Number(form.clientId),
          type_compte: form.type,
          depot_initial: opening,
          activer_decouvert:
            form.type === "Courant"
              ? Boolean(form.withOverdraft)
              : false,
          montant_decouvert:
            form.type === "Courant" && form.withOverdraft
              ? 50000
              : 0,
        });

        await chargerComptes();

        setModal(null);

        toast("Compte créé avec succès.");
      } catch (err) {
        console.error("Erreur création compte :", err);

        setAccountFormError(
          err.response?.data?.message ||
            "Erreur lors de la création du compte."
        );
      }

      return;
    }

    /*
     * ==========================
     * CREDIT
     * ==========================
     */
    if (kind === "credit") {
      if (!form.clientId) {
        setCreditFormError(
          "Veuillez sélectionner un client."
        );
        return;
      }

      const amount = Number(form.amount);
      const rate = Number(form.rate);
      const duration = Number(form.duration);

      if (!amount || amount <= 0) {
        setCreditFormError(
          "Le montant du crédit doit être supérieur à 0."
        );
        return;
      }

      if (form.rate === "" || Number.isNaN(rate) || rate < 0) {
        setCreditFormError(
          "Le taux d'intérêt est invalide."
        );
        return;
      }

      if (!duration || duration <= 0) {
        setCreditFormError(
          "La durée doit être supérieure à 0."
        );
        return;
      }

      try {
        await api.post("/credits", {
          montant: amount,
          taux: rate,
          duree: duration,
          id_client: Number(form.clientId),
        });

        await chargerCredits();

        setModal(null);

        toast("Crédit accordé et enregistré avec succès.");
      } catch (err) {
        console.error("Erreur création crédit :", err);

        setCreditFormError(
          err.response?.data?.message ||
            "Erreur lors de l'enregistrement du crédit."
        );
      }

      return;
    }

    /*
     * ==========================
     * REMBOURSEMENT
     * ==========================
     */
    if (kind === "payment") {
      const amount = Number(form.amount);

      if (!form.creditId) {
        setPaymentFormError(
          "Veuillez sélectionner un crédit."
        );
        return;
      }

      if (!amount || amount <= 0) {
        setPaymentFormError(
          "Saisissez un montant de remboursement valide."
        );
        return;
      }

      const selectedCredit = credits.find(
        (credit) =>
          credit.id === Number(form.creditId)
      );

      if (!selectedCredit) {
        setPaymentFormError(
          "Le crédit sélectionné est introuvable."
        );
        return;
      }

      const remaining = Math.max(
        0,
        Number(selectedCredit.totalToPay) -
          Number(selectedCredit.paid)
      );

      const expectedPayment = Math.min(
        Number(selectedCredit.monthlyPayment),
        remaining
      );

      if (amount > remaining) {
        setPaymentFormError(
          "Le montant du remboursement ne doit pas excéder le montant restant."
        );
        return;
      }

      if (Math.abs(amount - expectedPayment) > 0.01) {
        setPaymentFormError(
          `La mensualité attendue est de ${money(
            expectedPayment
          )}.`
        );
        return;
      }

      try {
        await api.post("/remboursements", {
          montant: amount,
          id_credit: Number(form.creditId),
          id_utilisateur: Number(currentUser.id),
        });

        await chargerCredits();
        await chargerRemboursements();

        setModal(null);

        toast("Remboursement enregistré avec succès.");
      } catch (err) {
        console.error("Erreur remboursement :", err);

        setPaymentFormError(
          err.response?.data?.message ||
            "Erreur lors de l'enregistrement du remboursement."
        );
      }

      return;
    }

    /*
     * ==========================
     * UTILISATEUR
     * ==========================
     */
    if (kind === "user") {
      if (!form.name?.trim()) {
        setUserFormError(
          "Veuillez saisir le nom complet."
        );
        return;
      }

      if (!form.email?.trim()) {
        setUserFormError(
          "Veuillez saisir l'adresse e-mail."
        );
        return;
      }

      if (!form.password) {
        setUserFormError(
          "Veuillez saisir le mot de passe."
        );
        return;
      }

      if (!form.role) {
        setUserFormError(
          "Veuillez sélectionner un rôle."
        );
        return;
      }

      try {
        await api.post("/utilisateurs", {
          nom: form.name.trim(),
          email: form.email.trim(),
          mot_de_passe: form.password,
          role: form.role,
        });

        await chargerUtilisateurs();

        setModal(null);

        toast("Utilisateur créé avec succès.");
      } catch (err) {
        console.error(
          "Erreur création utilisateur :",
          err
        );

        setUserFormError(
          err.response?.data?.message ||
            "Erreur lors de la création de l'utilisateur."
        );
      }

      return;
    }

    /*
     * ==========================
     * TRANSACTION
     * ==========================
     */
    if (kind === "transaction") {
      const amount = Number(form.amount);

      if (!form.clientId) {
        setTransactionFormError(
          "Veuillez sélectionner le client concerné."
        );
        return;
      }

      if (!form.accountId) {
        setTransactionFormError(
          "Aucun compte n'est associé à ce client."
        );
        return;
      }

      if (!amount || amount <= 0) {
        setTransactionFormError(
          "Veuillez saisir un montant valide."
        );
        return;
      }

      if (!form.performedBy?.trim()) {
        setTransactionFormError(
          "Veuillez saisir le nom de la personne ayant effectué l'opération."
        );
        return;
      }

      const source = accounts.find(
        (account) =>
          account.id === Number(form.accountId)
      );

      if (!source) {
        setTransactionFormError(
          "Le compte sélectionné est introuvable."
        );
        return;
      }

      let target = null;

      if (form.type === "Virement") {
        if (!form.targetClientId) {
          setTransactionFormError(
            "Veuillez sélectionner le client bénéficiaire."
          );
          return;
        }

        if (!form.targetId) {
          setTransactionFormError(
            "Aucun compte bénéficiaire n'est associé à ce client."
          );
          return;
        }

        target = accounts.find(
          (account) =>
            account.id === Number(form.targetId)
        );

        if (!target) {
          setTransactionFormError(
            "Le compte bénéficiaire est introuvable."
          );
          return;
        }

        if (target.id === source.id) {
          setTransactionFormError(
            "Le compte bénéficiaire doit être différent du compte source."
          );
          return;
        }
      }

      try {
        const typeOperation =
          form.type === "Dépôt"
            ? "Depot"
            : form.type === "Retrait"
            ? "Retrait"
            : "Virement";

        await api.post("/transactions", {
          type_operation: typeOperation,
          montant: amount,

          libelle:
            form.label?.trim() ||
            `${form.type} au guichet`,

          compte_source:
            form.type === "Dépôt"
              ? null
              : Number(form.accountId),

          compte_destination:
            form.type === "Dépôt"
              ? Number(form.accountId)
              : form.type === "Virement"
              ? Number(form.targetId)
              : null,

          id_utilisateur: Number(currentUser.id),

          nom_effectuant:
            form.performedBy.trim(),
        });

        await chargerComptes();
        await chargerTransactions();

        setModal(null);

        toast(
          `${form.type} enregistré avec succès.`
        );
      } catch (err) {
        console.error(
          "Erreur transaction :",
          err
        );

        setTransactionFormError(
          err.response?.data?.message ||
            "Erreur lors de l'opération."
        );
      }

      return;
    }
  };

  if (!currentUser) {
    return (
      <Login
        onLogin={(user, receivedToken) => {
          setCurrentUser(user);
          setToken(receivedToken);

          localStorage.setItem(
            "jbk_token",
            receivedToken
          );

          setView("dashboard");
        }}
      />
    );
  }

  const filteredNav = nav.filter(([id]) =>
    allowed.includes(id)
  );

  const filteredClients = clients.filter((client) =>
    `${client.name} ${client.phone}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredAccounts = accounts.filter((account) =>
    `${account.number} ${name(account.clientId)}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const statementClient = clients.find(
    (client) => client.id === statementClientId
  );

  const statementRows = statementClientId
    ? transactions.filter((transaction) => {
        const account = accounts.find(
          (value) =>
            value.id === transaction.accountId
        );

        return (
          account?.clientId === statementClientId
        );
      })
    : [];

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <b>J</b>

          <span>
            <strong>JBK</strong>
            <small>Microfinance</small>
          </span>
        </div>

        <nav>
          {filteredNav.map(([id, label]) => (
            <button
              key={id}
              className={
                view === id ? "active" : ""
              }
              onClick={() => {
                setView(id);
                setSearch("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          className="signout"
          onClick={() => {
            setCurrentUser(null);
            setToken(null);
            localStorage.removeItem("jbk_token");
            setView("dashboard");
          }}
        >
          Déconnexion
        </button>

        <div className="agent">
          <i>
            {currentUser.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </i>

          <span>
            <strong>{currentUser.name}</strong>
            <small>{currentUser.role}</small>
          </span>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p>JBK MICROFINANCE</p>

            <h1>
              {nav.find(
                (item) => item[0] === view
              )?.[1]}
            </h1>
          </div>

          <span>{formatDate(today())}</span>
        </header>

        {notice && (
          <div className="notice">
            {notice}
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            totals={totals}
            data={{
              clients,
              accounts,
              transactions,
              credits,
              name,
            }}
            role={currentUser.role}
            open={open}
          />
        )}

        {view === "clients" && (
          <Directory
            type="clients"
            rows={filteredClients}
            accounts={accounts}
            search={search}
            setSearch={setSearch}
            canCreate={
              currentUser.role !== "Comptable"
            }
            open={open}
            onStatement={setStatementClientId}
          />
        )}

        {view === "accounts" && (
          <Directory
            type="accounts"
            rows={filteredAccounts}
            name={name}
            search={search}
            setSearch={setSearch}
            canCreate={
              currentUser.role ===
                "Administrateur" ||
              currentUser.role === "Gestionnaire"
            }
            open={open}
          />
        )}

        {view === "transactions" && (
          <Transactions
            rows={transactions}
            accounts={accounts}
            name={name}
            canCreate={
              currentUser.role ===
                "Administrateur" ||
              currentUser.role === "Caissier"
            }
            open={open}
          />
        )}

        {view === "credits" && (
          <Credits
            rows={credits}
            repayments={repayments}
            name={name}
            role={currentUser.role}
            open={open}
          />
        )}

        {view === "reports" && (
          <Reports
            totals={totals}
            rows={transactions}
            accounts={accounts}
            name={name}
            clients={clients}
          />
        )}

        {view === "users" && (
          <Users
            users={users}
            open={open}
          />
        )}
      </main>

      {modal && (
        <Form
          type={modal}
          clients={clients}
          accounts={accounts}
          credits={credits}
          close={() => {
            setModal(null);
            clearFormErrors();
          }}
          submit={submit}
          error={
            modal === "client"
              ? clientFormError
              : modal === "transaction"
              ? transactionFormError
              : modal === "account"
              ? accountFormError
              : modal === "credit"
              ? creditFormError
              : modal === "payment"
              ? paymentFormError
              : modal === "user"
              ? userFormError
              : ""
          }
        />
      )}

      {statementClient && (
        <ClientStatement
          client={statementClient}
          rows={statementRows}
          accounts={accounts}
          name={name}
          close={() =>
            setStatementClientId(null)
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   CONNEXION
========================================================= */

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError(
        "Veuillez saisir votre email et votre mot de passe."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await api.post(
        "/auth/login",
        {
          email: email.trim(),
          mot_de_passe: password,
        }
      );

      const utilisateur =
        res.data.utilisateur;

      const receivedToken = res.data.token;

      const user = {
        id: utilisateur.id_utilisateur,
        name: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        active: Boolean(utilisateur.actif),
      };

      onLogin(user, receivedToken);
    } catch (err) {
      console.error(
        "Erreur connexion :",
        err
      );

      setError(
        err.response?.data?.message ||
          "Email ou mot de passe incorrect."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <b>J</b>
        </div>

        <h1>JBK MICROFINANCE</h1>

        <h2>Connexion au système</h2>

        <p>
          Connectez-vous avec vos identifiants
          professionnels.
        </p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label>
            E-mail professionnel
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="exemple@jbk.cd"
            required
            disabled={loading}
          />

          <label>
            Mot de passe
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Votre mot de passe"
            required
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Connexion..."
              : "Se connecter"}
          </button>
        </form>

        <small className="login-footer">
          JBK Microfinance — Accès sécurisé
        </small>
      </div>
    </div>
  );
}

/* =========================================================
   TABLEAU DE BORD
========================================================= */

function Dashboard({
  totals,
  data,
  role,
  open,
}) {
  const actions = [];

  if (
    role === "Caissier" ||
    role === "Administrateur"
  ) {
    actions.push([
      "transaction",
      "Nouvelle opération",
      "Dépôt, retrait ou virement",
    ]);
  }

  if (
    role === "Gestionnaire" ||
    role === "Administrateur"
  ) {
    actions.push(
      [
        "client",
        "Ajouter un client",
        "Créer un nouveau dossier",
      ],
      [
        "account",
        "Ouvrir un compte",
        "Associer un compte au client",
      ]
    );
  }

  if (
    role === "Agent de crédit" ||
    role === "Administrateur"
  ) {
    actions.push([
      "credit",
      "Accorder un crédit",
      "Enregistrer un financement",
    ]);
  }

  return (
    <>
      <section className="quick">
        {actions.map((action) => (
          <button
            key={action[1]}
            onClick={() => open(action[0])}
          >
            <b>{action[1]}</b>
            <span>{action[2]}</span>
          </button>
        ))}
      </section>

      <section className="metrics">
        <Metric
          t="Encours d'épargne"
          v={money(totals.balance)}
          c="green"
        />

        <Metric
          t="Dépôts enregistrés"
          v={money(totals.deposits)}
          c="blue"
        />

        <Metric
          t="Retraits enregistrés"
          v={money(totals.withdrawals)}
          c="orange"
        />

        <Metric
          t="Crédits à recouvrer"
          v={money(totals.loans)}
          c="red"
        />
      </section>

      <section className="grid">
        <div className="panel">
          <Head
            title="Activité récente"
            sub="Dernières opérations enregistrées"
          />

          <Table
            rows={data.transactions.slice(0, 5)}
            accounts={data.accounts}
            name={data.name}
          />
        </div>

        <div className="panel loans">
          <Head
            title="Portefeuille crédits"
            sub="Suivi des remboursements"
          />

          {data.credits.length ? (
            data.credits.map((credit) => {
              const total =
                Number(credit.totalToPay || 0);

              const paid =
                Number(credit.paid || 0);

              const progress =
                total > 0
                  ? Math.min(
                      100,
                      (paid / total) * 100
                    )
                  : 0;

              return (
                <div
                  className="loan"
                  key={credit.id}
                >
                  <div>
                    <b>
                      {data.name(
                        credit.clientId
                      )}
                    </b>

                    <small>
                      Reste{" "}
                      {money(
                        Math.max(
                          0,
                          total - paid
                        )
                      )}
                    </small>
                  </div>

                  <div className="bar">
                    <i
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <span>
                    {Math.round(progress)}%
                  </span>
                </div>
              );
            })
          ) : (
            <Empty text="Aucun crédit enregistré." />
          )}
        </div>
      </section>
    </>
  );
}

function Metric({ t, v, c }) {
  return (
    <div className={`metric ${c}`}>
      <p>{t}</p>
      <b>{v}</b>
      <small>
        Mis à jour aujourd'hui
      </small>
    </div>
  );
}

function Head({
  title,
  sub,
  children,
}) {
  return (
    <div className="head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>

      {children}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty">
      {text}
    </div>
  );
}

/* =========================================================
   CLIENTS / COMPTES
========================================================= */

function Directory({
  type,
  rows,
  accounts,
  name,
  search,
  setSearch,
  canCreate,
  open,
  onStatement,
}) {
  const isClients = type === "clients";

  return (
    <section className="panel full">
      <Head
        title={
          isClients
            ? "Répertoire clients"
            : "Comptes clients"
        }
        sub={
          isClients
            ? `${rows.length} client(s) affiché(s)`
            : "Soldes disponibles en temps réel"
        }
      >
        {canCreate && (
          <button
            className="primary"
            onClick={() =>
              open(
                isClients
                  ? "client"
                  : "account"
              )
            }
          >
            {isClients
              ? "Nouveau client"
              : "Ouvrir un compte"}
          </button>
        )}
      </Head>

      <input
        className="search"
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
        placeholder={
          isClients
            ? "Rechercher par nom ou téléphone"
            : "Rechercher un numéro ou un client"
        }
      />

      {isClients ? (
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Contact</th>
              <th>Comptes</th>
              <th>Solde cumulé</th>
              <th>Statut</th>
              <th>Relevé</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((client) => {
                const clientAccounts =
                  accounts.filter(
                    (account) =>
                      account.clientId ===
                      client.id
                  );

                return (
                  <tr key={client.id}>
                    <td>
                      <b>{client.name}</b>
                      <small>
                        {client.address}
                      </small>
                    </td>

                    <td>
                      {client.phone}
                      <small>
                        {client.email ||
                          "Aucun e-mail"}
                      </small>
                    </td>

                    <td>
                      {clientAccounts.length}
                    </td>

                    <td className="amount">
                      {money(
                        clientAccounts.reduce(
                          (sum, account) =>
                            sum +
                            Number(
                              account.balance ||
                                0
                            ),
                          0
                        )
                      )}
                    </td>

                    <td>
                      <em>Actif</em>
                    </td>

                    <td>
                      <button
                        className="secondary"
                        onClick={() =>
                          onStatement(
                            client.id
                          )
                        }
                      >
                        Voir / imprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                text="Aucun client enregistré."
                colSpan="6"
              />
            )}
          </tbody>
        </table>
      ) : (
        <table>
          <thead>
            <tr>
              <th>N° de compte</th>
              <th>Propriétaire</th>
              <th>Type</th>
              <th>Ouvert le</th>
              <th>Solde</th>
              <th>Statut</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((account) => (
                <tr key={account.id}>
                  <td>
                    <b>{account.number}</b>
                  </td>

                  <td>
                    {name(account.clientId)}
                  </td>

                  <td>
                    <b>{account.type}</b>

                    <small>
                      {account.type ===
                      "Epargne"
                        ? `Solde minimum : ${money(
                            account.minBalance ??
                              10000
                          )}`
                        : `Découvert autorisé : ${money(
                            account.overdraftLimit ||
                              0
                          )}`}
                    </small>
                  </td>

                  <td>
                    {formatDate(
                      account.openedAt
                    )}
                  </td>

                  <td className="amount">
                    {money(account.balance)}
                  </td>

                  <td>
                    <em>
                      {account.status}
                    </em>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow
                text="Aucun compte enregistré."
                colSpan="6"
              />
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function EmptyRow({
  text,
  colSpan,
}) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="empty">
          {text}
        </div>
      </td>
    </tr>
  );
}

/* =========================================================
   TRANSACTIONS
========================================================= */

function Transactions({
  rows,
  accounts,
  name,
  canCreate,
  open,
}) {
  return (
    <section className="panel full">
      <Head
        title="Journal des opérations"
        sub="Historique sécurisé des mouvements financiers"
      >
        {canCreate && (
          <button
            className="primary"
            onClick={() =>
              open("transaction")
            }
          >
            Nouvelle opération
          </button>
        )}
      </Head>

      {rows.length ? (
        <Table
          rows={rows}
          accounts={accounts}
          name={name}
        />
      ) : (
        <Empty text="Aucune opération enregistrée." />
      )}
    </section>
  );
}

function Table({
  rows,
  accounts,
  name,
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Opération</th>
          <th>Compte</th>
          <th>Client</th>
          <th>Date</th>
          <th>Montant</th>
          <th>Effectué par</th>
          <th>Agent</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((item) => {
          const account =
            accounts.find(
              (value) =>
                value.id ===
                item.accountId
            );

          return (
            <tr key={item.id}>
              <td>
                <b>{item.type}</b>
                <small>
                  {item.label}
                </small>
              </td>

              <td>
                {account?.number || "-"}
              </td>

              <td>
                {name(account?.clientId)}
              </td>

              <td>
                {formatDate(item.date)}
              </td>

              <td
                className={
                  item.type === "Retrait"
                    ? "amount minus"
                    : "amount"
                }
              >
                {item.type === "Retrait"
                  ? "-"
                  : "+"}
                {money(item.amount)}
              </td>

              <td>
                {item.performedBy || "-"}
              </td>

              <td>
                {item.user || "-"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* =========================================================
   RELEVE CLIENT
========================================================= */

function ClientStatement({
  client,
  rows,
  accounts,
  name,
  close,
}) {
  return (
    <div className="shade">
      <section className="modal statement">
        <div className="modalhead">
          <h2>
            Relevé de {client.name}
          </h2>

          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <p>
          {client.phone} ·{" "}
          {client.email ||
            "Aucun e-mail"}
        </p>

        {rows.length ? (
          <Table
            rows={rows}
            accounts={accounts}
            name={name}
          />
        ) : (
          <Empty
            text="Aucune opération enregistrée pour ce client."
          />
        )}

        <footer>
          <button
            className="secondary"
            onClick={close}
          >
            Fermer
          </button>

          <button
            className="primary"
            onClick={() => window.print()}
          >
            Imprimer le relevé
          </button>
        </footer>
      </section>
    </div>
  );
}

/* =========================================================
   CREDITS
========================================================= */

function Credits({
  rows,
  repayments,
  name,
  role,
  open,
}) {
  const canAct =
    role === "Agent de crédit" ||
    role === "Administrateur";

  const monthLabel = (date) =>
    new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(date);

  const schedule = (credit) => {
    const payments = repayments
      .filter(
        (repayment) =>
          repayment.creditId ===
          credit.id
      )
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      );

    return Array.from(
      { length: credit.duration },
      (_, index) => {
        const date = new Date(
          credit.issuedAt
        );

        date.setMonth(
          date.getMonth() + index
        );

        const remainingBefore =
          Math.max(
            0,
            credit.totalToPay -
              index *
                credit.monthlyPayment
          );

        return {
          date,
          payment: payments[index],
          amount: Math.min(
            credit.monthlyPayment,
            remainingBefore
          ),
        };
      }
    );
  };

  return (
    <section className="panel full">
      <Head
        title="Gestion des crédits"
        sub="Échéancier mensuel et remboursements"
      >
        {canAct && (
          <span className="actions">
            <button
              className="secondary"
              onClick={() =>
                open("payment")
              }
            >
              Remboursement
            </button>

            <button
              className="primary"
              onClick={() =>
                open("credit")
              }
            >
              Nouveau crédit
            </button>
          </span>
        )}
      </Head>

      <table>
        <thead>
          <tr>
            <th>Bénéficiaire</th>
            <th>Montant + intérêts</th>
            <th>Mensualité</th>
            <th>Durée</th>
            <th>Reste à payer</th>
            <th>État</th>
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((credit) => {
              const due = Math.max(
                0,
                credit.totalToPay -
                  credit.paid
              );

              const finished =
                due <= 0;

              const months =
                schedule(credit);

              const paidMonths =
                months.filter(
                  (month) =>
                    month.payment
                ).length;

              return (
                <tr key={credit.id}>
                  <td>
                    <b>
                      {name(
                        credit.clientId
                      )}
                    </b>

                    <small>
                      Accordé le{" "}
                      {formatDate(
                        credit.issuedAt
                      )}
                    </small>

                    <details>
                      <summary>
                        Voir les{" "}
                        {credit.duration}{" "}
                        mensualités
                      </summary>

                      <div className="credit-schedule">
                        {months.map(
                          (
                            month,
                            index
                          ) => (
                            <div
                              className={`schedule-month ${
                                month.payment
                                  ? "paid"
                                  : ""
                              }`}
                              key={`${credit.id}-${index}`}
                            >
                              <span>
                                {month.payment
                                  ? "✓"
                                  : "○"}
                              </span>

                              <b>
                                {index + 1}.{" "}
                                {monthLabel(
                                  month.date
                                )}
                              </b>

                              <strong>
                                {money(
                                  month.amount
                                )}
                              </strong>

                              {month.payment && (
                                <small>
                                  Payé le{" "}
                                  {formatDate(
                                    month
                                      .payment
                                      .date
                                  )}
                                </small>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </details>
                  </td>

                  <td className="amount">
                    {money(
                      credit.totalToPay
                    )}
                  </td>

                  <td className="amount">
                    {money(
                      credit.monthlyPayment
                    )}
                  </td>

                  <td>
                    {credit.duration}{" "}
                    mois
                  </td>

                  <td className="amount">
                    {money(due)}
                  </td>

                  <td>
                    <em
                      className={
                        finished
                          ? ""
                          : "warn"
                      }
                    >
                      {finished
                        ? "Payé à 100 %"
                        : `${paidMonths}/${credit.duration} mois`}
                    </em>
                  </td>
                </tr>
              );
            })
          ) : (
            <EmptyRow
              text="Aucun crédit enregistré."
              colSpan="6"
            />
          )}
        </tbody>
      </table>
    </section>
  );
}

/* =========================================================
   RAPPORTS
========================================================= */

function Reports({
  totals,
  rows,
  accounts,
  name,
  clients,
}) {
  const [dailyDate, setDailyDate] =
    useState("");

  const [from, setFrom] = useState(
    `${new Date().getFullYear()}-01-01`
  );

  const [to, setTo] = useState(today());

  const dateKey = (value) => {
    if (!value) return "";

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime()))
        return "";

      return [
        value.getFullYear(),
        String(
          value.getMonth() + 1
        ).padStart(2, "0"),
        String(
          value.getDate()
        ).padStart(2, "0"),
      ].join("-");
    }

    const stringValue =
      String(value);

    if (stringValue.includes("T")) {
      const date = new Date(
        stringValue
      );

      if (Number.isNaN(date.getTime()))
        return "";

      return [
        date.getFullYear(),
        String(
          date.getMonth() + 1
        ).padStart(2, "0"),
        String(
          date.getDate()
        ).padStart(2, "0"),
      ].join("-");
    }

    const match =
      stringValue.match(
        /^(\d{4}-\d{2}-\d{2})/
      );

    if (match) {
      return match[1];
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? ""
      : date.toISOString().slice(0, 10);
  };

  const reportFrom =
    dailyDate || from;

  const reportTo =
    dailyDate || to;

  const filteredRows = rows.filter(
    (row) => {
      const date = dateKey(row.date);

      return (
        date &&
        date >= reportFrom &&
        date <= reportTo
      );
    }
  );

  const periodTotals = {
    ...totals,

    deposits: filteredRows
      .filter(
        (item) =>
          item.type === "Dépôt"
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      ),

    withdrawals: filteredRows
      .filter(
        (item) =>
          item.type === "Retrait"
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      ),
  };

  const exportPdf = () => {
    downloadReportPdf({
      totals: periodTotals,
      rows: filteredRows,
      accounts,
      name,
      clients,
      from: reportFrom,
      to: reportTo,
    });
  };

  return (
    <section className="report">
      <div className="panel reporthead">
        <div>
          <p>RAPPORT JBK</p>

          <h2>
            {reportFrom === reportTo
              ? `Rapport journalier du ${formatDate(
                  reportFrom
                )}`
              : `Rapport du ${formatDate(
                  reportFrom
                )} au ${formatDate(
                  reportTo
                )}`}
          </h2>

          <small>
            Les opérations affichées
            correspondent uniquement à la
            date ou période sélectionnée
          </small>
        </div>

        <div className="actions">
          <button
            className="secondary"
            onClick={exportPdf}
          >
            Exporter en PDF
          </button>

          <button
            className="primary"
            onClick={() =>
              window.print()
            }
          >
            Imprimer le rapport
          </button>
        </div>
      </div>

      <div className="panel period-filter">
        <label>
          Rapport journalier

          <input
            type="date"
            value={dailyDate}
            onChange={(event) => {
              const date =
                event.target.value;

              setDailyDate(date);
              setFrom(date);
              setTo(date);
            }}
          />
        </label>

        <label>
          Du

          <input
            type="date"
            value={from}
            onChange={(event) => {
              setDailyDate("");
              setFrom(
                event.target.value
              );
            }}
          />
        </label>

        <label>
          Au

          <input
            type="date"
            value={to}
            onChange={(event) => {
              setDailyDate("");
              setTo(
                event.target.value
              );
            }}
          />
        </label>
      </div>

      <section className="metrics">
        <Metric
          t="Dépôts enregistrés"
          v={money(
            periodTotals.deposits
          )}
          c="green"
        />

        <Metric
          t="Retraits enregistrés"
          v={money(
            periodTotals.withdrawals
          )}
          c="orange"
        />

        <Metric
          t="Solde des comptes"
          v={money(
            periodTotals.balance
          )}
          c="blue"
        />

        <Metric
          t="Opérations"
          v={String(
            filteredRows.length
          )}
          c="red"
        />
      </section>

      <div className="panel">
        <Head
          title="Détail des opérations"
          sub="Journal des opérations sur la période sélectionnée"
        />

        {filteredRows.length ? (
          <Table
            rows={filteredRows}
            accounts={accounts}
            name={name}
          />
        ) : (
          <Empty text="Aucune opération à présenter." />
        )}
      </div>
    </section>
  );
}

/* =========================================================
   UTILISATEURS
========================================================= */

function Users({
  users,
  open,
}) {
  return (
    <section className="panel full">
      <Head
        title="Utilisateurs du système"
        sub="Accès, rôles et responsabilités"
      >
        <button
          className="primary"
          onClick={() =>
            open("user")
          }
        >
          Nouvel utilisateur
        </button>
      </Head>

      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Rôle</th>
            <th>Adresse e-mail</th>
            <th>État</th>
          </tr>
        </thead>

        <tbody>
          {users.length ? (
            users.map((user) => (
              <tr key={user.id}>
                <td>
                  <b>{user.name}</b>
                </td>

                <td>{user.role}</td>

                <td>{user.email}</td>

                <td>
                  <em>
                    {user.active
                      ? "Actif"
                      : "Inactif"}
                  </em>
                </td>
              </tr>
            ))
          ) : (
            <EmptyRow
              text="Aucun utilisateur enregistré."
              colSpan="4"
            />
          )}
        </tbody>
      </table>
    </section>
  );
}

/* =========================================================
   FORMULAIRES
========================================================= */

function Form({
  type,
  clients,
  accounts,
  credits,
  close,
  submit,
  error,
}) {
  const [form, setForm] = useState({
    type:
      type === "transaction"
        ? "Dépôt"
        : type === "account"
        ? "Epargne"
        : "Epargne",

    accountType: "Courant",

    clientId: "",
    accountId: "",

    targetClientId: "",
    targetId: "",

    creditId: "",

    rate: 8,
    duration: 12,

    role: "Caissier",
    password: "",

    withOverdraft: false,

    performedBy: "",
  });

  const clientAccounts =
    accounts.filter(
      (account) =>
        account.clientId ===
        Number(form.clientId)
    );

  const targetAccounts =
    accounts.filter(
      (account) =>
        account.clientId ===
        Number(form.targetClientId)
    );

  /*
   * Si les comptes sont chargés après
   * la sélection du client, on complète
   * automatiquement le compte.
   */
  useEffect(() => {
    if (type !== "transaction")
      return;

    if (
      form.clientId &&
      !form.accountId
    ) {
      const account =
        accounts.find(
          (item) =>
            item.clientId ===
            Number(form.clientId)
        );

      if (account) {
        setForm((previous) => ({
          ...previous,
          accountId: account.id,
        }));
      }
    }

    if (
      form.targetClientId &&
      !form.targetId
    ) {
      const account =
        accounts.find(
          (item) =>
            item.clientId ===
            Number(
              form.targetClientId
            )
        );

      if (account) {
        setForm((previous) => ({
          ...previous,
          targetId: account.id,
        }));
      }
    }
  }, [
    accounts,
    form.clientId,
    form.targetClientId,
    form.accountId,
    form.targetId,
    type,
  ]);

  /*
   * Pour le remboursement, sélectionner
   * automatiquement le premier crédit
   * encore actif.
   */
  useEffect(() => {
    if (type !== "payment")
      return;

    if (form.creditId) return;

    const firstCredit =
      credits.find(
        (credit) =>
          credit.paid <
          credit.totalToPay
      );

    if (firstCredit) {
      const remaining =
        firstCredit.totalToPay -
        firstCredit.paid;

      const amount = Math.min(
        firstCredit.monthlyPayment,
        remaining
      );

      setForm((previous) => ({
        ...previous,
        creditId: firstCredit.id,
        amount:
          amount > 0
            ? amount.toFixed(2)
            : "",
      }));
    }
  }, [credits, form.creditId, type]);

  const set = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }));
  };

  const selectClient =
    (key) => (event) => {
      const clientId =
        event.target.value;

      const matchingAccounts =
        accounts.filter(
          (account) =>
            account.clientId ===
            Number(clientId)
        );

      const accountKey =
        key === "clientId"
          ? "accountId"
          : "targetId";

      setForm((previous) => ({
        ...previous,
        [key]: clientId,
        [accountKey]:
          matchingAccounts[0]?.id || "",
      }));
    };

  const field = (
    label,
    key,
    kind = "text",
    required = false
  ) => (
    <label>
      {label}

      <input
        type={kind}
        value={form[key] ?? ""}
        onChange={set(key)}
        required={required}
      />
    </label>
  );

  const accountField = (
    label,
    key,
    availableAccounts
  ) => {
    const selected =
      availableAccounts.find(
        (account) =>
          account.id ===
          Number(form[key])
      );

    return (
      <label>
        {label}

        <input
          value={
            selected?.number || ""
          }
          readOnly
          required
          placeholder={
            selected
              ? ""
              : "Compte non disponible"
          }
        />
      </label>
    );
  };

  const select = (
    label,
    key,
    options
  ) => (
    <label>
      {label}

      <select
        value={form[key] ?? ""}
        onChange={set(key)}
      >
        {options.map((option) => (
          <option
            key={option[0]}
            value={option[0]}
          >
            {option[1]}
          </option>
        ))}
      </select>
    </label>
  );

  const title = {
    client: "Nouveau client",
    account: "Ouvrir un compte",
    transaction: "Nouvelle opération",
    credit: "Accorder un crédit",
    payment:
      "Enregistrer un remboursement",
    user: "Nouvel utilisateur",
  }[type];

  return (
    <div className="shade">
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault();
          submit(type, form);
        }}
      >
        <div className="modalhead">
          <h2>{title}</h2>

          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {error && (
          <p
            className="form-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="form">
          {/* CLIENT */}
          {type === "client" && (
            <>
              {field(
                "Nom complet",
                "name",
                "text",
                true
              )}

              {field(
                "Téléphone",
                "phone",
                "text",
                true
              )}

              {field(
                "E-mail",
                "email",
                "email"
              )}

              {field(
                "Adresse",
                "address",
                "text",
                true
              )}

              {select(
                "Compte à créer automatiquement",
                "accountType",
                [
                  [
                    "Courant",
                    "Compte courant",
                  ],
                  [
                    "Epargne",
                    "Compte épargne",
                  ],
                ]
              )}

              <p className="rule-note">
                Un compte sera créé
                automatiquement avec le
                client.
              </p>

              <p className="rule-note">
                Pour un compte épargne,
                le dépôt initial minimum
                est de 10 000 CDF.
              </p>
            </>
          )}

          {/* COMPTE */}
          {type === "account" && (
            <>
              {select(
                "Client",
                "clientId",
                [
                  [
                    "",
                    "Sélectionnez un client",
                  ],
                  ...clients.map(
                    (client) => [
                      client.id,
                      client.name,
                    ]
                  ),
                ]
              )}

              {select(
                "Type de compte",
                "type",
                [
                  [
                    "Epargne",
                    "Epargne",
                  ],
                  [
                    "Courant",
                    "Courant",
                  ],
                ]
              )}

              {field(
                "Dépôt initial (CDF)",
                "opening",
                "number",
                true
              )}

              {form.type ===
              "Epargne" ? (
                <p className="rule-note">
                  Dépôt initial et solde
                  minimum : 10 000 CDF.
                  Aucun découvert autorisé.
                </p>
              ) : (
                <>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={
                        form.withOverdraft
                      }
                      onChange={(event) =>
                        setForm(
                          (previous) => ({
                            ...previous,
                            withOverdraft:
                              event.target
                                .checked,
                          })
                        )
                      }
                    />

                    <span>
                      Activer le découvert
                      autorisé de 50 000
                      CDF
                    </span>
                  </label>

                  <p className="rule-note">
                    {form.withOverdraft
                      ? "Découvert activé : le solde peut descendre jusqu’à -50 000 CDF."
                      : "Aucun découvert : le solde du compte courant ne peut pas devenir négatif."}
                  </p>
                </>
              )}
            </>
          )}

          {/* TRANSACTION */}
          {type === "transaction" && (
            <>
              {select(
                "Type d'opération",
                "type",
                [
                  [
                    "Dépôt",
                    "Dépôt",
                  ],
                  [
                    "Retrait",
                    "Retrait",
                  ],
                  [
                    "Virement",
                    "Virement",
                  ],
                ]
              )}

              <label>
                Client concerné

                <select
                  value={
                    form.clientId
                  }
                  onChange={selectClient(
                    "clientId"
                  )}
                  required
                >
                  <option value="">
                    Sélectionnez un client
                  </option>

                  {clients.map(
                    (client) => (
                      <option
                        key={client.id}
                        value={client.id}
                      >
                        {client.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              {accountField(
                "Numéro de compte concerné",
                "accountId",
                clientAccounts
              )}

              {form.type ===
                "Virement" && (
                <>
                  <label>
                    Client bénéficiaire

                    <select
                      value={
                        form.targetClientId
                      }
                      onChange={selectClient(
                        "targetClientId"
                      )}
                      required
                    >
                      <option value="">
                        Sélectionnez un client
                      </option>

                      {clients.map(
                        (client) => (
                          <option
                            key={client.id}
                            value={client.id}
                          >
                            {client.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {accountField(
                    "Numéro de compte bénéficiaire",
                    "targetId",
                    targetAccounts
                  )}
                </>
              )}

              {field(
                "Montant (CDF)",
                "amount",
                "number",
                true
              )}

              {field(
                "Libellé",
                "label"
              )}

              {field(
                "Nom de la personne ayant effectué l'opération",
                "performedBy",
                "text",
                true
              )}
            </>
          )}

          {/* CREDIT */}
          {type === "credit" && (
            <>
              {select(
                "Client bénéficiaire",
                "clientId",
                [
                  [
                    "",
                    "Sélectionnez un client",
                  ],
                  ...clients.map(
                    (client) => [
                      client.id,
                      client.name,
                    ]
                  ),
                ]
              )}

              {field(
                "Montant accordé (CDF)",
                "amount",
                "number",
                true
              )}

              {field(
                "Taux d'intérêt (%)",
                "rate",
                "number",
                true
              )}

              {field(
                "Durée (mois)",
                "duration",
                "number",
                true
              )}
            </>
          )}

          {/* REMBOURSEMENT */}
          {type === "payment" && (
            <>
              <label>
                Crédit

                <select
                  value={
                    form.creditId
                  }
                  onChange={(event) => {
                    const credit =
                      credits.find(
                        (item) =>
                          item.id ===
                          Number(
                            event.target
                              .value
                          )
                      );

                    const remaining =
                      credit
                        ? Math.max(
                            0,
                            credit.totalToPay -
                              credit.paid
                          )
                        : 0;

                    const amount =
                      credit
                        ? Math.min(
                            credit.monthlyPayment,
                            remaining
                          )
                        : 0;

                    setForm(
                      (previous) => ({
                        ...previous,
                        creditId:
                          event.target
                            .value,
                        amount:
                          amount > 0
                            ? amount.toFixed(
                                2
                              )
                            : "",
                      })
                    );
                  }}
                  required
                >
                  <option value="">
                    Sélectionnez un crédit
                  </option>

                  {credits
                    .filter(
                      (credit) =>
                        credit.paid <
                        credit.totalToPay
                    )
                    .map((credit) => (
                      <option
                        key={credit.id}
                        value={credit.id}
                      >
                        {clients.find(
                          (client) =>
                            client.id ===
                            credit.clientId
                        )?.name ||
                          "Client"}{" "}
                        - mensualité{" "}
                        {money(
                          credit.monthlyPayment
                        )}
                      </option>
                    ))}
                </select>
              </label>

              {field(
                "Montant de la mensualité (CDF)",
                "amount",
                "number",
                true
              )}
            </>
          )}

          {/* UTILISATEUR */}
          {type === "user" && (
            <>
              {field(
                "Nom complet",
                "name",
                "text",
                true
              )}

              {field(
                "E-mail professionnel",
                "email",
                "email",
                true
              )}

              {field(
                "Mot de passe",
                "password",
                "password",
                true
              )}

              {select(
                "Rôle",
                "role",
                Object.keys(
                  roleAccess
                ).map((role) => [
                  role,
                  role,
                ])
              )}
            </>
          )}
        </div>

        <footer>
          <button
            type="button"
            className="secondary"
            onClick={close}
          >
            Annuler
          </button>

          <button
            type="submit"
            className="primary"
          >
            Enregistrer
          </button>
        </footer>
      </form>
    </div>
  );
}

/* =========================================================
   EXPORT PDF
========================================================= */

function downloadReportPdf({
  totals,
  rows,
  accounts,
  name,
  clients,
  from,
  to,
}) {
  const safe = (value) =>
    String(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/[^\x20-\x7E]/g, "")
      .replace(
        /([\\()])/g,
        "\\$1"
      );

  const rgb = (hex) => {
    const value = hex.replace(
      "#",
      ""
    );

    return [0, 2, 4]
      .map(
        (index) =>
          (
            parseInt(
              value.slice(
                index,
                index + 2
              ),
              16
            ) / 255
          ).toFixed(3)
      )
      .join(" ");
  };

  const text = (
    value,
    x,
    y,
    size = 8,
    font = "F1",
    color = "#0d2848"
  ) =>
    `BT
/${font} ${size} Tf
${rgb(color)} rg
1 0 0 1 ${x} ${y} Tm
(${safe(value)}) Tj
ET`;

  const rect = (
    x,
    y,
    width,
    height,
    color,
    stroke = false
  ) =>
    `${rgb(color)} ${
      stroke ? "RG" : "rg"
    }
${x} ${y} ${width} ${height} re
${stroke ? "S" : "f"}`;

  const line = (
    x1,
    y1,
    x2,
    y2,
    color = "#dce5ed",
    width = 0.5
  ) =>
    `${width} w
${rgb(color)} RG
${x1} ${y1} m
${x2} ${y2} l
S`;

  const fit = (
    value,
    limit
  ) => {
    const string =
      String(value || "-");

    return string.length > limit
      ? `${string.slice(
          0,
          Math.max(
            1,
            limit - 3
          )
        )}...`
      : string;
  };

  const commands = [];

  const add = (value) =>
    commands.push(value);

  const pageWidth = 595;
  const pageHeight = 842;

  const left = 43;
  const right = 552;

  const timestamp =
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    )
      .format(new Date())
      .replace(",", "");

  add(
    text(
      timestamp,
      left,
      821,
      6,
      "F1",
      "#0d2848"
    )
  );

  add(
    text(
      "JBK Microfinance",
      302,
      821,
      6,
      "F2",
      "#8d2d2d"
    )
  );

  add(
    text(
      "RAPPORT JOURNALIER JBK",
      61,
      790,
      7,
      "F2"
    )
  );

  add(
    text(
      from === to
        ? `Rapport journalier du ${formatDate(
            from
          )}`
        : `Rapport du ${formatDate(
            from
          )} au ${formatDate(to)}`,
      61,
      774,
      13,
      "F2"
    )
  );

  add(
    text(
      "JBK Microfinance",
      61,
      757,
      7,
      "F1"
    )
  );

  const cards = [
    [
      "Depots enregistres",
      money(totals.deposits),
      "#12a895",
    ],
    [
      "Retraits enregistres",
      money(totals.withdrawals),
      "#e9861a",
    ],
    [
      "Solde des comptes",
      money(totals.balance),
      "#2878e8",
    ],
    [
      "Nombre de clients",
      String(clients.length),
      "#ed4055",
    ],
  ];

  cards.forEach(
    ([label, value, color], index) => {
      const y = 696 - index * 99;

      add(
        rect(
          left,
          y,
          509,
          84,
          "#ffffff"
        )
      );

      add(
        `1 w
${rgb(color)} RG
${left} ${y} 509 84 re
S`
      );

      add(
        text(
          label,
          55,
          y + 61,
          7,
          "F1",
          "#35516f"
        )
      );

      add(
        text(
          value,
          55,
          y + 39,
          12,
          "F2",
          "#092849"
        )
      );

      add(
        text(
          "Mis a jour aujourd'hui",
          55,
          y + 18,
          6,
          "F1",
          "#678099"
        )
      );
    }
  );

  add(
    text(
      "Detail des operations",
      61,
      351,
      10,
      "F2"
    )
  );

  add(
    text(
      "Journal des operations",
      61,
      339,
      6,
      "F1",
      "#678099"
    )
  );

  const columns = [
    ["OPERATION", 55],
    ["COMPTE", 147],
    ["CLIENT", 236],
    ["DATE", 330],
    ["MONTANT", 417],
    ["EFFECTUE PAR", 465],
    ["AGENT", 530],
  ];

  columns.forEach(
    ([label, x]) =>
      add(
        text(
          label,
          x,
          304,
          5.5,
          "F2",
          "#183856"
        )
      )
  );

  add(
    line(
      left,
      292,
      right,
      292,
      "#cbd8e4",
      0.55
    )
  );

  const printedRows =
    rows.slice(0, 8);

  if (!printedRows.length) {
    add(
      text(
        "Aucune operation a presenter.",
        61,
        265,
        8,
        "F1",
        "#678099"
      )
    );
  }

  printedRows.forEach(
    (item, index) => {
      const account =
        accounts.find(
          (value) =>
            value.id ===
            item.accountId
        );

      const y =
        267 - index * 41;

      const isWithdrawal =
        item.type === "Retrait";

      add(
        text(
          fit(item.type, 15),
          55,
          y,
          6.4,
          "F2"
        )
      );

      add(
        text(
          fit(
            item.label ||
              "Operation au guichet",
            23
          ),
          55,
          y - 10,
          5.3,
          "F1",
          "#58718a"
        )
      );

      add(
        text(
          fit(
            account?.number || "-",
            17
          ),
          147,
          y - 2,
          6,
          "F1",
          "#35516f"
        )
      );

      add(
        text(
          fit(
            name(account?.clientId),
            17
          ),
          236,
          y - 2,
          6,
          "F1",
          "#35516f"
        )
      );

      add(
        text(
          fit(
            formatDate(item.date),
            15
          ),
          330,
          y - 2,
          6,
          "F1",
          "#35516f"
        )
      );

      add(
        text(
          `${isWithdrawal ? "-" : "+"}${money(
            item.amount
          )}`,
          417,
          y - 2,
          6.2,
          "F2",
          isWithdrawal
            ? "#8d2020"
            : "#087c6d"
        )
      );

      add(
        text(
          fit(
            item.performedBy ||
              "-",
            10
          ),
          465,
          y - 2,
          5.2,
          "F1",
          "#35516f"
        )
      );

      add(
        text(
          fit(
            item.user || "-",
            9
          ),
          530,
          y - 2,
          5.2,
          "F1",
          "#35516f"
        )
      );

      add(
        line(
          left,
          y - 19,
          right,
          y - 19,
          "#dfe7ee",
          0.45
        )
      );
    }
  );

  add(
    text(
      "JBK Microfinance",
      left,
      12,
      5.5,
      "F2",
      "#0d2848"
    )
  );

  add(
    text(
      "1/1",
      544,
      12,
      5.5,
      "F2",
      "#0d2848"
    )
  );

  const stream =
    commands.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",

    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",

    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,

    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",

    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",

    `<< /Length ${stream.length} >>
stream
${stream}
endstream`,
  ];

  let pdf = "%PDF-1.4\n";

  const offsets = [0];

  objects.forEach(
    (object, index) => {
      offsets.push(pdf.length);

      pdf += `${index + 1} 0 obj
${object}
endobj
`;
    }
  );

  const xref = pdf.length;

  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets
  .slice(1)
  .map(
    (offset) =>
      `${String(offset).padStart(
        10,
        "0"
      )} 00000 n \n`
  )
  .join("")}trailer
<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>
startxref
${xref}
%%EOF`;

  const url =
    URL.createObjectURL(
      new Blob([pdf], {
        type: "application/pdf",
      })
    );

  const link =
    document.createElement("a");

  link.href = url;

  link.download = `rapport-jbk-${today()}.pdf`;

  link.click();

  URL.revokeObjectURL(url);
}