import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000"
});

// Ajouter automatiquement le token JWT à chaque requête
api.interceptors.request.use(
  (config) => {

    const token = localStorage.getItem("jbk_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);

export default api;