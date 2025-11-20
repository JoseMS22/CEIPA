"use client";

import { useEffect,useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import Cookies from "js-cookie";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) router.replace(next);
  }, []);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.set("username", email.trim().toLowerCase());
      form.set("password", pass);
      await api.post("/v1/auth/login", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      router.replace(next);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-b from-[#0E1F36] via-[#0E1F36] to-[#1E3356]">
      {/* 🔹 Logo esquineado */}
      <div className="absolute top-3 sm:top-2 md:top-1 left-8 flex items-center gap-2">
        <Image
          src="/ceipa-logo.png"
          alt="CEIPA"
          width={160}
          height={48}
          className="h-auto w-auto"
          onErrorCapture={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      {/* 🔹 Contenido centrado vertical y horizontal */}
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          {/* 🔹 Título centrado */}
          <h1 className="mb-8 text-center text-2xl font-bold text-[#1E3356]">
            Acceso Administrador
          </h1>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Correo</label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingrese su correo"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-300"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-300"
              />
            </div>

            

            {err && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1E3356] px-4 py-2 text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
