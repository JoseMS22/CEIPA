"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Search, Pencil, Trash2 } from "lucide-react";

type Scenario = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  created_at?: string;
};

type PaginatedScenarios = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: Scenario[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ANALISTA" | "PUBLICO";
};

export default function EscenariosPage() {
  const [escenarios, setEscenarios] = useState<Scenario[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // rol actual
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const isAdmin = currentRole === "ADMIN";
  const isAnalyst = currentRole === "ANALISTA";

  // modal crear
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [active, setActive] = useState(false); // solo importa para ADMIN
  const [error, setError] = useState<string | null>(null);

  // modal editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  // modal eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // búsqueda
  const [search, setSearch] = useState("");

  // helper para extraer mensaje de error del backend
  function extractErrorMessage(err: any, fallback: string): string {
    const detail = err?.response?.data?.detail;

    if (Array.isArray(detail)) {
      // FastAPI 422 (lista de errores de validación)
      return detail
        .map((d: any) => d?.msg || JSON.stringify(d))
        .join(" | ");
    }

    if (typeof detail === "string") {
      return detail;
    }

    return fallback;
  }

  async function loadEscenarios() {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedScenarios>("/v1/scenarios", {
        params: { page: 1, limit: 50 },
      });
      setEscenarios(data.items || []);
      setTotal(data.total || data.items?.length || 0);
    } catch (err) {
      console.error("Error cargando escenarios", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const { data } = await api.get<CurrentUser>("/v1/auth/me");
      setCurrentRole(data.role);
    } catch (err) {
      console.error("Error cargando usuario actual", err);
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadEscenarios(), loadCurrentUser()]);
    })();
  }, []);

  async function createScenario(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedDesc = desc.trim();

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }

    try {
      const payload: any = {
        name: trimmedName,
        description: trimmedDesc || null,
      };

      // Solo ADMIN puede decidir si es activo. ANALISTA siempre crea inactivo.
      if (isAdmin) {
        payload.active = active;
      } else {
        payload.active = false;
      }

      await api.post("/v1/scenarios", payload);

      setOpenNew(false);
      setName("");
      setDesc("");
      setActive(false); // después de crear, dejamos el checkbox desmarcado

      await loadEscenarios();
    } catch (err: any) {
      console.error("Error creando escenario", err?.response?.data ?? err);
      const msg = extractErrorMessage(err, "Error al crear escenario");
      setError(msg);
    }
  }

  function openEditModal(s: Scenario) {
    setEditId(s.id);
    setEditName(s.name);
    setEditDesc(s.description || "");
    setEditActive(s.active);
    setErrorEdit(null);
    setOpenEdit(true);
  }

  async function updateScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setErrorEdit(null);

    const trimmedName = editName.trim();
    const trimmedDesc = editDesc.trim();

    if (!trimmedName) {
      setErrorEdit("El nombre es obligatorio.");
      return;
    }

    try {
      const payload: any = {
        name: trimmedName,
        description: trimmedDesc || null,
      };

      // Solo ADMIN puede cambiar el campo active.
      if (isAdmin) {
        payload.active = editActive;
      }

      await api.patch(`/v1/scenarios/${editId}`, payload);
      setOpenEdit(false);
      await loadEscenarios();
    } catch (err: any) {
      console.error("Error actualizando escenario", err?.response?.data ?? err);
      const msg = extractErrorMessage(err, "Error al actualizar escenario");
      setErrorEdit(msg);
    }
  }

  function openDeleteModal(s: Scenario) {
    setDeleteId(s.id);
    setDeleteName(s.name);
    setDeleteError(null);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/v1/scenarios/${deleteId}`);
      setOpenDelete(false);
      setDeleteId(null);
      setDeleteName("");
      setDeleteError(null);
      await loadEscenarios();
    } catch (err: any) {
      console.error("Error eliminando escenario", err?.response?.data ?? err);
      const msg = extractErrorMessage(
        err,
        "No se pudo eliminar el escenario. Verifique que no sea el escenario activo."
      );
      setDeleteError(msg);
    }
  }

  // filtrar
  const filtered = escenarios.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.description || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 h-16 flex items-center justify-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#0E1F36]">
            Escenarios
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
          {/* ANALISTA y ADMIN pueden crear; PUBLICO no debería llegar aquí en teoría */}
          <button
            onClick={() => setOpenNew(true)}
            className="self-end sm:self-auto rounded-full bg-[#26A143] px-4 sm:px-6 py-2 text-xs sm:text-sm text-white font-medium hover:brightness-110"
          >
            + Nuevo escenario
          </button>
        </div>

        {/* lista */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <p className="text-xs sm:text-sm text-zinc-500 col-span-full">
              Cargando...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-xs sm:text-sm text-zinc-500 col-span-full">
              No hay escenarios
            </p>
          ) : (
            filtered.map((esc) => {
              const isActiveScenario = esc.active;
              // para ANALISTA: no puede editar/eliminar el activo
              const canEditThis =
                !isAnalyst || (isAnalyst && !isActiveScenario);
              const canDeleteThis = canEditThis; // misma regla

              return (
                <div
                  key={esc.id}
                  className="rounded-2xl bg-[#0E1F36] text-white px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                        {esc.name}
                        {esc.active ? (
                          <span className="rounded-full bg-emerald-500/80 px-2 py-0.5 text-[10px] uppercase font-semibold">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-500/40 px-2 py-0.5 text-[10px] uppercase font-semibold">
                            Inactivo
                          </span>
                        )}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-white/70">
                        {esc.description || "Sin descripción"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      className="rounded-full bg-white/10 px-3 sm:px-4 py-1.5 text-[11px] sm:text-sm hover:bg:white/20"
                      onClick={() => {
                        window.location.href = `/dashboard/escenarios/${esc.id}`;
                      }}
                    >
                      Valores entornos
                    </button>
                    <button
                      className="rounded-full bg-white/10 px-3 sm:px-4 py-1.5 text-[11px] sm:text-sm hover:bg:white/20"
                      onClick={() => {
                        window.location.href = `/dashboard/escenarios/${esc.id}/valores`;
                      }}
                    >
                      Valores indicadores
                    </button>
                    <button
                      onClick={() => canEditThis && openEditModal(esc)}
                      disabled={!canEditThis}
                      className={`text-white/90 px-1.5 ${
                        canEditThis
                          ? "hover:text-white"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        canEditThis
                          ? "Editar"
                          : "No puedes editar el escenario activo"
                      }
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => canDeleteThis && openDeleteModal(esc)}
                      disabled={!canDeleteThis}
                      className={`text-white/90 px-1.5 ${
                        canDeleteThis
                          ? "hover:text-red-300"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        canDeleteThis
                          ? "Eliminar"
                          : "No puedes eliminar el escenario activo"
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-4 text-[11px] sm:text-xs text-zinc-500">
          Mostrando {filtered.length} de {total} escenarios
        </p>
      </main>

      {/* MODAL NUEVO */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nuevo escenario">
        <form onSubmit={createScenario} className="space-y-4">
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
              Descripción
            </label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ingrese su descripción"
            />
          </div>

          {/* Solo ADMIN puede marcar activo */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                id="esc-active"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label
                htmlFor="esc-active"
                className="text-xs sm:text-sm font-medium text-zinc-700"
              >
                Marcar como activo
              </label>
            </div>
          )}

          {error && (
            <p className="text-xs sm:text-sm text-red-600">{error}</p>
          )}
          <button className="w-full rounded-xl bg-[#0E1F36] py-2 text-sm text-white">
            Crear
          </button>
        </form>
      </Modal>

      {/* MODAL EDITAR */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Editar escenario"
      >
        <form onSubmit={updateScenario} className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ingrese el nombre"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Descripción
            </label>
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ingrese su descripción"
            />
          </div>

          {/* Solo ADMIN puede cambiar el activo */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                id="esc-edit-active"
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              <label
                htmlFor="esc-edit-active"
                className="text-xs sm:text-sm font-medium text-zinc-700"
              >
                Marcar como activo
              </label>
            </div>
          )}

          {errorEdit && (
            <p className="text-xs sm:text-sm text-red-600">{errorEdit}</p>
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
        title="Eliminar escenario"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-700">
            ¿Seguro que deseas eliminar el escenario{" "}
            <span className="font-semibold">{deleteName}</span>? Esta acción no
            se puede deshacer.
          </p>

          {deleteError && (
            <p className="text-xs sm:text-sm text-red-600">{deleteError}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpenDelete(false)}
              className="rounded-lg border px-4 py-1.5 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="rounded-lg bg-red-500 text-white px-4 py-1.5 text-xs sm:text-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
