// src/app/dashboard/escenarios/[id]/valores/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Search, Pencil, Trash2 } from "lucide-react";

type Scenario = {
  id: number;
  name: string;
  description?: string | null;
  active?: boolean;
};

type CategoryWeight = {
  category_id: number;
  weight: number; // 0..1
};

type Category = {
  id: number;
  name: string;
  slug: string;
};

type Indicator = {
  id: number;
  name: string;
  category_id: number;
  value_type: "IMP" | "DMP";
  weight?: number;

  // 👇 necesarios para validar escalas
  min_value?: number | null;
  max_value?: number | null;
};

type Country = {
  id: number;
  iso2: string;
  iso3: string;
  name_es: string;
  name_en: string;
};

type IndicatorValue = {
  id: number;
  country_id: number;
  indicator_id: number;
  raw_value: number | null;
  normalized_value: number | null;
  loaded_at: string;
};

type Paginated<T> = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: T[];
};

type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ANALISTA" | "PUBLICO";
};

export default function ScenarioIndicatorValuesPage() {
  const params = useParams<{ id: string }>();
  const scenarioId = Number(params.id);
  const router = useRouter();

  // top
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [search, setSearch] = useState("");

  // usuario actual
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  // data base
  const [catWeights, setCatWeights] = useState<CategoryWeight[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [indicatorsByCat, setIndicatorsByCat] = useState<
    Record<number, Indicator[]>
  >({});
  const [countries, setCountries] = useState<Country[]>([]);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValue[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Importar Excel
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // modal add/edit
  const [openModal, setOpenModal] = useState(false);
  const [editingRecordIds, setEditingRecordIds] = useState<
    Record<number, number | null>
  >({});
  const [selectedCountryId, setSelectedCountryId] = useState<number | "">("");
  const [valuesBuffer, setValuesBuffer] = useState<Record<number, string>>({});

  // modal delete
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteValueId, setDeleteValueId] = useState<number | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<string>("");

  // pesos de indicadores { indicator_id: 0..1 }
  const [indicatorWeightsMap, setIndicatorWeightsMap] =
    useState<Record<number, number>>({});

  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);

  // ⭐ Toast
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 🔒 solo lectura para ANALISTA cuando el escenario está activo
  const isLocked = !!scenario?.active && currentRole === "ANALISTA";

  async function loadScenario() {
    const { data } = await api.get(`/v1/scenarios/${scenarioId}`);
    setScenario(data);
  }

  async function loadScenarioCategories() {
    const { data } = await api.get("/v1/weights/categories", {
      params: { scenario_id: scenarioId },
    });
    setCatWeights(data.items || []);
  }

  async function loadAllCategories() {
    const { data } = await api.get("/v1/categories", {
      params: { page: 1, limit: 100 },
    });
    setAllCategories(data.items || []);
  }

  async function loadAllCountries() {
    const { data } = await api.get("/v1/countries", {
      params: {
        page: 1,
        limit: 500,
        only_enabled: true,
      },
    });
    setCountries(data.items || []);
  }

  async function loadIndicatorValues() {
    const { data } = await api.get<Paginated<IndicatorValue>>(
      "/v1/indicator-values",
      {
        params: { scenario_id: scenarioId, page: 1, limit: 200 },
      }
    );
    setIndicatorValues(data.items || []);
  }

  async function loadIndicatorsForCategories(catIds: number[]) {
    const copy = { ...indicatorsByCat };
    for (const cId of catIds) {
      if (copy[cId]) continue;
      const { data } = await api.get<Paginated<Indicator>>("/v1/indicators", {
        params: { category_id: cId, page: 1, limit: 100 },
      });
      copy[cId] = data.items || [];
    }
    setIndicatorsByCat(copy);
  }

  async function loadIndicatorWeights() {
    const { data } = await api.get("/v1/weights/indicators", {
      params: { scenario_id: scenarioId },
    });
    const map: Record<number, number> = {};
    (data.items || []).forEach((it: any) => {
      map[it.indicator_id] = it.weight;
    });
    setIndicatorWeightsMap(map);
  }

  async function loadCurrentUser() {
    try {
      const { data } = await api.get<CurrentUser>("/v1/auth/me");
      setCurrentRole(data.role);
    } catch (err) {
      console.error("Error cargando usuario actual", err);
    }
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  }

  useEffect(() => {
    if (!scenarioId) return;
    (async () => {
      setLoading(true);
      await Promise.all([
        loadScenario(),
        loadScenarioCategories(),
        loadAllCategories(),
        loadAllCountries(),
        loadIndicatorValues(),
        loadIndicatorWeights(),
        loadCurrentUser(),
      ]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(() => {
    if (catWeights.length === 0) return;
    const ids = catWeights.map((c) => c.category_id);
    loadIndicatorsForCategories(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catWeights]);

  // helpers
  function getCategoryName(catId: number) {
    return allCategories.find((c) => c.id === catId)?.name || "—";
  }

  const usedCountryIds = useMemo(
    () => Array.from(new Set(indicatorValues.map((v) => v.country_id))),
    [indicatorValues]
  );

  function getCountryName(id: number) {
    return countries.find((c) => c.id === id)?.name_es || "—";
  }

  const scenarioCats = useMemo(
    () =>
      catWeights.map((cw) => ({
        category_id: cw.category_id,
        weight: cw.weight,
        name: getCategoryName(cw.category_id),
        indicators: indicatorsByCat[cw.category_id] || [],
      })),
    [catWeights, allCategories, indicatorsByCat]
  );

  const filteredCountryIds = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return usedCountryIds;
    return usedCountryIds.filter((cid) => {
      const n = getCountryName(cid).toLowerCase();
      return n.includes(term);
    });
  }, [search, usedCountryIds, countries]);

  // modal agregar
  function openAddModal() {
    if (isLocked) return;
    setSelectedCountryId("");
    const buf: Record<number, string> = {};
    scenarioCats.forEach((sc) => {
      sc.indicators.forEach((ind) => {
        buf[ind.id] = "";
      });
    });
    setValuesBuffer(buf);
    setOpenModal(true);
    setEditingRecordIds({});
    setCountrySearch("");
  }

  // modal editar por país
  function openEditModal(countryId: number) {
    if (isLocked) return;

    setSelectedCountryId(countryId);
    const buf: Record<number, string> = {};
    const editIds: Record<number, number | null> = {};
    scenarioCats.forEach((sc) => {
      sc.indicators.forEach((ind) => {
        const existing = indicatorValues.find(
          (v) => v.country_id === countryId && v.indicator_id === ind.id
        );
        buf[ind.id] =
          existing?.raw_value !== null && existing?.raw_value !== undefined
            ? String(existing.raw_value)
            : "";
        editIds[ind.id] = existing ? existing.id : null;
      });
    });
    setValuesBuffer(buf);
    setEditingRecordIds(editIds);
    setOpenModal(true);

    const c = countries.find((c) => c.id === countryId);
    setCountrySearch(c ? c.name_es : "");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) {
      showToast(
        "error",
        "No puedes modificar valores de un escenario activo siendo ANALISTA."
      );
      return;
    }

    if (!selectedCountryId) return;

    const countryId = Number(selectedCountryId);

    // ⚠️ 1) Validar rangos ANTES de armar requests
    const outOfRangeMessages: string[] = [];

    scenarioCats.forEach((sc) => {
      sc.indicators.forEach((ind) => {
        const rawStr = valuesBuffer[ind.id];
        if (rawStr === "" || rawStr === undefined) return;

        const rawNum = Number(rawStr);
        if (Number.isNaN(rawNum)) {
          outOfRangeMessages.push(
            `«${ind.name}» tiene un valor no numérico (${rawStr}).`
          );
          return;
        }

        const min = ind.min_value;
        const max = ind.max_value;

        if (min !== null && min !== undefined && rawNum < min) {
          outOfRangeMessages.push(
            `«${ind.name}»: ${rawNum} está por debajo del mínimo (${min}).`
          );
        }
        if (max !== null && max !== undefined && rawNum > max) {
          outOfRangeMessages.push(
            `«${ind.name}»: ${rawNum} está por encima del máximo (${max}).`
          );
        }
      });
    });

    if (outOfRangeMessages.length > 0) {
      const firstOnes = outOfRangeMessages.slice(0, 4).join(" ");
      showToast(
        "error",
        `No se guardaron los cambios porque algunos valores están fuera de la escala definida para el indicador. ${firstOnes}`
      );
      return;
    }

    // ⚙️ 2) Si todos los valores están dentro de la escala → enviar al backend
    const reqs: Promise<any>[] = [];

    scenarioCats.forEach((sc) => {
      sc.indicators.forEach((ind) => {
        const rawStr = valuesBuffer[ind.id];
        if (rawStr === "" || rawStr === undefined) return;
        const rawNum = Number(rawStr);
        const existingId = editingRecordIds[ind.id];

        if (existingId) {
          reqs.push(
            api.patch(`/v1/indicator-values/${existingId}`, {
              raw_value: rawNum,
            })
          );
        } else {
          reqs.push(
            api.post("/v1/indicator-values", {
              scenario_id: scenarioId,
              country_id: countryId,
              indicator_id: ind.id,
              raw_value: rawNum,
            })
          );
        }
      });
    });

    if (reqs.length === 0) {
      // nada que guardar
      setOpenModal(false);
      return;
    }

    try {
      await Promise.all(reqs);
      setOpenModal(false);
      await loadIndicatorValues();
      showToast("success", "Valores guardados correctamente.");
    } catch (err: any) {
      console.error("Error guardando valores:", err);
      const backendMsg =
        err?.response?.data?.detail ||
        "Ocurrió un error al guardar los valores.";
      showToast("error", backendMsg);
    }
  }

  // IMPORTAR EXCEL
  async function handleExcelChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isLocked) {
      showToast(
        "error",
        "No puedes importar datos en un escenario activo siendo ANALISTA."
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // 👇 leemos también processed y errors
      const { data } = await api.post<{
        processed: number;
        errors: string[];
      }>("/v1/indicator-values/import-matrix-excel", formData, {
        params: { scenario_id: scenarioId },
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await loadIndicatorValues();

      if (data.errors && data.errors.length > 0) {
        const firstErrors = data.errors.slice(0, 4).join(" ");
        showToast(
          "error",
          `Se importaron ${data.processed} valores, pero algunos fueron rechazados (por ejemplo, fuera de escala o errores de normalización). ${firstErrors}`
        );
      } else {
        showToast("success", "Excel importado correctamente.");
      }
    } catch (err: any) {
      console.error("Error importando Excel:", err);
      const backendMsg =
        err?.response?.data?.detail ||
        "Ocurrió un error al importar el archivo.";
      showToast("error", backendMsg);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  // eliminar
  function askDelete(value: IndicatorValue) {
    if (isLocked) return;
    setDeleteValueId(value.id);
    const countryName = getCountryName(value.country_id);
    setDeleteInfo(`${countryName} - indicador #${value.indicator_id}`);
    setOpenDelete(true);
  }

  async function confirmDelete() {
    if (isLocked) {
      showToast(
        "error",
        "No puedes eliminar valores de un escenario activo siendo ANALISTA."
      );
      return;
    }
    if (!deleteValueId) return;
    await api.delete(`/v1/indicator-values/${deleteValueId}`);
    setOpenDelete(false);
    setDeleteValueId(null);
    setDeleteInfo("");
    await loadIndicatorValues();
  }

  return (
    <div className="min-h-screen bg-[#E9EAED]">
      {/* HEADER */}
      <header className="border-b bg-[#E9EAED]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <h1 className="text-xl font-semibold text-[#0E1F36] sm:text-2xl">
            {scenario ? scenario.name : "Escenario"}
          </h1>
        </div>
      </header>

      {scenario?.active && currentRole === "ANALISTA" && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este escenario está <strong>activo</strong>. Como ANALISTA solo
            puedes visualizar los valores, no puedes agregar, editar ni
            eliminar datos.
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-2.5 text-zinc-400"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país"
              className="w-full rounded-full bg-white pl-9 pr-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              onClick={() =>
                router.push(`/dashboard/escenarios/${scenarioId}/resultados`)
              }
              className="flex items-center gap-2 rounded-full bg-[#0E1F36] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              <span>📊</span>
              Resultados
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isLocked) fileInputRef.current?.click();
                }}
                disabled={isImporting || isLocked}
                className={`rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-[#0E1F36] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isImporting ? "Importando..." : "Importar Excel"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelChange}
              />
            </div>

            <button
              onClick={openAddModal}
              disabled={isLocked}
              className={`rounded-full bg-[#26A143] px-5 py-2 text-sm font-medium text-white hover:brightness-110 ${
                isLocked ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              + Agregar País
            </button>
          </div>
        </div>

        {/* contenido */}
        {loading ? (
          <p className="text-sm text-zinc-500">Cargando...</p>
        ) : scenarioCats.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Este escenario no tiene entornos.
          </p>
        ) : (
          scenarioCats.map((sc) => {
            const indicators = sc.indicators;

            return (
              <div
                key={sc.category_id}
                className="rounded-3xl bg-white shadow"
              >
                {/* header entorno */}
                <div className="flex flex-col items-center gap-1 rounded-t-3xl bg-[#0E1F36] px-4 py-3 sm:px-6">
                  <p className="text-xl font-semibold text-white">{sc.name}</p>
                  <p className="text-sm text-white/80">
                    {(sc.weight * 100).toFixed(0)}%
                  </p>
                </div>

                {/* tabla con scroll horizontal */}
                <div className="px-0 py-3">
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-[#0E1F36] text-white/90">
                          <th className="w-40 rounded-tl-3xl py-2 pl-4 text-left sm:pl-6">
                            País
                          </th>
                          {indicators.map((ind) => {
                            const isDmp = ind.value_type === "DMP";
                            const colorClass = isDmp
                              ? "text-emerald-300"
                              : "text-red-300";
                            const w = indicatorWeightsMap[ind.id];
                            return (
                              <th
                                key={ind.id}
                                className="py-2 text-center align-bottom"
                              >
                                <div className="flex flex-col items-center gap-1 px-2">
                                  <span
                                    className={`text-xs font-semibold ${colorClass}`}
                                  >
                                    {ind.name}
                                  </span>
                                  <span className="text-[10px] text-white/40">
                                    {ind.value_type}
                                  </span>
                                  <span className="text-[10px] text-white/70">
                                    {w !== undefined
                                      ? `${Math.round(w * 100)}%`
                                      : "—"}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                          <th className="rounded-tr-3xl py-2 pr-4 text-right sm:pr-6">
                            Acciones
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {/* antes de normalización */}
                        <tr>
                          <td
                            colSpan={indicators.length + 2}
                            className="bg-[#E9EAED] py-1 text-center text-[11px] font-semibold text-[#0E1F36]"
                          >
                            Valores antes de la normalización
                          </td>
                        </tr>
                        {filteredCountryIds.map((cid) => (
                          <tr
                            key={`raw-${sc.category_id}-${cid}`}
                            className="border-b"
                          >
                            <td className="py-2 pl-4 text-[#0E1F36] sm:pl-6">
                              {getCountryName(cid)}
                            </td>
                            {indicators.map((ind) => {
                              const val = indicatorValues.find(
                                (v) =>
                                  v.country_id === cid &&
                                  v.indicator_id === ind.id
                              );
                              return (
                                <td
                                  key={ind.id}
                                  className="py-2 text-center text-[#0E1F36]"
                                >
                                  {val?.raw_value ?? "—"}
                                </td>
                              );
                            })}
                            <td className="py-2 pr-4 sm:pr-6">
                              <div className="flex justify-end gap-2">
                                {!isLocked && (
                                  <button
                                    onClick={() => openEditModal(cid)}
                                    className="text-[#0E1F36] hover:text-[#0E1F36]/70"
                                    title="Editar"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* después de normalización */}
                        <tr>
                          <td
                            colSpan={indicators.length + 2}
                            className="bg-[#E9EAED] py-1 text-center text-[11px] font-semibold text-[#0E1F36]"
                          >
                            Valores después de la normalización
                          </td>
                        </tr>
                        {filteredCountryIds.map((cid) => (
                          <tr
                            key={`norm-${sc.category_id}-${cid}`}
                            className="border-b last:border-none"
                          >
                            <td className="py-2 pl-4 text-[#0E1F36] sm:pl-6">
                              {getCountryName(cid)}
                            </td>
                            {indicators.map((ind) => {
                              const val = indicatorValues.find(
                                (v) =>
                                  v.country_id === cid &&
                                  v.indicator_id === ind.id
                              );
                              return (
                                <td
                                  key={ind.id}
                                  className="py-2 text-center text-[#0E1F36]"
                                >
                                  {val?.normalized_value ?? "—"}
                                </td>
                              );
                            })}
                            <td className="py-2 pr-4 sm:pr-6">
                              <div className="flex flex-wrap justify-end gap-1">
                                {!isLocked &&
                                  indicators.map((ind) => {
                                    const val = indicatorValues.find(
                                      (v) =>
                                        v.country_id === cid &&
                                        v.indicator_id === ind.id
                                    );
                                    if (!val) return null;
                                    return (
                                      <button
                                        key={val.id}
                                        onClick={() => askDelete(val)}
                                        className="text-red-500 hover:text-red-400"
                                        title="Eliminar registro"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    );
                                  })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="px-4 py-2 text-[11px] text-zinc-500 sm:px-6">
                    Mostrando {filteredCountryIds.length} de{" "}
                    {usedCountryIds.length} países.
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-[9999] rounded-xl px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* MODAL ADD / EDIT */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={selectedCountryId ? "Editar País" : "Agregar País"}
      >
        <form
          onSubmit={handleSave}
          className="max-h-[80vh] space-y-5 overflow-y-auto pr-2"
        >
          {/* selector país con buscador */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              País
            </label>
            <input
              value={countrySearch}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                setShowCountryList(true);
              }}
              onFocus={() => setShowCountryList(true)}
              placeholder="Escriba un país..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm outline-none"
              disabled={isLocked}
            />

            {showCountryList &&
              countrySearch.trim() !== "" &&
              !isLocked && (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow">
                  {countries
                    .filter(
                      (c) =>
                        c.name_es
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase()) ||
                        c.name_en
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase()) ||
                        c.iso2
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase()) ||
                        c.iso3
                          .toLowerCase()
                          .includes(countrySearch.toLowerCase())
                    )
                    .slice(0, 20)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCountrySearch(c.name_es);
                          setShowCountryList(false);
                          setSelectedCountryId(c.id);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                      >
                        {c.name_es}{" "}
                        <span className="text-xs text-zinc-400">
                          ({c.iso2.toUpperCase()})
                        </span>
                      </button>
                    ))}
                  {countries.filter((c) =>
                    c.name_es
                      .toLowerCase()
                      .includes(countrySearch.toLowerCase())
                  ).length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">
                      No se encontraron países
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* bloques por entorno */}
          {scenarioCats.map((sc) => (
            <div key={sc.category_id}>
              <p className="mb-2 text-sm font-semibold text-zinc-700">
                {sc.name}
              </p>
              <div className="space-y-2">
                {sc.indicators.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    Este entorno no tiene indicadores.
                  </p>
                ) : (
                  sc.indicators.map((ind) => {
                    const isDmp = ind.value_type === "DMP";
                    const colorClass = isDmp
                      ? "text-emerald-600"
                      : "text-red-500";

                    const min = ind.min_value;
                    const max = ind.max_value;

                    return (
                      <div
                        key={ind.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          <label className={`block text-sm ${colorClass}`}>
                            {ind.name}{" "}
                            <span className="text-xs text-zinc-400">
                              ({ind.value_type})
                            </span>
                          </label>
                          <p className="text-[11px] text-zinc-500">
                            Escala{" "}
                            {min !== null && min !== undefined ? min : "—"} -{" "}
                            {max !== null && max !== undefined ? max : "—"}
                          </p>
                        </div>
                        <input
                          type="number"
                          value={valuesBuffer[ind.id] ?? ""}
                          onChange={(e) =>
                            setValuesBuffer((prev) => ({
                              ...prev,
                              [ind.id]: e.target.value,
                            }))
                          }
                          className="w-24 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-right text-sm outline-none"
                          disabled={isLocked}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}

          <button
            className={`w-full rounded-full bg-[#0E1F36] py-2 font-medium text-white ${
              isLocked ? "cursor-not-allowed opacity-60" : ""
            }`}
            disabled={isLocked}
          >
            Guardar
          </button>
        </form>
      </Modal>

      {/* MODAL DELETE */}
      <Modal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        title="Eliminar valor"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            ¿Seguro que deseas eliminar este valor?
            <br />
            <span className="font-semibold">{deleteInfo}</span>
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpenDelete(false)}
              className="rounded-lg border px-4 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className={`rounded-lg bg-red-500 px-4 py-1.5 text-sm text-white ${
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
