"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  Layers3,
  Globe,
  LogOut,
  FileText,
  Menu,
  X,
} from "lucide-react";


type UserRole = "ADMIN" | "ANALISTA" | "PUBLICO";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);

  const isActive = (route: string) => pathname === route;

  async function handleLogout() {
    try {
      await fetch("http://localhost:8000/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      // si falla igual lo sacamos
    } finally {
      router.replace("/login");
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  useEffect(() => {
    async function loadMe() {
      try {
        const { data } = await api.get<{ id: number; name: string; email: string; role: UserRole }>(
          "/v1/auth/me"
        );
        setRole(data.role);
      } catch {
        // si falla, lo mandamos al login
        router.replace("/login");
      }
    }
    loadMe();
  }, [router]);


  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col">
      {/* Top bar SOLO móvil */}
      <header className="fixed top-0 left-0 right-0 z-[2000] flex items-center justify-between bg-[#0E1F36] text-white px-4 py-3 shadow lg:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/ceipa-logo.png"
            alt="CEIPA"
            width={120}
            height={32}
            priority
          />
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex items-center justify-center rounded-lg p-1 hover:bg-white/10"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed top-14 bottom-0 left-0 right-0 z-[2500] bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}



      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-14 bottom-0 lg:top-0 z-[2600] w-64 bg-[#0E1F36] text-white
          transform transition-transform duration-200 ease-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >


        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/ceipa-logo.png"
              alt="CEIPA"
              width={140}
              height={40}
              priority
            />
          </div>
          {/* Botón cerrar SOLO móvil */}
          <button
            type="button"
            onClick={closeSidebar}
            className="lg:hidden inline-flex items-center justify-center rounded-lg p-1 hover:bg-white/10"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-2">
          {/* Siempre visible */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
              isActive("/dashboard")
                ? "bg-white text-[#0E1F36]"
                : "hover:bg-white/10"
            }`}
            onClick={closeSidebar}
          >
            <Home size={18} />
            <span>Dashboard</span>
          </Link>

          {/* Solo ADMIN puede ver Usuarios */}
          {role === "ADMIN" && (
            <Link
              href="/dashboard/usuarios"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                isActive("/dashboard/usuarios")
                  ? "bg-white text-[#0E1F36]"
                  : "hover:bg-white/10"
              }`}
              onClick={closeSidebar}
            >
              <Users size={18} />
              <span>Usuarios</span>
            </Link>
          )}

          {/* Escenarios: ADMIN y ANALISTA (y si quieres también PUBLICO con solo lectura, depende) */}
          <Link
            href="/dashboard/escenarios"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
              isActive("/dashboard/escenarios")
                ? "bg-white text-[#0E1F36]"
                : "hover:bg-white/10"
            }`}
            onClick={closeSidebar}
          >
            <Layers3 size={18} />
            <span>Escenarios</span>
          </Link>

          <Link
            href="/dashboard/entornos"
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
              isActive("/dashboard/entornos")
                ? "bg-white text-[#0E1F36]"
                : "hover:bg-white/10"
            }`}
            onClick={closeSidebar}
          >
            <Globe size={18} />
            <span>Entornos</span>
          </Link>

          {/* Solo ADMIN puede ver/editar descripciones */}
          {role === "ADMIN" && (
            <Link
              href="/dashboard/descripciones"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                isActive("/dashboard/descripciones")
                  ? "bg-white text-[#0E1F36]"
                  : "hover:bg-white/10"
              }`}
              onClick={closeSidebar}
            >
              <FileText size={18} />
              <span>Descripciones</span>
            </Link>
          )}
        </nav>


        <div className="absolute bottom-4 left-0 w-full px-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 hover:bg-white/15 transition"
            title="Cerrar sesión"
          >
            <LogOut size={18} /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 pt-14 lg:pt-0 lg:pl-64">{children}</div>
    </div>
  );
}
