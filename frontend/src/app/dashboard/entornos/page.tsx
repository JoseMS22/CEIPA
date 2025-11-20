"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Search, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

type Entorno = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type PaginatedCategories = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: Entorno[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ANALISTA" | "PUBLICO";
};

type CategoryWeightItem = {
  category_id: number;
  weight: number;
};

type PaginatedCategoryWeights = {
  items: CategoryWeightItem[];
};

// helper para errores 422
function extractErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => d?.msg || JSON.stringify(d))
      .join(" | ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return fallback;
}

export default function EntornosPage() {
  const [entornos, setEntornos] = useState<Entorno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // rol actual
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const isAdmin = currentRole === "ADMIN";
  const isAnalyst = currentRole === "ANALISTA";

  // escenario activo y entornos usados en él
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<number>>(
    () => new Set()
  );

  // modal crear
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errorNew, setErrorNew] = useState<string | null>(null);

  // modal editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  // modal eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [errorDelete, setErrorDelete] = useState<string | null>(null);

  async function loadEntornos() {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedCategories>("/v1/categories", {
        params: { page: 1, limit: 50 },
      });
      setEntornos(data.items || []);
    } catch (err) {
      console.error("Error cargando entornos (categories)", err);
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

  async function loadActiveScenarioCategories() {
    try {
      const { data: scenario } = await api.get("/v1/scenarios/active");
      const scenarioId = scenario.id as number;
      setActiveScenarioId(scenarioId);

      const { data: weights } =
        await api.get<PaginatedCategoryWeights>("/v1/weights/categories", {
          params: { scenario_id: scenarioId, page: 1, limit: 200 },
        });

      const ids = new Set<number>();
      (weights.items || []).forEach((item) => {
        ids.add(item.category_id);
      });
      setActiveCategoryIds(ids);
    } catch (err: any) {
      // si no hay escenario activo (404), dejamos todo vacío
      if (err?.response?.status === 404) {
        setActiveScenarioId(null);
        setActiveCategoryIds(new Set());
      } else {
        console.error("Error cargando escenario activo", err);
      }
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadEntornos(),
        loadCurrentUser(),
        loadActiveScenarioCategories(),
      ]);
    })();
  }, []);

  async function createEntorno(e: React.FormEvent) {
    e.preventDefault();
    setErrorNew(null);

    const trimmedName = name.trim();
    const trimmedDesc = desc.trim();

    if (!trimmedName) {
      setErrorNew("El nombre es obligatorio.");
      return;
    }

    try {
      await api.post("/v1/categories", {
        name: trimmedName,
        description: trimmedDesc || null,
      });
      setOpenNew(false);
      setName("");
      setDesc("");
      await loadEntornos();
    } catch (err: any) {
      console.error(err?.response?.data ?? err);
      const msg = extractErrorMessage(err, "Error al crear entorno");
      setErrorNew(msg);
    }
  }

  function openEditModal(ent: Entorno) {
    setEditSlug(ent.slug);
    setEditName(ent.name);
    setEditDesc(ent.description || "");
    setErrorEdit(null);
    setOpenEdit(true);
  }

  async function updateEntorno(e: React.FormEvent) {
    e.preventDefault();
    if (!editSlug) return;
    setErrorEdit(null);

    const trimmedName = editName.trim();
    const trimmedDesc = editDesc.trim();

    if (!trimmedName) {
      setErrorEdit("El nombre es obligatorio.");
      return;
    }

    try {
      await api.patch(`/v1/categories/${editSlug}`, {
        name: trimmedName,
        description: trimmedDesc || null,
      });
      setOpenEdit(false);
      await loadEntornos();
      await loadActiveScenarioCategories();
    } catch (err: any) {
      console.error(err?.response?.data ?? err);
      const msg = extractErrorMessage(err, "Error al actualizar entorno");
      setErrorEdit(msg);
    }
  }

  function openDeleteModal(ent: Entorno) {
    setDeleteSlug(ent.slug);
    setDeleteName(ent.name);
    setErrorDelete(null);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!deleteSlug) return;
    try {
      await api.delete(`/v1/categories/${deleteSlug}`);
      setOpenDelete(false);
      setDeleteSlug(null);
      setDeleteName(null);
      setErrorDelete(null);
      await loadEntornos();
      await loadActiveScenarioCategories();
    } catch (err: any) {
      console.error(err?.response?.data ?? err);
      const msg = extractErrorMessage(
        err,
        "No se pudo eliminar el entorno porque está asignado a uno o más escenarios."
      );
      setErrorDelete(msg);
    }
  }

  const filtered = entornos.filter((e) => {
    const term = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      (e.description || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 h-16 flex items-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#0E1F36]">
            Entornos
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

          {/* ADMIN y ANALISTA pueden crear entornos */}
          <button
            onClick={() => setOpenNew(true)}
            className="self-end sm:self-auto rounded-full bg-[#26A143] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white font-medium hover:brightness-110"
          >
            + Nuevo entorno
          </button>
        </div>

        {/* tarjetas */}
        {loading ? (
          <p className="text-xs sm:text-sm text-zinc-500">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs sm:text-sm text-zinc-500">
            No hay entornos registrados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filtered.map((ent) => {
              const isProtectedForAnalyst =
                isAnalyst && activeCategoryIds.has(ent.id);

              const canModify = !isProtectedForAnalyst;

              return (
                <div
                  key={ent.id}
                  className="rounded-2xl bg-[#0E1F36] text-white p-4 sm:p-5 flex flex-col gap-3 shadow"
                >
                  <h2 className="text-base sm:text-lg font-semibold">
                    {ent.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/80">
                    {ent.description || "Sin descripción"}
                  </p>

                  <div className="mt-auto flex items-center justify-end gap-3 text-white">
                    <Link
                      href={`/dashboard/entornos/${ent.slug}`}
                      className="hover:text-white/90"
                      title="Ver variables"
                    >
                      <Eye size={16} />
                    </Link>

                    <button
                      onClick={() => canModify && openEditModal(ent)}
                      disabled={!canModify}
                      className={`${
                        canModify
                          ? "hover:text-white/90"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        canModify
                          ? "Editar"
                          : "No puedes editar un entorno usado en el escenario activo"
                      }
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => canModify && openDeleteModal(ent)}
                      disabled={!canModify}
                      className={`${
                        canModify
                          ? "hover:text-white/90"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        canModify
                          ? "Eliminar"
                          : "No puedes eliminar un entorno usado en el escenario activo"
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* modal nuevo */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nuevo entorno">
        <form onSubmit={createEntorno} className="space-y-4">
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
              placeholder="Ingrese una descripción"
            />
          </div>
          {errorNew && (
            <p className="text-xs sm:text-sm text-red-600">{errorNew}</p>
          )}
          <button className="w-full rounded-xl bg-[#0E1F36] py-2 text-sm text-white">
            Crear
          </button>
        </form>
      </Modal>

      {/* modal editar */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar entorno">
        <form onSubmit={updateEntorno} className="space-y-4">
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
              Descripción
            </label>
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            />
          </div>
          {errorEdit && (
            <p className="text-xs sm:text-sm text-red-600">{errorEdit}</p>
          )}
          <button className="w-full rounded-xl bg-[#0E1F36] py-2 text-sm text-white">
            Actualizar
          </button>
        </form>
      </Modal>

      {/* modal eliminar */}
      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Eliminar entorno"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-700">
            ¿Seguro que deseas eliminar el entorno{" "}
            <span className="font-semibold">{deleteName}</span> y{" "}
            <span className="font-semibold">
              todas sus variables (indicadores) y valores asociados
            </span>
            ?
          </p>

          {errorDelete && (
            <p className="text-xs sm:text-sm text-red-600">{errorDelete}</p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setOpenDelete(false)}
              className="rounded-lg border px-4 py-2 text-xs sm:text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="rounded-lg bg-red-500 text-white px-4 py-2 text-xs sm:text-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
