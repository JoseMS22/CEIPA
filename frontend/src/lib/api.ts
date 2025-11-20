import axios from "axios";

// 🔹 Axios instancia global
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true, // necesario para enviar/recibir cookies HttpOnly
});

// ✅ Interceptor de respuesta (maneja 401 / 403 globalmente)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Si no hay respuesta del servidor (por ej. backend caído)
    if (!error.response) {
      console.error("❌ Error de conexión con el servidor:", error.message);
      return Promise.reject(error);
    }

    // ⚠️ Si el backend devuelve 401 → sesión expirada o no autenticada
    if (status === 401) {
      console.warn("Sesión expirada o no autenticada (401).");

      // Limpia cookies locales si aplica
      if (typeof document !== "undefined") {
        document.cookie = "token=; Max-Age=0; path=/;";
      }

      // Redirige al login, conservando la ruta actual para volver luego
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?next=${next}`;
      }
    }

    // 🚫 Si el backend devuelve 403 → usuario autenticado pero sin permisos
    if (status === 403) {
      console.warn("Acceso denegado (403): sin permisos suficientes.");
    }

    return Promise.reject(error);
  }
);
