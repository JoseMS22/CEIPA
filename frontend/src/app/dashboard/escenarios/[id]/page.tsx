"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Pencil, Trash2 } from "lucide-react";

type Scenario = {
  id: number;
  name: string;
  description?: string;
  progress?: number;
  active?: boolean;
};

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
};

type Indicator = {
  id: number;
  name: string;
  category_id: number;
};

type ScenarioCategoryWeight = {
  category_id: number;
  weight: number; // 0..1
  category_name?: string;
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ANALISTA" | "PUBLICO";
};

export default function ScenarioDetailPage() {
  const params = useParams<{ id: string }>();
  const scenarioId = Number(params.id);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [catWeights, setCatWeights] = useState<ScenarioCategoryWeight[]>([]);
  const [catSum, setCatSum] = useState<number>(0);

  // usuario actual
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  // 🔵 pesos de indicadores que vienen del back: {indicator_id: 0.25}
  const [indicatorWeightsMap, setIndicatorWeightsMap] =
    useState<Record<number, number>>({});
  // 🔵 caché de indicadores por categoría
  const [categoryIndicatorsMap, setCategoryIndicatorsMap] =
    useState<Record<number, Indicator[]>>({});

  // ========== MODAL NUEVO ==========
  const [openNew, setOpenNew] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [newCatWeight, setNewCatWeight] = useState<number>(30);
  const [categoryIndicators, setCategoryIndicators] = useState<Indicator[]>([]);
  const [indicatorWeights, setIndicatorWeights] =
    useState<Record<number, number>>({});
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // ========== MODAL EDITAR ==========
  const [openEdit, setOpenEdit] = useState(false);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editCatWeight, setEditCatWeight] = useState<number>(0);
  const [editIndicators, setEditIndicators] = useState<Indicator[]>([]);
  const [editIndicatorWeights, setEditIndicatorWeights] =
    useState<Record<number, number>>({});
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const [topError, setTopError] = useState<string | null>(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);
  const [deleteCatName, setDeleteCatName] = useState<string>("");
  const [topSuccess, setTopSuccess] = useState<string | null>(null);

  const [initialCatWeights, setInitialCatWeights] =
    useState<ScenarioCategoryWeight[]>([]);

  // 🔒 solo lectura para ANALISTA cuando el escenario está activo
  const isLocked =
    !!scenario?.active && currentRole === "ANALISTA";

  // ====== LOADERS ======
  async function loadScenario() {
    const { data } = await api.get(`/v1/scenarios/${scenarioId}`);
    setScenario(data);
  }

  async function loadCategories() {
    const { data } = await api.get("/v1/categories", {
      params: { page: 1, limit: 100 },
    });
    setAllCategories(data.items || []);
  }

  async function loadCategoryWeights() {
    const { data } = await api.get("/v1/weights/categories", {
      params: { scenario_id: scenarioId },
    });
    const items = (data.items || []).map((it: any) => ({
      category_id: it.category_id,
      weight: it.weight,
    })) as ScenarioCategoryWeight[];

    setCatSum(data.sum || 0);
    setCatWeights(items);
    setInitialCatWeights(items); // copia inicial
  }

  async function loadIndicatorWeights() {
    const { data } = await api.get("/v1/weights/indicators", {
      params: { scenario_id: scenarioId },
    });
    const map: Record<number, number> = {};
    (data.items || []).forEach((it: any) => {
      map[it.indicator_id] = it.weight; // 0..1
    });
    setIndicatorWeightsMap(map);
  }

  async function loadIndicatorsForUsedCategories(usedCats: number[]) {
    const newMap: Record<number, Indicator[]> = { ...categoryIndicatorsMap };
    for (const catId of usedCats) {
      if (newMap[catId]) continue;
      const { data } = await api.get("/v1/indicators", {
        params: { category_id: catId, page: 1, limit: 100 },
      });
      newMap[catId] = data.items || [];
    }
    setCategoryIndicatorsMap(newMap);
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
    if (!scenarioId) return;
    (async () => {
      await Promise.all([
        loadScenario(),
        loadCategories(),
        loadCategoryWeights(),
        loadIndicatorWeights(),
        loadCurrentUser(),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(() => {
    const usedIds = catWeights.map((c) => c.category_id);
    if (usedIds.length > 0) {
      loadIndicatorsForUsedCategories(usedIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catWeights]);

  // ====== MEMOS ======
  const usedCategoryIds = useMemo(
    () => new Set(catWeights.map((cw) => cw.category_id)),
    [catWeights]
  );

  const availableCategories = useMemo(
    () => allCategories.filter((c) => !usedCategoryIds.has(c.id)),
    [allCategories, usedCategoryIds]
  );

  const indicatorSum = useMemo(() => {
    return Object.values(indicatorWeights).reduce(
      (acc, n) => acc + (Number(n) || 0),
      0
    );
  }, [indicatorWeights]);

  const editIndicatorsSum = useMemo(() => {
    return Object.values(editIndicatorWeights).reduce(
      (acc, n) => acc + (Number(n) || 0),
      0
    );
  }, [editIndicatorWeights]);

  // ====== HANDLERS NUEVO ======
  async function handleCategoryChange(categoryIdStr: string) {
    const catId = Number(categoryIdStr);
    setSelectedCategoryId(catId);
    setCategoryIndicators([]);
    setIndicatorWeights({});
    setErrorModal(null);

    if (!catId) return;

    setLoadingIndicators(true);
    try {
      const { data } = await api.get("/v1/indicators", {
        params: { category_id: catId, page: 1, limit: 100 },
      });
      const items: Indicator[] = data.items || [];
      setCategoryIndicators(items);

      const initial: Record<number, number> = {};
      items.forEach((ind) => {
        initial[ind.id] = 0;
      });
      setIndicatorWeights(initial);
    } catch (err) {
      console.error(err);
      setErrorModal("No se pudieron cargar los indicadores de este entorno.");
    } finally {
      setLoadingIndicators(false);
    }
  }

  function handleIndicatorWeightChange(indicatorId: number, value: string) {
    const num = value === "" ? 0 : Number(value);
    setIndicatorWeights((prev) => ({
      ...prev,
      [indicatorId]: num,
    }));
  }

  function openAddModal() {
    if (isLocked) return;
    setSelectedCategoryId("");
    setNewCatWeight(30);
    setCategoryIndicators([]);
    setIndicatorWeights({});
    setErrorModal(null);
    setOpenNew(true);
  }

  async function addCategoryToScenario(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;

    if (!selectedCategoryId) {
      setErrorModal("Seleccione un entorno.");
      return;
    }

    const cat = allCategories.find((c) => c.id === selectedCategoryId);
    if (!cat) {
      setErrorModal("Entorno no encontrado.");
      return;
    }

    if (indicatorSum !== 100) {
      setErrorModal("Las indicadores de este entorno deben sumar 100%.");
      return;
    }

    const w = Number((newCatWeight / 100).toFixed(4));
    const newList = [
      ...catWeights,
      {
        category_id: selectedCategoryId,
        weight: w,
        category_name: cat.name,
      },
    ];
    const newSum = newList.reduce((acc, it) => acc + it.weight, 0);

    setCatWeights(newList);
    setCatSum(Number(newSum.toFixed(4)));
    setOpenNew(false);

    const updatedMap = { ...indicatorWeightsMap };
    Object.entries(indicatorWeights).forEach(([indIdStr, val]) => {
      const indId = Number(indIdStr);
      updatedMap[indId] = Number((val / 100).toFixed(4));
    });
    setIndicatorWeightsMap(updatedMap);
  }

  // ====== ELIMINAR ======
  function removeCategory(categoryId: number) {
    const newList = catWeights.filter((it) => it.category_id !== categoryId);
    const newSum = newList.reduce((acc, it) => acc + it.weight, 0);
    setCatWeights(newList);
    setCatSum(Number(newSum.toFixed(4)));
  }

  function confirmDelete() {
    if (isLocked) return;
    if (deleteCatId == null) return;
    removeCategory(deleteCatId);
    setOpenDelete(false);
    setDeleteCatId(null);
    setDeleteCatName("");
    setTopError(null);
  }

  // ====== EDITAR ======
  async function openEditModal(categoryId: number) {
    if (isLocked) return;

    const item = catWeights.find((c) => c.category_id === categoryId);
    if (!item) return;

    setEditCatId(categoryId);
    setEditCatWeight(Math.round(item.weight * 100));
    setErrorEdit(null);

    let indicators = categoryIndicatorsMap[categoryId];
    if (!indicators) {
      const { data } = await api.get("/v1/indicators", {
        params: { category_id: categoryId, page: 1, limit: 100 },
      });
      indicators = data.items || [];
    }

    setEditIndicators(indicators);

    const init: Record<number, number> = {};
    indicators.forEach((ind) => {
      const w = indicatorWeightsMap[ind.id]; // 0..1
      init[ind.id] = w !== undefined ? Math.round(w * 10000) / 100 : 0;
    });
    setEditIndicatorWeights(init);

    setOpenEdit(true);
  }

  function handleEditIndicatorChange(indicatorId: number, value: string) {
    const num = value === "" ? 0 : Number(value);
    setEditIndicatorWeights((prev) => ({
      ...prev,
      [indicatorId]: num,
    }));
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    if (editCatId == null) return;

    if (editIndicators.length > 0 && editIndicatorsSum !== 100) {
      setErrorEdit("Las indicadores de este entorno deben sumar 100%.");
      return;
    }

    const newList = catWeights.map((it) => {
      if (it.category_id === editCatId) {
        return {
          ...it,
          weight: Number((editCatWeight / 100).toFixed(4)),
        };
      }
      return it;
    });
    const newSum = newList.reduce((acc, it) => acc + it.weight, 0);
    setCatWeights(newList);
    setCatSum(Number(newSum.toFixed(4)));

    const updatedMap = { ...indicatorWeightsMap };
    Object.entries(editIndicatorWeights).forEach(([indIdStr, val]) => {
      const indId = Number(indIdStr);
      updatedMap[indId] = Number((val / 100).toFixed(4));
    });
    setIndicatorWeightsMap(updatedMap);

    setOpenEdit(false);
  }

  // ====== GUARDAR TODO ======
  async function saveAllToBackend() {
    if (isLocked) return;

    const diff = Math.abs(catSum - 1.0);
    if (diff > 0.000001) {
      setTopError(
        "La suma de los entornos debe ser exactamente 100%. Ajusta los valores antes de guardar."
      );
      setTopSuccess(null);
      return;
    }

    // 1) detectar entornos eliminados respecto al estado inicial
    const initialIds = new Set(initialCatWeights.map((c) => c.category_id));
    const currentIds = new Set(catWeights.map((c) => c.category_id));

    const removedCategoryIds = Array.from(initialIds).filter(
      (id) => !currentIds.has(id)
    );

    try {
      // 2) para cada entorno eliminado, llamar al backend
      for (const catId of removedCategoryIds) {
        await api.delete(`/v1/scenarios/${scenarioId}/categories/${catId}`);
      }

      // 3) guardar pesos de categorías
      await api.put("/v1/weights/categories", {
        scenario_id: scenarioId,
        items: catWeights.map((it) => ({
          category_id: it.category_id,
          weight: it.weight,
        })),
      });

      // 4) guardar pesos de indicadores
      const indicatorItems = Object.entries(indicatorWeightsMap).map(
        ([indIdStr, w]) => ({
          indicator_id: Number(indIdStr),
          weight: w,
        })
      );

      if (indicatorItems.length > 0) {
        await api.put("/v1/weights/indicators", {
          scenario_id: scenarioId,
          items: indicatorItems,
        });
      }

      // recargar del backend y actualizar inicial
      await Promise.all([loadCategoryWeights(), loadIndicatorWeights()]);

      setInitialCatWeights(catWeights); // lo actual inicial ahora es el actual
      setTopError(null);
      setTopSuccess("Entornos guardados correctamente.");
    } catch (err: any) {
      console.error(err);
      setTopError(
        err?.response?.data?.detail ||
          "Ocurrió un error al guardar los entornos."
      );
      setTopSuccess(null);
    }
  }

  // ====== RENDER ======
  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-[#0E1F36] sm:text-2xl">
              {scenario ? scenario.name : "Escenario"}
            </h1>
            <p className="text-sm text-[#0E1F36]/70">
              {scenario?.description || "Descripción..."}
            </p>
            {/* Porcentaje visible en móvil */}
            <p className="mt-1 text-lg font-bold text-[#0E1F36] sm:hidden">
              {(catSum * 100).toFixed(0)}%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Porcentaje visible en pantallas medianas+ */}
            <p className="hidden text-2xl font-bold text-[#0E1F36] sm:block">
              {(catSum * 100).toFixed(0)}%
            </p>
            <button
              onClick={openAddModal}
              disabled={isLocked}
              className={`rounded-full bg-[#26A143] px-4 py-2 text-sm font-medium text-white hover:brightness-110 sm:text-base ${
                isLocked ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              + Agregar Entorno
            </button>
            <button
              onClick={saveAllToBackend}
              disabled={isLocked}
              className={`rounded-full bg-[#0E1F36] px-4 py-2 text-sm font-medium text-white hover:brightness-110 sm:text-base ${
                isLocked ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              Guardar
            </button>
          </div>
        </div>
      </header>

      {scenario?.active && currentRole === "ANALISTA" && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este escenario está <strong>activo</strong>. Como ANALISTA solo
            puedes visualizar los datos, no puedes modificarlos.
          </div>
        </div>
      )}

      {topError && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {topError}
          </div>
        </div>
      )}

      {topSuccess && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {topSuccess}
          </div>
        </div>
      )}

      {/* BODY */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {catWeights.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No hay entornos asignados aún.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {catWeights.map((item) => {
              const cat = allCategories.find((c) => c.id === item.category_id);
              const indicatorsOfCat =
                categoryIndicatorsMap[item.category_id] || [];

              return (
                <div
                  key={item.category_id}
                  className="w-full max-w-5xl rounded-2xl bg-[#0E1F36] p-5 text-white shadow md:w-[48%]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">
                        {cat ? cat.name : "Entorno"}
                      </p>
                      <p className="text-sm text-white/70">
                        {Math.round(item.weight * 100)}%
                      </p>
                    </div>
                    {!isLocked && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(item.category_id)}
                          className="text-white/85 hover:text-white"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => {
                            const currentCat = allCategories.find(
                              (c) => c.id === item.category_id
                            );
                            setDeleteCatId(item.category_id);
                            setDeleteCatName(
                              currentCat ? currentCat.name : "este entorno"
                            );
                            setOpenDelete(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          title="Quitar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {indicatorsOfCat.length === 0 ? (
                      <p className="text-xs text-white/50">
                        Este entorno aún no tiene indicadores.
                      </p>
                    ) : (
                      indicatorsOfCat.map((ind) => {
                        const w = indicatorWeightsMap[ind.id];
                        return (
                          <div
                            key={ind.id}
                            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                          >
                            <span className="text-sm">{ind.name}</span>
                            <span className="text-xs text-white/80">
                              {w !== undefined ? Math.round(w * 100) : 0}%
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL NUEVO */}
      <Modal
        open={openNew}
        onClose={() => setOpenNew(false)}
        title="Agregar Entorno"
      >
        <form onSubmit={addCategoryToScenario} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Entorno</label>
            <select
              value={selectedCategoryId === "" ? "" : String(selectedCategoryId)}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none"
              required
              disabled={isLocked}
            >
              <option value="">Seleccione...</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">
              Valor del entorno
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={newCatWeight}
              onChange={(e) => setNewCatWeight(Number(e.target.value))}
              className="mt-1 w-24 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none"
              disabled={isLocked}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Recuerda: todos los entornos del escenario deben sumar 100.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              indicadores del entorno
            </p>
            {loadingIndicators ? (
              <p className="text-xs text-zinc-500">Cargando indicadores...</p>
            ) : categoryIndicators.length === 0 ? (
              <p className="text-xs text-zinc-400">
                Seleccione un entorno para ver sus indicadores.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {categoryIndicators.map((ind) => (
                    <li
                      key={ind.id}
                      className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2"
                    >
                      <span className="text-sm text-zinc-700">
                        {ind.name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={indicatorWeights[ind.id] ?? 0}
                        onChange={(e) =>
                          handleIndicatorWeightChange(ind.id, e.target.value)
                        }
                        className="w-16 rounded-full border border-zinc-200 bg-white px-2 py-1 text-right text-sm outline-none"
                        disabled={isLocked}
                      />
                    </li>
                  ))}
                </ul>
                <p
                  className={`mt-2 text-xs ${
                    indicatorSum === 100
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`}
                >
                  Total indicadores: {indicatorSum}%{" "}
                  {indicatorSum !== 100 && "(debe ser 100%)"}
                </p>
              </>
            )}
          </div>

          {errorModal && (
            <p className="text-sm text-red-600">{errorModal}</p>
          )}

          <button
            className={`w-full rounded-xl bg-[#0E1F36] py-2 text-white ${
              isLocked ? "cursor-not-allowed opacity-60" : ""
            }`}
            disabled={isLocked}
          >
            Agregar
          </button>
        </form>
      </Modal>

      {/* MODAL EDITAR */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Editar entorno"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">
              Valor del entorno (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={editCatWeight}
              onChange={(e) => setEditCatWeight(Number(e.target.value))}
              className="mt-1 w-24 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none"
              disabled={isLocked}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Indicadores de este entorno
            </p>
            {editIndicators.length === 0 ? (
              <p className="text-xs text-zinc-400">
                Este entorno no tiene indicadores.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {editIndicators.map((ind) => (
                    <li
                      key={ind.id}
                      className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2"
                    >
                      <span className="text-sm text-zinc-700">
                        {ind.name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editIndicatorWeights[ind.id] ?? 0}
                        onChange={(e) =>
                          handleEditIndicatorChange(ind.id, e.target.value)
                        }
                        className="w-16 rounded-full border border-zinc-200 bg-white px-2 py-1 text-right text-sm outline-none"
                        disabled={isLocked}
                      />
                    </li>
                  ))}
                </ul>
                <p
                  className={`mt-2 text-xs ${
                    editIndicatorsSum === 100
                      ? "text-emerald-600"
                      : "text-red-500"
                  }`}
                >
                  Total indicadores: {editIndicatorsSum}%{" "}
                  {editIndicatorsSum !== 100 && "(debe ser 100%)"}
                </p>
              </>
            )}
          </div>

          {errorEdit && (
            <p className="text-sm text-red-600">{errorEdit}</p>
          )}

          <button
            className={`w-full rounded-xl bg-[#0E1F36] py-2 text-white ${
              isLocked ? "cursor-not-allowed opacity-60" : ""
            }`}
            disabled={isLocked}
          >
            Guardar cambios
          </button>
        </form>
      </Modal>

      {/* MODAL ELIMINAR */}
      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Eliminar entorno"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            ¿Seguro que deseas eliminar{" "}
            <span className="font-semibold">{deleteCatName}</span> de este
            escenario?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpenDelete(false)}
              className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className={`rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 ${
                isLocked ? "cursor-not-allowed opacity-60" : ""
              }`}
              disabled={isLocked}
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
