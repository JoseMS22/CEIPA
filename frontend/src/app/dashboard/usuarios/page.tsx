// src/app/dashboard/usuarios/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Pencil, Trash2, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

type PaginatedUsers = {
  items: User[];
  total: number;
  page: number;
  limit: number;
};

const ROLES = ["ADMIN", "ANALISTA"];

// ✅ Valida que la contraseña cumpla:
// - mínimo 8 caracteres
// - al menos una minúscula
// - al menos una mayúscula
// - al menos un número
// - al menos un caracter especial
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra minúscula.";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un carácter especial.";
  }
  return null;
}



export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // búsqueda
  const [search, setSearch] = useState("");

  // ----- MODAL NUEVO -----
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [error, setError] = useState<string | null>(null);

  // ----- MODAL EDITAR -----
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMail, setEditMail] = useState("");
  const [editRole, setEditRole] = useState("ADMIN");
  const [editPass, setEditPass] = useState("");
  const [editPass2, setEditPass2] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // ----- MODAL ELIMINAR -----
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedUsers>("/v1/users/paged", {
        params: { page: 1, limit: 10 },
      });
      setUsuarios(data.items || []);
      setTotal(data.total || data.items?.length || 0);
    } catch (err) {
      console.error("Error cargando usuarios", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // ====== CREAR ======
  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pass !== pass2) {
      setError("Las contraseñas no coinciden");
      return;
    }

    const passwordError = validatePassword(pass);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      await api.post("/v1/users", {
        name,
        email: mail,
        password: pass,
        role,
      });

      setOpenNew(false);
      setName("");
      setMail("");
      setPass("");
      setPass2("");
      setRole("ADMIN");
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Error al crear usuario");
    }
  }

  // ====== EDITAR: abrir modal con datos ======
  function openEditModal(user: User) {
    setEditId(user.id);
    setEditName(user.name);
    setEditMail(user.email);
    setEditRole(user.role || "ADMIN");
    setEditPass("");
    setEditPass2("");
    setEditError(null);
    setOpenEdit(true);
  }

  // ====== EDITAR: enviar al backend ======
  async function updateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;

    setEditError(null);

    if (editPass || editPass2) {
      if (editPass !== editPass2) {
        setEditError("Las contraseñas no coinciden");
        return;
      }

      const passwordError = validatePassword(editPass);
      if (passwordError) {
        setEditError(passwordError);
        return;
      }
    }

    const payload: any = {
      name: editName,
      email: editMail,
      role: editRole,
    };

    if (editPass) {
      payload.password = editPass;
    }

    try {
      await api.patch(`/v1/users/${editId}`, payload);
      setOpenEdit(false);
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      setEditError(err?.response?.data?.detail || "Error al actualizar usuario");
    }
  }

  // ====== ELIMINAR: abrir modal confirm ======
  function openDeleteModal(user: User) {
    setDeleteId(user.id);
    setDeleteName(user.name);
    setOpenDelete(true);
  }

  // ====== ELIMINAR: confirmar ======
  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/v1/users/${deleteId}`);
      setOpenDelete(false);
      setDeleteId(null);
      setDeleteName("");
      await loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = usuarios.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 h-16 flex items-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#0E1F36]">
            Usuarios
          </h1>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 py-5 sm:py-6">
        {/* barra superior */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-2.5 text-zinc-400"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar"
              className="w-full rounded-full bg-white pl-9 pr-3 py-2 text-xs sm:text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setOpenNew(true)}
            className="self-end sm:self-auto rounded-full bg-[#26A143] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white font-medium hover:brightness-110"
          >
            + Nuevo usuario
          </button>
        </div>

        {/* tabla */}
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#0E1F36] text-white text-left">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Correo</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4 w-24 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-zinc-500"
                    >
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-zinc-500"
                    >
                      No hay usuarios
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={idx % 2 ? "bg-zinc-100/60" : ""}
                    >
                      <td className="py-3 px-4">{u.name}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4">{u.role || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-orange-500 hover:scale-105 transition"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => openDeleteModal(u)}
                            className="text-red-500 hover:scale-105 transition"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-[11px] sm:text-xs text-zinc-500">
            Mostrando {filtered.length} de {total} usuarios
          </div>
        </div>
      </main>

      {/* MODAL NUEVO */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nuevo usuario">
        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ingrese el nombre"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Correo
            </label>
            <input
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ingrese el correo"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Rol
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Contraseña
              </label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
                className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
                placeholder="Ingrese la contraseña"
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Confirmar
              </label>
              <input
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                required
                className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
                placeholder="Repita la contraseña"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs sm:text-sm text-red-600">{error}</p>
          )}

          <button className="w-full rounded-xl bg-[#0E1F36] py-2 text-sm text-white">
            Crear
          </button>
        </form>
      </Modal>

      {/* MODAL EDITAR */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar usuario">
        <form onSubmit={updateUser} className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Correo
            </label>
            <input
              type="email"
              value={editMail}
              onChange={(e) => setEditMail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Rol
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Nueva contraseña (opcional)
              </label>
              <input
                type="password"
                value={editPass}
                onChange={(e) => setEditPass(e.target.value)}
                className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Confirmar (si cambiaste)
              </label>
              <input
                type="password"
                value={editPass2}
                onChange={(e) => setEditPass2(e.target.value)}
                className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              />
            </div>
          </div>

          {editError && (
            <p className="text-xs sm:text-sm text-red-600">{editError}</p>
          )}

          <button className="w-full rounded-xl bg-[#0E1F36] py-2 text-sm text-white">
            Actualizar
          </button>
        </form>
      </Modal>

      {/* MODAL ELIMINAR */}
      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Eliminar usuario"
      >
        <p className="text-xs sm:text-sm text-zinc-700 mb-4">
          ¿Estás seguro de que deseas eliminar al usuario{" "}
          <span className="font-semibold">{deleteName}</span>? Esta acción no se
          puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setOpenDelete(false)}
            className="rounded-lg bg-zinc-200 px-4 py-2 text-xs sm:text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs sm:text-sm text-white"
          >
            Sí, eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
