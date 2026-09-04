# Microfinance app

Application de gestion microfinance avec front React/Vite et API Node.js/MySQL.

## Configuration locale

1. Installer les dépendances du frontend :
   npm install
2. Installer les dépendances du backend :
   cd microfinance-backend && npm install
3. Copier les fichiers d'exemple d'environnement :
   - .env.example -> .env
   - microfinance-backend/.env.example -> microfinance-backend/.env
4. Lancer le backend :
   cd microfinance-backend && npm start
5. Lancer le frontend :
   npm run dev

## Hébergement sur Railway

### Backend

- Connecter le dépôt GitHub.
- Créer un service Railway à partir du dossier `microfinance-backend`.
- Ajouter les variables d'environnement :
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `JWT_SECRET`
  - `CLIENT_URL`
  - `PORT`
- Choisir la base MySQL sur Railway et connecter la base au service backend.
- Déployer avec le script `npm start`.

### Frontend

- Créer un second service Railway à partir du dépôt racine.
- Définir la variable d'environnement :
  - `VITE_API_URL` = URL publique du backend Railway
- Le build se fait avec `npm run build` et le service écoute le port fourni par Railway via le script Vite preview.

## Variables d'environnement

Le projet utilise les fichiers suivants :
- `.env.example`
- `microfinance-backend/.env.example`

Ne jamais commiter les fichiers `.env` réels avec les vraies identifiants de production.


This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
