"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Search, Pencil, Trash2 } from "lucide-react";

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type Indicator = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  category_id: number;
  value_type: "IMP" | "DMP";
  min_value?: number | null;
  max_value?: number | null;
  source_url?: string | null;
  justification?: string | null;
};

type PaginatedIndicators = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: Indicator[];
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

export default function EntornoDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [category, setCategory] = useState<Category | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // rol actual
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const isAdmin = currentRole === "ADMIN";
  const isAnalyst = currentRole === "ANALISTA";

  // categoría usada en escenario activo
  const [isCategoryUsedInActiveScenario, setIsCategoryUsedInActiveScenario] =
    useState(false);

  const readOnlyForAnalyst =
    isAnalyst && isCategoryUsedInActiveScenario;

  // crear
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValueType, setNewValueType] = useState<"IMP" | "DMP">("DMP");
  const [newMin, setNewMin] = useState<number | "">("");
  const [newMax, setNewMax] = useState<number | "">("");
  const [newSource, setNewSource] = useState("");
  const [newJust, setNewJust] = useState("");
  const [errorNew, setErrorNew] = useState<string | null>(null);

  // editar
  const [openEdit, setOpenEdit] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValueType, setEditValueType] = useState<"IMP" | "DMP">("DMP");
  const [editMin, setEditMin] = useState<number | "">("");
  const [editMax, setEditMax] = useState<number | "">("");
  const [editSource, setEditSource] = useState("");
  const [editJust, setEditJust] = useState("");
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  // eliminar
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [errorDelete, setErrorDelete] = useState<string | null>(null);

  async function loadCurrentUser() {
    try {
      const { data } = await api.get<CurrentUser>("/v1/auth/me");
      setCurrentRole(data.role);
    } catch (err) {
      console.error("Error cargando usuario actual", err);
    }
  }

  async function checkIfCategoryUsedInActiveScenario(categoryId: number) {
    try {
      const { data: scenario } = await api.get("/v1/scenarios/active");
      const scenarioId = scenario.id as number;

      const { data: weights } =
        await api.get<PaginatedCategoryWeights>("/v1/weights/categories", {
          params: { scenario_id: scenarioId, page: 1, limit: 200 },
        });

      const ids = (weights.items || []).map((it) => it.category_id);
      setIsCategoryUsedInActiveScenario(ids.includes(categoryId));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setIsCategoryUsedInActiveScenario(false);
      } else {
        console.error(
          "Error comprobando si la categoría está en el escenario activo",
          err
        );
      }
    }
  }

  async function loadAll() {
    if (!slug) return;
    setLoading(true);
    try {
      const catRes = await api.get<Category>(`/v1/categories/${slug}`);
      const cat = catRes.data;
      setCategory(cat);

      await checkIfCategoryUsedInActiveScenario(cat.id);

      const indRes = await api.get<PaginatedIndicators>("/v1/indicators", {
        params: { category_id: cat.id, page: 1, limit: 100 },
      });
      setIndicators(indRes.data.items || []);
    } catch (err) {
      console.error("Error cargando entorno / indicadores", err);
      setIndicators([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadCurrentUser(), loadAll()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function createIndicator(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    setErrorNew(null);

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setErrorNew("El nombre es obligatorio.");
      return;
    }

    try {
      await api.post("/v1/indicators", {
        name: trimmedName,
        description: null,
        category_id: category.id,
        value_type: newValueType,
        min_value: newMin === "" ? null : Number(newMin),
        max_value: newMax === "" ? null : Number(newMax),
        source_url: newSource || null,
        justification: newJust || null,
      });
      setOpenNew(false);
      setNewName("");
      setNewValueType("DMP");
      setNewMin("");
      setNewMax("");
      setNewSource("");
      setNewJust("");
      await loadAll();
    } catch (err: any) {
      console.error(err?.response?.data ?? err);
      const msg = extractErrorMessage(err, "Error al crear indicador");
      setErrorNew(msg);
    }
  }

  function openEditModal(ind: Indicator) {
    setEditSlug(ind.slug);
    setEditName(ind.name);
    setEditValueType(ind.value_type || "DMP");
    setEditMin(ind.min_value ?? "");
    setEditMax(ind.max_value ?? "");
    setEditSource(ind.source_url || "");
    setEditJust(ind.justification || ind.description || "");
    setErrorEdit(null);
    setOpenEdit(true);
  }

  async function updateIndicator(e: React.FormEvent) {
    e.preventDefault();
    if (!editSlug) return;
    setErrorEdit(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setErrorEdit("El nombre es obligatorio.");
      return;
    }

    try {
      await api.patch(`/v1/indicators/${editSlug}`, {
        name: trimmedName,
        value_type: editValueType,
        min_value: editMin === "" ? null : Number(editMin),
        max_value: editMax === "" ? null : Number(editMax),
        source_url: editSource || null,
        justification: editJust || null,
      });
      setOpenEdit(false);
      await loadAll();
    } catch (err: any) {
      console.error(err?.response?.data ?? err);
      const msg = extractErrorMessage(
        err,
        "Error al actualizar indicador"
      );
      setErrorEdit(msg);
    }
  }

  function openDeleteModal(ind: Indicator) {
    setDeleteSlug(ind.slug);
    setDeleteName(ind.name);
    setErrorDelete(null);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (!deleteSlug) return;
    try {
      await api.delete(`/v1/indicators/${deleteSlug}`);
      setOpenDelete(false);
      setDeleteSlug(null);
      setDeleteName(null);
      setErrorDelete(null);
      await loadAll();
    } catch (err: any) {
      const msg = extractErrorMessage(
        err,
        "No se pudo eliminar el indicador. Verifique que no tenga valores en escenarios."
      );
      setErrorDelete(msg);
    }
  }

  const filtered = indicators.filter((ind) => {
    const term = search.toLowerCase();
    return (
      ind.name.toLowerCase().includes(term) ||
      (ind.source_url || "").toLowerCase().includes(term) ||
      (ind.justification || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-0 h-16 flex items-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#0E1F36]">
            {category ? category.name : "Entorno"}
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

          {/* Solo ocultamos para analista cuando este entorno está en el escenario activo */}
          {!readOnlyForAnalyst && (
            <button
              onClick={() => setOpenNew(true)}
              className="self-end sm:self-auto rounded-full bg-[#26A143] px-3 sm:px-4 py-2 text-xs sm:text-sm text-white font-medium hover:brightness-110"
            >
              + Nuevo Indicador
            </button>
          )}
        </div>

        {readOnlyForAnalyst && (
          <p className="mb-4 text-[11px] sm:text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Este entorno está asignado al escenario activo. Como analista,
            solo puedes consultar sus indicadores; no puedes modificarlos.
          </p>
        )}

        {loading ? (
          <p className="text-xs sm:text-sm text-zinc-500">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs sm:text-sm text-zinc-500">
            No hay indicadores en este entorno.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filtered.map((ind) => {
              const isIMP = ind.value_type === "IMP";
              const bg = isIMP ? "bg-[#C91C1C]" : "bg-[#198744]";

              const canModify = !readOnlyForAnalyst;

              return (
                <div
                  key={ind.id}
                  className={`${bg} rounded-2xl text-white px-4 sm:px-5 py-4 shadow flex flex-col gap-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base sm:text-lg font-semibold">
                      {ind.name}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      {ind.value_type}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-sm text-white/80 break-all">
                    Sitio web: {ind.source_url ? ind.source_url : "—"}
                  </p>
                  <p className="text-[11px] sm:text-sm text-white/80">
                    Escala:{" "}
                    {ind.min_value !== null && ind.min_value !== undefined
                      ? ind.min_value
                      : 0}{" "}
                    -{" "}
                    {ind.max_value !== null && ind.max_value !== undefined
                      ? ind.max_value
                      : 100}
                  </p>
                  {ind.justification ? (
                    <p className="text-[11px] sm:text-xs text-white/70 line-clamp-3">
                      {ind.justification}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-end gap-3">
                    <button
                      onClick={() => canModify && openEditModal(ind)}
                      disabled={!canModify}
                      className={`${canModify
                        ? "hover:text-white/90"
                        : "opacity-40 cursor-not-allowed"
                        }`}
                      title={
                        canModify
                          ? "Editar"
                          : "No puedes modificar indicadores de un entorno usado en el escenario activo"
                      }
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => canModify && openDeleteModal(ind)}
                      disabled={!canModify}
                      className={`${canModify
                        ? "hover:text-white/90"
                        : "opacity-40 cursor-not-allowed"
                        }`}
                      title={
                        canModify
                          ? "Eliminar"
                          : "No puedes eliminar indicadores de un entorno usado en el escenario activo"
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

      {/* MODAL NUEVA */}
      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Nuevo indicador">
        <form onSubmit={createIndicator} className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Nombre
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="Ej. PIB per cápita"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Tipo
              </label>
              <select
                value={newValueType}
                onChange={(e) =>
                  setNewValueType(e.target.value as "IMP" | "DMP")
                }
                className="mt-1 w-28 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
              >
                <option value="DMP">DMP</option>
                <option value="IMP">IMP</option>
              </select>

              {/* Texto de ayuda sobre DMP / IMP */}
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                <span className="font-semibold">DMP</span> (directamente proporcional):
                a mayor valor del dato, <span className="font-semibold">mayor riesgo</span>.
                <br />
                <span className="font-semibold">IMP</span> (inversamente proporcional):
                a mayor valor del dato, <span className="font-semibold">menor riesgo</span>.
              </p>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs sm:text-sm font-medium text-zinc-700">
                  Escala mín.
                </label>
                <input
                  type="number"
                  value={newMin}
                  onChange={(e) =>
                    setNewMin(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-20 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-zinc-700">
                  Escala máx.
                </label>
                <input
                  type="number"
                  value={newMax}
                  onChange={(e) =>
                    setNewMax(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-20 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Sitio web consultado
            </label>
            <input
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Justificación
            </label>
            <textarea
              value={newJust}
              onChange={(e) => setNewJust(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none min-h-[90px]"
              placeholder="Explique por qué se usa este indicador..."
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

      {/* MODAL EDITAR */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar indicador">
        <form onSubmit={updateIndicator} className="space-y-4">
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

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-zinc-700">
                Tipo
              </label>
              <select
                value={editValueType}
                onChange={(e) =>
                  setEditValueType(e.target.value as "IMP" | "DMP")
                }
                className="mt-1 w-28 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
              >
                <option value="DMP">DMP</option>
                <option value="IMP">IMP</option>
              </select>

              {/* Texto de ayuda sobre DMP / IMP */}
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                <span className="font-semibold">DMP</span> (directamente proporcional):
                a mayor valor del dato, <span className="font-semibold">mayor riesgo</span>.
                <br />
                <span className="font-semibold">IMP</span> (inversamente proporcional):
                a mayor valor del dato, <span className="font-semibold">menor riesgo</span>.
              </p>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs sm:text-sm font-medium text-zinc-700">
                  Escala mín.
                </label>
                <input
                  type="number"
                  value={editMin}
                  onChange={(e) =>
                    setEditMin(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-20 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-zinc-700">
                  Escala máx.
                </label>
                <input
                  type="number"
                  value={editMax}
                  onChange={(e) =>
                    setEditMax(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="mt-1 w-20 rounded-lg bg-zinc-100 border border-zinc-200 px-2 py-1.5 text-xs sm:text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Sitio web consultado
            </label>
            <input
              value={editSource}
              onChange={(e) => setEditSource(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-zinc-700">
              Justificación
            </label>
            <textarea
              value={editJust}
              onChange={(e) => setEditJust(e.target.value)}
              className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2 text-xs sm:text-sm outline-none min-h-[90px]"
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

      {/* MODAL ELIMINAR */}
      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Eliminar indicador"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-700">
            ¿Seguro que deseas eliminar el indicador{" "}
            <span className="font-semibold">{deleteName}</span>?
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
