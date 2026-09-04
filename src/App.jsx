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
  Gestionnaire: ["dashboard", "clients", "accounts", "transactions", "reports"],
  Caissier: ["dashboard", "clients", "accounts", "transactions"],
  Comptable: ["dashboard", "accounts", "transactions", "reports"],
  "Agent de crédit": ["dashboard", "clients", "credits"],
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
const money = (n) => `${new Intl.NumberFormat("fr-FR").format(n || 0)} CDF`;
const formatDate = (n) => {
  if (!n) return "-";

  const date = new Date(n);

  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};
const dayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const today = () => dayKey(new Date());

export default function App() {
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [credits, setCredits] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("jbk_token"));
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [formError, setFormError] = useState("");
  const [statementClientId, setStatementClientId] = useState(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const name = (id) =>
    clients.find((client) => client.id === Number(id))?.name ||
    "Client inconnu";
  const allowed = currentUser ? roleAccess[currentUser.role] : [];
  const totals = useMemo(
    () => ({
      balance: accounts.reduce((sum, account) => sum + account.balance, 0),
      deposits: transactions
        .filter((item) => item.type === "Dépôt")
        .reduce((sum, item) => sum + item.amount, 0),
      withdrawals: transactions
        .filter((item) => item.type === "Retrait")
        .reduce((sum, item) => sum + item.amount, 0),
      loans: credits.reduce(
        (sum, credit) =>
          sum + credit.amount * (1 + credit.rate / 100) - credit.paid,
        0,
      ),
    }),
    [accounts, transactions, credits],
  );
  const toast = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const open = (kind) => {
    setFormError("");
    setModal(kind);
  };
  const openStatement = (clientId) => {
    setFormError("");
    setStatementClientId(clientId);
    setModal("statement");
  };
  const showFormError = (message) => {
    setFormError(message);
    return null;
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
      console.log("CLIENTS DISPONIBLES :", clientsFormates);
      setClients(clientsFormates);
    } catch (err) {
      console.error(err);
    }
  }

  async function chargerComptes() {
    try {
      const res = await api.get("/comptes");

      const comptesFormates = res.data.map((compte) => ({
        id: compte.id_compte,
        number: compte.numero_compte,
        type: compte.type_compte,
        balance: Number(compte.solde),
        minBalance: Number(compte.solde_minimum),
        openedAt: compte.date_ouverture,
        status: compte.statut,
        clientId: compte.id_client,
      }));

      console.log("COMPTES DISPONIBLES :", comptesFormates);

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

        amount: Number(transaction.montant),
        date: transaction.date_operation,
        label: transaction.libelle,

        // Pour un dépôt, le compte concerné est destination
        // Pour un retrait/virement, le compte concerné est source
        accountId: transaction.compte_source ?? transaction.compte_destination,

        targetId: transaction.compte_destination,

        userId: transaction.id_utilisateur,

        user: transaction.nom_utilisateur,
      }));

      console.log("TRANSACTIONS DISPONIBLES :", transactionsFormatees);

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

      console.log("UTILISATEURS DISPONIBLES :", utilisateursFormates);

      setUsers(utilisateursFormates);
    } catch (err) {
      console.error("Erreur chargement utilisateurs :", err);
    }
  }
  async function chargerCredits() {
    try {
      const res = await api.get("/credits");

      const creditsFormates = res.data.map((credit) => ({
        id: credit.id_credit,
        clientId: credit.id_client,
        amount: Number(credit.montant),
        rate: Number(credit.taux),
        duration: Number(credit.duree),
        issuedAt: credit.date_octroi,
        paid: Number(credit.montant_rembourse_paye) || 0,
        totalToPay: Number(credit.montant_rembourse),
        monthlyPayment: Number(credit.echeance_mensuelle),
        status: credit.statut,
      }));

      console.log("CREDITS DISPONIBLES :", creditsFormates);

      setCredits(creditsFormates);
    } catch (err) {
      console.error("Erreur chargement crédits :", err);
    }
  }
  useEffect(() => {
    chargerClients();
    chargerComptes();
    chargerTransactions();
    chargerUtilisateurs();
    chargerCredits();
  }, []);
  const submit = async (kind, form) => {
    if (kind === "client") {
      const opening = Number(form.opening || 0);
      const normalizedName = String(form.name || "").trim().toLowerCase();
      const normalizedPhone = String(form.phone || "").trim();
      const normalizedEmail = String(form.email || "").trim().toLowerCase();

      if (form.type === "Epargne" && opening < 10000) {
        return showFormError("Le compte épargne exige un dépôt initial minimum de 10 000 CDF.");
      }

      const duplicateClient = clients.some((client) => {
        const sameName =
          client.name && String(client.name).trim().toLowerCase() === normalizedName;
        const samePhone =
          client.phone && String(client.phone).trim() === normalizedPhone;
        const sameEmail =
          client.email &&
          normalizedEmail &&
          String(client.email).trim().toLowerCase() === normalizedEmail;

        return sameName || samePhone || sameEmail;
      });

      if (duplicateClient) {
        return showFormError("Ces informations existent déjà pour un client.");
      }

      try {
        await api.post("/clients", {
          nom: form.name,
          telephone: form.phone,
          email: form.email,
          adresse: form.address,
          type_compte: form.type,
          depot_initial: opening,
        });

        await Promise.all([chargerClients(), chargerComptes()]);

        setModal(null);
        toast("Client et compte enregistrés avec succès.");
      } catch (err) {
        console.error(err);
        showFormError(err.response?.data?.message || "Erreur lors de l'enregistrement du client.");
      }

      return;
    }
    if (kind === "credit") {
      if (!clients.length) {
        return showFormError("Créez d’abord un client.");
      }

      if (!form.clientId) {
        return showFormError("Veuillez sélectionner un client.");
      }

      if (!form.amount || Number(form.amount) <= 0) {
        return showFormError("Le montant du crédit doit être supérieur à 0.");
      }

      if (form.rate === "" || Number(form.rate) < 0) {
        return showFormError("Le taux d'intérêt est invalide.");
      }

      if (!form.duration || Number(form.duration) <= 0) {
        return showFormError("La durée doit être supérieure à 0.");
      }

      try {
        await api.post("/credits", {
          montant: Number(form.amount),
          taux: Number(form.rate),
          duree: Number(form.duration),
          id_client: Number(form.clientId),
        });

        await chargerCredits();

        setModal(null);

        toast("Crédit accordé et enregistré avec succès.");
      } catch (err) {
        console.error("Erreur création crédit :", err);

        showFormError(
          err.response?.data?.message ||
            "Erreur lors de l'enregistrement du crédit.",
        );
      }

      return;
    }
    if (kind === "payment") {
      const amount = Number(form.amount);

      if (!amount || amount <= 0) {
        return showFormError("Saisissez un montant de remboursement valide.");
      }

      if (!form.creditId) {
        return showFormError("Veuillez sélectionner un crédit.");
      }

      if (amount > form.totalToPay) {
        return showFormError(
          "Le montant de remboursement ne doit pas excéder le montant restant.",
        );
      }
      try {
        await api.post("/remboursements", {
          montant: amount,
          id_credit: Number(form.creditId),
          id_utilisateur: Number(currentUser.id),
        });

        // Recharger les crédits depuis MySQL
        await chargerCredits();

        setModal(null);

        toast("Remboursement enregistré avec succès.");
      } catch (err) {
        console.error("Erreur remboursement :", err);

        showFormError(
          err.response?.data?.message ||
            "Erreur lors de l'enregistrement du remboursement.",
        );
      }

      return;
    }
    if (kind === "user") {
      if (!form.name || !form.email || !form.password || !form.role) {
        return showFormError("Veuillez remplir tous les champs.");
      }

      try {
        await api.post("/utilisateurs", {
          nom: form.name,
          email: form.email,
          mot_de_passe: form.password,
          role: form.role,
        });

        await chargerUtilisateurs();

        setModal(null);

        toast("Utilisateur créé avec succès.");
      } catch (err) {
        console.error("Erreur création utilisateur :", err);

        showFormError(
          err.response?.data?.message ||
            "Erreur lors de la création de l'utilisateur.",
        );
      }

      return;
    }
    if (kind === "transaction") {
      const amount = Number(form.amount);

      if (!amount || amount <= 0) {
        return showFormError("Veuillez saisir un montant valide.");
      }

      const source = accounts.find(
        (account) => account.id === Number(form.accountId),
      );

      const target = accounts.find(
        (account) => account.id === Number(form.targetId),
      );

      if (!source) {
        return showFormError("Veuillez sélectionner un compte.");
      }

      // Vérification du virement
      if (form.type === "Virement") {
        if (!target) {
          return showFormError("Veuillez sélectionner un compte bénéficiaire.");
        }

        if (target.id === source.id) {
          return showFormError(
            "Le compte bénéficiaire doit être différent du compte source.",
          );
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

          libelle: form.label || `${form.type} au guichet`,

          compte_source: form.type === "Dépôt" ? null : Number(form.accountId),

          compte_destination:
            form.type === "Dépôt" || form.type === "Virement"
              ? Number(form.type === "Dépôt" ? form.accountId : form.targetId)
              : null,

          id_utilisateur: currentUser.id,
        });

        // Recharger les comptes depuis MySQL
        await chargerComptes();

        // Recharger les transactions depuis MySQL
        await chargerTransactions();

        setModal(null);

        toast(`${form.type} enregistré avec succès.`);
      } catch (err) {
        console.error("Erreur transaction :", err);

        showFormError(err.response?.data?.message || "Erreur lors de l'opération.");
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
          localStorage.setItem("jbk_token", receivedToken);
          setView("dashboard");
        }}
      />
    );
  }
  const filteredNav = nav.filter(([id]) => allowed.includes(id));
  const filteredClients = clients.filter((client) =>
    `${client.name} ${client.phone}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredAccounts = accounts.filter((account) =>
    `${account.number} ${name(account.clientId)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
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
              className={view === id ? "active" : ""}
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
            <h1>{nav.find((item) => item[0] === view)?.[1]}</h1>
          </div>
          <span>{formatDate(today())}</span>
        </header>
        {notice && <div className="notice">{notice}</div>}
        {view === "dashboard" && (
          <Dashboard
            totals={totals}
            data={{ clients, accounts, transactions, credits, name }}
            role={currentUser.role}
            open={open}
          />
        )}{" "}
        {view === "clients" && (
          <Directory
            type="clients"
            rows={filteredClients}
            accounts={accounts}
            search={search}
            setSearch={setSearch}
            canCreate={currentUser.role !== "Comptable"}
            open={open}
            openStatement={openStatement}
          />
        )}{" "}
        {view === "accounts" && (
          <Directory
            type="accounts"
            rows={filteredAccounts}
            name={name}
            search={search}
            setSearch={setSearch}
            canCreate={
              currentUser.role === "Administrateur" ||
              currentUser.role === "Gestionnaire"
            }
            open={open}
          />
        )}{" "}
        {view === "transactions" && (
          <Transactions
            rows={transactions}
            accounts={accounts}
            name={name}
            canCreate={
              currentUser.role === "Administrateur" ||
              currentUser.role === "Caissier"
            }
            open={open}
          />
        )}{" "}
        {view === "credits" && (
          <Credits
            rows={credits}
            name={name}
            role={currentUser.role}
            open={open}
          />
        )}{" "}
        {view === "reports" && (
          <Reports
            totals={totals}
            rows={transactions}
            accounts={accounts}
            name={name}
            clients={clients}
          />
        )}{" "}
        {view === "users" && <Users users={users} open={open} />}
      </main>
      {modal === "statement" ? (
        <ClientStatement
          client={clients.find((client) => client.id === statementClientId)}
          accounts={accounts}
          transactions={transactions}
          close={() => setModal(null)}
        />
      ) : modal && (
        <Form
          type={modal}
          clients={clients}
          accounts={accounts}
          credits={credits}
          close={() => {
            setFormError("");
            setModal(null);
          }}
          submit={submit}
          error={formError}
        />
      )}
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Veuillez saisir votre email et votre mot de passe.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email: email.trim(),
        mot_de_passe: password,
      });

      const utilisateur = res.data.utilisateur;
      const token = res.data.token;

      const user = {
        id: utilisateur.id_utilisateur,
        name: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        active: Boolean(utilisateur.actif),
      };

      onLogin(user, token);
    } catch (err) {
      console.error("Erreur connexion :", err);

      setError(
        err.response?.data?.message || "Email ou mot de passe incorrect.",
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

        <p>Connectez-vous avec vos identifiants professionnels.</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <label>E-mail professionnel</label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="exemple@jbk.cd"
            required
            disabled={loading}
          />

          <label>Mot de passe</label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Votre mot de passe"
            required
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <small className="login-footer">
          JBK Microfinance — Accès sécurisé
        </small>
      </div>
    </div>
  );
}

function Dashboard({ totals, data, role, open }) {
  const actions = [];
  if (role === "Caissier" || role === "Administrateur")
    actions.push([
      "transaction",
      "Nouvelle opération",
      "Dépôt, retrait ou virement",
    ]);
  if (role === "Gestionnaire" || role === "Administrateur")
    actions.push(["client", "Ajouter un client", "Créer le client et son compte"]);
  if (role === "Agent de crédit" || role === "Administrateur")
    actions.push([
      "credit",
      "Accorder un crédit",
      "Enregistrer un financement",
    ]);
  return (
    <>
      <section className="quick">
        {actions.map((action) => (
          <button key={action[1]} onClick={() => open(action[0])}>
            <b>{action[1]}</b>
            <span>{action[2]}</span>
          </button>
        ))}
      </section>
      <section className="metrics">
        <Metric t="Encours d'épargne" v={money(totals.balance)} c="green" />
        <Metric t="Dépôts enregistrés" v={money(totals.deposits)} c="blue" />
        <Metric
          t="Retraits enregistrés"
          v={money(totals.withdrawals)}
          c="orange"
        />
        <Metric t="Crédits à recouvrer" v={money(totals.loans)} c="red" />
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
          <Head title="Portefeuille crédits" sub="Suivi des remboursements" />
          {data.credits.length ? (
            data.credits.map((credit) => {
              const total = credit.amount * (1 + credit.rate / 100),
                progress = Math.min(100, (credit.paid / total) * 100);
              return (
                <div className="loan" key={credit.id}>
                  <div>
                    <b>{data.name(credit.clientId)}</b>
                    <small>Reste {money(total - credit.paid)}</small>
                    <small>
                      Échéance mensuelle {money(credit.monthlyPayment || total / credit.duration)}
                    </small>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <span>{Math.round(progress)}%</span>
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
      <small>Mis à jour aujourd'hui</small>
    </div>
  );
}
function Head({ title, sub, children }) {
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
  return <div className="empty">{text}</div>;
}
function Directory({
  type,
  rows,
  accounts,
  name,
  search,
  setSearch,
  canCreate,
  open,
  openStatement,
}) {
  const isClients = type === "clients";
  return (
    <section className="panel full">
      <Head
        title={isClients ? "Répertoire clients" : "Comptes clients"}
        sub={
          isClients
            ? `${rows.length} client(s) affiché(s)`
            : "Soldes disponibles en temps réel"
        }
      >
        {isClients && canCreate && (
          <button
            className="primary"
            onClick={() => open(isClients ? "client" : "account")}
          >
            Nouveau client
          </button>
        )}
      </Head>
      <input
        className="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
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
                const clientAccounts = accounts.filter(
                  (account) => account.clientId === client.id,
                );
                return (
                  <tr key={client.id}>
                    <td>
                      <b>{client.name}</b>
                      <small>{client.address}</small>
                    </td>
                    <td>
                      {client.phone}
                      <small>{client.email}</small>
                    </td>
                    <td>{clientAccounts.length}</td>
                    <td className="amount">
                      {money(
                        clientAccounts.reduce(
                          (sum, account) => sum + account.balance,
                          0,
                        ),
                      )}
                    </td>
                    <td>
                      <em>Actif</em>
                    </td>
                    <td>
                      <button className="secondary" onClick={() => openStatement(client.id)}>
                        Imprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow text="Aucun client enregistré." colSpan="6" />
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
                  <td>{name(account.clientId)}</td>
                  <td>
                    <b>{account.type}</b>
                    <small>
                      {account.type === "Epargne" &&
                        `Solde minimum : ${money(account.minBalance ?? 10000)}`}
                    </small>
                  </td>
                  <td>{formatDate(account.openedAt)}</td>
                  <td className="amount">{money(account.balance)}</td>
                  <td>
                    <em>{account.status}</em>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow text="Aucun compte enregistré." colSpan="6" />
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
function EmptyRow({ text, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="empty">{text}</div>
      </td>
    </tr>
  );
}
function Transactions({ rows, accounts, name, canCreate, open }) {
  return (
    <section className="panel full">
      <Head
        title="Journal des opérations"
        sub="Historique sécurisé des mouvements financiers"
      >
        {canCreate && (
          <button className="primary" onClick={() => open("transaction")}>
            Nouvelle opération
          </button>
        )}
      </Head>
      {rows.length ? (
        <Table rows={rows} accounts={accounts} name={name} />
      ) : (
        <Empty text="Aucune opération enregistrée." />
      )}
    </section>
  );
}
function Table({ rows, accounts, name }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Opération</th>
          <th>Compte</th>
          <th>Client</th>
          <th>Date</th>
          <th>Montant</th>
          <th>Agent</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => {
          const account = accounts.find((value) => value.id === item.accountId);
          return (
            <tr key={item.id}>
              <td>
                <b>{item.type}</b>
                <small>{item.label}</small>
              </td>
              <td>{account?.number || "-"}</td>
              <td>{name(account?.clientId)}</td>
              <td>{formatDate(item.date)}</td>
              <td
                className={item.type === "Retrait" ? "amount minus" : "amount"}
              >
                {item.type === "Retrait" ? "-" : "+"}
                {money(item.amount)}
              </td>
              <td>{item.user || "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
function Credits({ rows, name, role, open }) {
  const canAct = role === "Agent de crédit" || role === "Administrateur";
  return (
    <section className="panel full">
      <Head
        title="Gestion des crédits"
        sub="Octrois, échéances et remboursements"
      >
        {canAct && (
          <span className="actions">
            <button className="secondary" onClick={() => open("payment")}>
              Remboursement
            </button>
            <button className="primary" onClick={() => open("credit")}>
              Nouveau crédit
            </button>
          </span>
        )}
      </Head>
      <table>
        <thead>
          <tr>
            <th>Bénéficiaire</th>
            <th>Montant accordé</th>
            <th>Taux</th>
            <th>Durée</th>
            <th>Échéance mensuelle</th>
            <th>Reste à payer</th>
            <th>État</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((credit) => {
              const due = credit.amount * (1 + credit.rate / 100) - credit.paid,
                finished = due <= 0;
              return (
                <tr key={credit.id}>
                  <td>
                    <b>{name(credit.clientId)}</b>
                    <small>Accordé le {formatDate(credit.issuedAt)}</small>
                  </td>
                  <td className="amount">{money(credit.amount)}</td>
                  <td>{credit.rate}%</td>
                  <td>{credit.duration} mois</td>
                  <td className="amount">
                    {money(credit.monthlyPayment || credit.totalToPay / credit.duration)}
                    <small>par mois</small>
                  </td>
                  <td className="amount">{money(Math.max(0, due))}</td>
                  <td>
                    <em className={finished ? "" : "warn"}>
                      {finished ? "Soldé" : "En cours"}
                    </em>
                  </td>
                </tr>
              );
            })
          ) : (
            <EmptyRow text="Aucun crédit enregistré." colSpan="7" />
          )}
        </tbody>
      </table>
    </section>
  );
}
function Reports({ rows, accounts, name }) {
  const [reportDate, setReportDate] = useState(today());
  const dayRows = rows.filter((item) => dayKey(item.date) === reportDate);
  const dayTotals = {
    deposits: dayRows.filter((item) => item.type === "Dépôt").reduce((sum, item) => sum + item.amount, 0),
    withdrawals: dayRows.filter((item) => item.type === "Retrait").reduce((sum, item) => sum + item.amount, 0),
  };
  dayTotals.net = dayTotals.deposits - dayTotals.withdrawals;
  dayTotals.operations = dayRows.length;
  const changeDate = (event) => {
    setReportDate(event.target.value);
  };
  const exportPdf = () => {
    downloadReportPdf({ totals: dayTotals, rows: dayRows, accounts, name, reportDate });
  };
  return (
    <section className="report">
      <div className="panel reporthead">
        <div>
          <p>RAPPORT JOURNALIER JBK</p>
          <h2>Situation au {formatDate(reportDate)}</h2>
          <small>JBK Microfinance</small>
        </div>
        <div className="actions">
          <input type="date" value={reportDate} max={today()} onChange={changeDate} aria-label="Date du rapport" />
          <button className="secondary" onClick={exportPdf}>
            Exporter en PDF
          </button>
          <button
            className="primary"
            onClick={() => window.print()}
          >
            Imprimer le rapport
          </button>
        </div>
      </div>
      <section className="metrics">
        <Metric t="Dépôts enregistrés" v={money(dayTotals.deposits)} c="green" />
        <Metric
          t="Retraits enregistrés"
          v={money(dayTotals.withdrawals)}
          c="orange"
        />
        <Metric t="Solde net du jour" v={money(dayTotals.net)} c="blue" />
        <Metric t="Opérations du jour" v={String(dayTotals.operations)} c="red" />
      </section>
      <div className="panel">
        <Head title="Détail des opérations" sub="Journal des opérations" />
        {dayRows.length ? (
          <Table rows={dayRows} accounts={accounts} name={name} />
        ) : (
          <Empty text="Aucune opération à présenter." />
        )}
      </div>
    </section>
  );
}
function Users({ users, open }) {
  return (
    <section className="panel full">
      <Head
        title="Utilisateurs du système"
        sub="Accès, rôles et responsabilités"
      >
        <button className="primary" onClick={() => open("user")}>
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
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <b>{user.name}</b>
              </td>
              <td>{user.role}</td>
              <td>{user.email}</td>
              <td>
                <em>{user.active ? "Actif" : "Inactif"}</em>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
function ClientStatement({ client, accounts, transactions, close }) {
  const clientAccounts = accounts.filter((account) => account.clientId === client?.id);
  const accountIds = new Set(clientAccounts.map((account) => account.id));
  const rows = transactions
    .filter((transaction) => accountIds.has(transaction.accountId) || accountIds.has(transaction.targetId))
    .sort((first, second) => new Date(first.date) - new Date(second.date));
  const totalDeposits = rows
    .filter((transaction) => transaction.type === "Dépôt" || (transaction.type === "Virement" && accountIds.has(transaction.targetId)))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalWithdrawals = rows
    .filter((transaction) => transaction.type === "Retrait" || (transaction.type === "Virement" && accountIds.has(transaction.accountId)))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const openingBalance = Number(clientAccounts[0]?.balance || 0) - totalDeposits + totalWithdrawals;

  return (
    <div className="shade">
      <section className="modal statement-print">
        <div className="modalhead no-print">
          <h2>Relevé client</h2>
          <button type="button" onClick={close} aria-label="Fermer">×</button>
        </div>
        <header className="statement-header">
          <p>JBK MICROFINANCE</p>
          <h2>Relevé de compte</h2>
          <b>{client?.name || "Client"}</b>
          <small>{clientAccounts[0]?.number || "Aucun compte"} · {clientAccounts[0]?.type || ""}</small>
          <small>
            Période : {rows.length ? `${formatDate(rows[0].date)} au ${formatDate(rows[rows.length - 1].date)}` : "Aucune opération"}
          </small>
        </header>
        <div className="statement-summary">
          <span><small>Total entrées</small><b>{money(totalDeposits)}</b></span>
          <span><small>Total sorties</small><b>{money(totalWithdrawals)}</b></span>
          <span><small>Solde actuel</small><b>{money(clientAccounts[0]?.balance)}</b></span>
        </div>
        <div className="statement-table">
          {rows.length ? (
            <table>
              <thead><tr><th>Date</th><th>Opération</th><th>Libellé</th><th>Entrée</th><th>Sortie</th><th>Solde</th></tr></thead>
              <tbody>{rows.map((transaction, index) => {
                const incoming = transaction.type === "Dépôt" || (transaction.type === "Virement" && accountIds.has(transaction.targetId));
                const runningBalance = rows.slice(0, index + 1).reduce((balance, item) => {
                  const isIncoming = item.type === "Dépôt" || (item.type === "Virement" && accountIds.has(item.targetId));
                  return balance + (isIncoming ? item.amount : -item.amount);
                }, openingBalance);
                return <tr key={transaction.id}><td>{formatDate(transaction.date)}</td><td>{transaction.type}</td><td>{transaction.label || "-"}</td><td className="amount">{incoming ? money(transaction.amount) : "-"}</td><td className="amount minus">{incoming ? "-" : money(transaction.amount)}</td><td className="amount">{money(runningBalance)}</td></tr>;
              })}</tbody>
            </table>
          ) : <Empty text="Aucune opération pour ce client." />}
        </div>
        <footer className="statement-actions no-print">
          <button type="button" className="secondary" onClick={close}>Fermer</button>
          <button type="button" className="primary" onClick={() => window.print()}>Imprimer le relevé</button>
        </footer>
      </section>
    </div>
  );
}
function Form({ type, clients, accounts, credits, close, submit, error }) {
  const [form, setForm] = useState({
    type: type === "transaction" ? "Dépôt" : "Epargne",
    clientId: "",
    accountId: "",
    targetClientId: "",
    targetId: "",
    creditId:
      credits.find(
        (credit) => credit.paid < credit.amount * (1 + credit.rate / 100),
      )?.id || "",
    rate: 8,
    duration: 12,
    role: "Caissier",
    password: "",
  });
  const clientAccounts = accounts.filter(
    (account) => account.clientId === Number(form.clientId),
  );
  const targetAccounts = accounts.filter(
    (account) => account.clientId === Number(form.targetClientId),
  );
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const field = (label, key, kind = "text", required = false) => (
    <label>
      {label}
      <input
        type={kind}
        value={form[key] || ""}
        onChange={set(key)}
        required={required}
      />
    </label>
  );
  const select = (label, key, options) => (
    <label>
      {label}
      <select value={form[key]} onChange={set(key)}>
        {options.map((option) => (
          <option key={option[0]} value={option[0]}>
            {option[1]}
          </option>
        ))}
      </select>
    </label>
  );
  const title = {
    client: "Nouveau client et compte",
    transaction: "Nouvelle opération",
    credit: "Accorder un crédit",
    payment: "Enregistrer un remboursement",
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
          <button type="button" onClick={close} aria-label="Fermer">
            ×
          </button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form">
          {type === "client" && (
            <>
              {field("Nom complet", "name", "text", true)}
              {field("Téléphone", "phone", "text", true)}
              {field("E-mail", "email", "email")}
              {field("Adresse", "address", "text", true)}
              {select("Type de compte", "type", [
                ["Epargne", "Epargne"],
                ["Courant", "Courant"],
              ])}
              {field("Dépôt initial (CDF)", "opening", "number", true)}
              <p className="rule-note">
                {form.type === "Epargne"
                  ? "Dépôt initial et solde minimum : 10 000 CDF."
                  : "Le solde du compte courant ne peut pas devenir négatif."}
              </p>
            </>
          )}
          {type === "transaction" && (
            <>
              {select("Type d'opération", "type", [
                ["Dépôt", "Dépôt"],
                ["Retrait", "Retrait"],
                ["Virement", "Virement"],
              ])}
              <label>
                Client concerné
                <select
                  value={form.clientId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      clientId: event.target.value,
                      accountId: "",
                    })
                  }
                >
                  <option value="">Sélectionnez un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              {select("Compte émetteur / concerné", "accountId", [
                ["", "Sélectionnez le compte"],
                ...clientAccounts.map((account) => [
                  account.id,
                  `${account.number} - ${money(account.balance)}`,
                ]),
              ])}
              {form.type === "Virement" && (
                <>
                  <label>
                    Client bénéficiaire
                    <select
                      value={form.targetClientId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          targetClientId: event.target.value,
                          targetId: "",
                        })
                      }
                    >
                      <option value="">Sélectionnez un client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {select("Compte bénéficiaire", "targetId", [
                    ["", "Sélectionnez le compte"],
                    ...targetAccounts.map((account) => [
                      account.id,
                      account.number,
                    ]),
                  ])}
                </>
              )}
              {field("Montant (CDF)", "amount", "number", true)}
              {field("Libellé", "label")}
            </>
          )}
          {type === "credit" && (
            <>
              {select("Client bénéficiaire", "clientId", [
                ["", "Sélectionnez un client"],
                ...clients.map((client) => [client.id, client.name]),
              ])}
              {field("Montant accordé (CDF)", "amount", "number", true)}
              {field("Taux d'intérêt (%)", "rate", "number", true)}
              {field("Durée (mois)", "duration", "number", true)}
            </>
          )}
          {type === "payment" && (
            <>
              {select(
                "Crédit",
                "creditId",
                credits
                  .filter(
                    (credit) =>
                      credit.paid < credit.amount * (1 + credit.rate / 100),
                  )
                  .map((credit) => [
                    credit.id,
                    `${clients.find((client) => client.id === credit.clientId)?.name || "Client"} - ${money(credit.amount)}`,
                  ]),
              )}
              {field("Montant remboursé (CDF)", "amount", "number", true)}
            </>
          )}
          {type === "user" && (
            <>
              {field("Nom complet", "name", "text", true)}

              {field("E-mail professionnel", "email", "email", true)}

              {field("Mot de passe", "password", "password", true)}

              {select(
                "Rôle",
                "role",
                Object.keys(roleAccess).map((role) => [role, role]),
              )}
            </>
          )}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={close}>
            Annuler
          </button>
          <button className="primary">Enregistrer</button>
        </footer>
      </form>
    </div>
  );
}
function useStored(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  });
  useEffect(
    () => localStorage.setItem(key, JSON.stringify(value)),
    [key, value],
  );
  return [value, setValue];
}
function downloadReportPdf({ totals, rows, accounts, name, reportDate }) {
  const safe = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/([\\()])/g, "\\$1");
  const rgb = (hex) => {
    const value = hex.replace("#", "");
    return [0, 2, 4]
      .map((index) =>
        (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3),
      )
      .join(" ");
  };
  const text = (value, x, y, size = 8, font = "F1", color = "#0d2848") =>
    `BT\n/${font} ${size} Tf\n${rgb(color)} rg\n1 0 0 1 ${x} ${y} Tm\n(${safe(value)}) Tj\nET`;
  const rect = (x, y, width, height, color, stroke = false) =>
    `${rgb(color)} ${stroke ? "RG" : "rg"}\n${x} ${y} ${width} ${height} re\n${stroke ? "S" : "f"}`;
  const line = (x1, y1, x2, y2, color = "#dce5ed", width = 0.5) =>
    `${width} w\n${rgb(color)} RG\n${x1} ${y1} m\n${x2} ${y2} l\nS`;
  const fit = (value, limit) => {
    const string = String(value || "-");
    return string.length > limit
      ? `${string.slice(0, Math.max(1, limit - 3))}...`
      : string;
  };
  const commands = [];
  const add = (value) => commands.push(value);
  const pageWidth = 595,
    pageHeight = 842,
    left = 43,
    right = 552;
  const timestamp = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(",", "");

  // En-tete du rapport
  add(text(timestamp, left, 821, 6, "F1", "#0d2848"));
  add(text("gestion-micro", 302, 821, 6, "F2", "#8d2d2d"));
  add(text("RAPPORT JOURNALIER JBK", 61, 790, 7, "F2"));
  add(text(`Situation au ${formatDate(reportDate)}`, 61, 774, 13, "F2"));
  add(text("JBK Microfinance", 61, 757, 7, "F1"));

  const cards = [
    ["Depots enregistres", money(totals.deposits), "#12a895"],
    ["Retraits enregistres", money(totals.withdrawals), "#e9861a"],
    ["Solde net du jour", money(totals.net), "#2878e8"],
    ["Operations du jour", String(totals.operations), "#ed4055"],
  ];
  cards.forEach(([label, value, color], index) => {
    const y = 696 - index * 99;
    add(rect(left, y, 509, 84, "#ffffff"));
    add(`1 w\n${rgb(color)} RG\n${left} ${y} 509 84 re\nS`);
    add(text(label, 55, y + 61, 7, "F1", "#35516f"));
    add(text(value, 55, y + 39, 12, "F2", "#092849"));
    add(text("Rapport du jour selectionne", 55, y + 18, 6, "F1", "#678099"));
  });

  add(text("Detail des operations", 61, 351, 10, "F2"));
  add(text("Journal des operations", 61, 339, 6, "F1", "#678099"));
  const columns = [
    ["OPERATION", 55],
    ["COMPTE", 147],
    ["CLIENT", 236],
    ["DATE", 330],
    ["MONTANT", 417],
    ["AGENT", 500],
  ];
  columns.forEach(([label, x]) =>
    add(text(label, x, 304, 5.5, "F2", "#183856")),
  );
  add(line(left, 292, right, 292, "#cbd8e4", 0.55));
  const printedRows = rows.slice(0, 8);
  if (!printedRows.length)
    add(text("Aucune operation a presenter.", 61, 265, 8, "F1", "#678099"));
  printedRows.forEach((item, index) => {
    const account = accounts.find((value) => value.id === item.accountId);
    const y = 267 - index * 41;
    const isWithdrawal = item.type === "Retrait";
    add(text(fit(item.type, 15), 55, y, 6.4, "F2"));
    add(
      text(
        fit(item.label || "Operation au guichet", 23),
        55,
        y - 10,
        5.3,
        "F1",
        "#58718a",
      ),
    );
    add(text(fit(account?.number || "-", 17), 147, y - 2, 6, "F1", "#35516f"));
    add(text(fit(name(account?.clientId), 17), 236, y - 2, 6, "F1", "#35516f"));
    add(text(fit(formatDate(item.date), 15), 330, y - 2, 6, "F1", "#35516f"));
    add(
      text(
        `${isWithdrawal ? "-" : "+"}${money(item.amount)}`,
        417,
        y - 2,
        6.2,
        "F2",
        isWithdrawal ? "#8d2020" : "#087c6d",
      ),
    );
    add(text(fit(item.user || "-", 14), 500, y - 2, 5.7, "F1", "#35516f"));
    add(line(left, y - 19, right, y - 19, "#dfe7ee", 0.45));
  });
  add(text("localhost:5173", left, 12, 5.5, "F2", "#0d2848"));
  add(text("1/1", 544, 12, 5.5, "F2", "#0d2848"));
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapport-jbk-${today()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
