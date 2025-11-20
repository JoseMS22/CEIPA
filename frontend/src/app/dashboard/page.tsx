// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { CategoryIndexChart } from "@/components/results/CategoryIndexChart";
import { GlobalIndexChart } from "@/components/results/GlobalIndexChart";
import type { CountryPoint } from "@/components/results/GlobalIndexMap";
import { getHeatColor } from "@/lib/heatColors";

const GlobalIndexMap = dynamic(
  () =>
    import("@/components/results/GlobalIndexMap").then(
      (mod) => mod.GlobalIndexMap
    ),
  { ssr: false }
);

type Scenario = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
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
  normalized_value: number | null; // 0..5
  loaded_at: string;
};

type Paginated<T> = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: T[];
};

const DISPLAY_SCALE = 5;

export default function DashboardPage() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [catWeights, setCatWeights] = useState<CategoryWeight[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [indicatorsByCat, setIndicatorsByCat] = useState<
    Record<number, Indicator[]>
  >({});
  const [countries, setCountries] = useState<Country[]>([]);
  const [indicatorValues, setIndicatorValues] = useState<IndicatorValue[]>([]);
  const [indicatorWeightsMap, setIndicatorWeightsMap] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [hasActiveScenario, setHasActiveScenario] = useState(true);

  const [selectedCountryIds, setSelectedCountryIds] = useState<number[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  const [openCountryDropdown, setOpenCountryDropdown] = useState(false);
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState(false);

  function toggleCountry(id: number) {
    setSelectedCountryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ---- loaders ----
  async function loadScenarioCategories(scenarioId: number) {
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
      params: { page: 1, limit: 500, only_enabled: true },
    });
    setCountries(data.items || []);
  }

  async function loadIndicatorValues(scenarioId: number) {
    const { data } = await api.get<Paginated<IndicatorValue>>(
      "/v1/indicator-values",
      {
        params: { scenario_id: scenarioId, page: 1, limit: 200 },
      }
    );
    setIndicatorValues(data.items || []);
  }

  async function loadIndicatorWeights(scenarioId: number) {
    const { data } = await api.get("/v1/weights/indicators", {
      params: { scenario_id: scenarioId },
    });
    const map: Record<number, number> = {};
    (data.items || []).forEach((it: any) => {
      map[it.indicator_id] = it.weight; // 0..1
    });
    setIndicatorWeightsMap(map);
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

  // Cargar escenario activo + datos
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Paginated<Scenario>>("/v1/scenarios", {
          params: { page: 1, limit: 50 },
        });

        const items = data.items || [];
        const activeScenario =
          items.find((s: any) => s.active === true) || null;

        if (!activeScenario) {
          setScenario(null);
          setHasActiveScenario(false);
          setLoading(false);
          return;
        }

        setScenario(activeScenario);
        setHasActiveScenario(true);

        const scenarioId = activeScenario.id;

        await Promise.all([
          loadScenarioCategories(scenarioId),
          loadAllCategories(),
          loadAllCountries(),
          loadIndicatorValues(scenarioId),
          loadIndicatorWeights(scenarioId),
        ]);
      } catch (err) {
        console.error("Error cargando escenario activo", err);
        setScenario(null);
        setHasActiveScenario(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (catWeights.length === 0) return;
    const ids = catWeights.map((c) => c.category_id);
    loadIndicatorsForCategories(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catWeights]);

  // ---- helpers / cálculos ----
  function getCategoryName(catId: number) {
    return allCategories.find((c) => c.id === catId)?.name || "—";
  }

  function getCountryName(id: number) {
    return countries.find((c) => c.id === id)?.name_es || "—";
  }

  function getCountryById(id: number): Country | undefined {
    return countries.find((c) => c.id === id);
  }

  const usedCountryIds = useMemo(
    () => Array.from(new Set(indicatorValues.map((v) => v.country_id))),
    [indicatorValues]
  );

  const visibleCountryIds = useMemo(() => {
    if (selectedCountryIds.length === 0) return usedCountryIds;
    return usedCountryIds.filter((id) => selectedCountryIds.includes(id));
  }, [selectedCountryIds, usedCountryIds]);

  type CategoryResult = {
    categoryId: number;
    categoryName: string;
    weight: number;
    valuesByCountry: Record<number, number>; // 0–5
  };

  const categoryResults: CategoryResult[] = useMemo(() => {
    if (catWeights.length === 0 || usedCountryIds.length === 0) return [];

    const results: CategoryResult[] = [];

    for (const cw of catWeights) {
      const indicators = indicatorsByCat[cw.category_id] || [];
      const indicatorIds = indicators.map((i) => i.id);

      if (indicatorIds.length === 0) continue;

      const effectiveWeights: Record<number, number> = {};
      let sumConfigured = 0;

      indicatorIds.forEach((id) => {
        const w = indicatorWeightsMap[id];
        if (w !== undefined) sumConfigured += w;
      });

      if (sumConfigured > 0) {
        indicatorIds.forEach((id) => {
          const w = indicatorWeightsMap[id];
          if (w !== undefined) effectiveWeights[id] = w / sumConfigured;
        });
      } else {
        const equalW = 1 / indicatorIds.length;
        indicatorIds.forEach((id) => {
          effectiveWeights[id] = equalW;
        });
      }

      const valuesByCountry: Record<number, number> = {};

      usedCountryIds.forEach((cid) => {
        let sum = 0;
        let wSum = 0;

        indicatorIds.forEach((id) => {
          const v = indicatorValues.find(
            (iv) => iv.country_id === cid && iv.indicator_id === id
          );
          if (v?.normalized_value === null || v?.normalized_value === undefined)
            return;
          const w = effectiveWeights[id] ?? 0;
          sum += v.normalized_value * w;
          wSum += w;
        });

        if (wSum > 0) {
          valuesByCountry[cid] = sum / wSum; // 0–5
        }
      });

      results.push({
        categoryId: cw.category_id,
        categoryName: getCategoryName(cw.category_id),
        weight: cw.weight,
        valuesByCountry,
      });
    }

    return results;
  }, [
    catWeights,
    indicatorsByCat,
    indicatorValues,
    usedCountryIds,
    indicatorWeightsMap,
    allCategories,
  ]);

  type GlobalResult = {
    countryId: number;
    countryName: string;
    index: number; // 0–5
  };

  const globalResults: GlobalResult[] = useMemo(() => {
    if (categoryResults.length === 0 || usedCountryIds.length === 0) return [];

    const arr: GlobalResult[] = [];

    usedCountryIds.forEach((cid) => {
      let sum = 0;
      let wSum = 0;

      categoryResults.forEach((cr) => {
        const v = cr.valuesByCountry[cid];
        if (v === undefined) return;
        sum += v * cr.weight;
        wSum += cr.weight;
      });

      if (wSum > 0) {
        arr.push({
          countryId: cid,
          countryName: getCountryName(cid),
          index: sum / wSum, // 0–5
        });
      }
    });

    arr.sort((a, b) => b.index - a.index);
    return arr;
  }, [categoryResults, usedCountryIds, countries]);

  const visibleCategoryResults = useMemo(() => {
    if (selectedCategoryIds.length === 0) return categoryResults;
    return categoryResults.filter((c) =>
      selectedCategoryIds.includes(c.categoryId)
    );
  }, [selectedCategoryIds, categoryResults]);

  const visibleGlobalResults = useMemo(() => {
    const countrySet = new Set(visibleCountryIds);
    return globalResults.filter((g) => countrySet.has(g.countryId));
  }, [globalResults, visibleCountryIds]);

  const categoryChartData = useMemo(
    () =>
      visibleCategoryResults.map((cr) => ({
        categoryName: cr.categoryName,
        valuesByCountry: Object.fromEntries(
          visibleCountryIds.map((cid) => [
            getCountryName(cid),
            cr.valuesByCountry[cid] ?? 0,
          ])
        ),
      })),
    [visibleCategoryResults, visibleCountryIds, countries]
  );

  const globalChartData = useMemo(
    () =>
      visibleGlobalResults.map((g) => ({
        countryName: g.countryName,
        index: g.index,
      })),
    [visibleGlobalResults]
  );

  const mapData: CountryPoint[] = useMemo(
    () =>
      visibleGlobalResults
        .map((g) => {
          const country = getCountryById(g.countryId);
          const iso3 = country?.iso3?.toUpperCase();

          if (!iso3) return null;

          return {
            countryId: g.countryId,
            countryName: g.countryName,
            iso3,
            index: g.index,
            envs: categoryResults.map((cr) => ({
              categoryId: cr.categoryId,
              name: cr.categoryName,
              value: cr.valuesByCountry[g.countryId],
            })),
          } as CountryPoint;
        })
        .filter((item): item is CountryPoint => item !== null),
    [visibleGlobalResults, categoryResults, countries]
  );

  // ---- render ----
  return (
    <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header responsive */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#0E1F36]">
            Panel principal
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {scenario
              ? `Escenario activo: ${scenario.name}`
              : "Sin escenario activo"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 mt-6">Cargando resultados...</p>
      ) : !hasActiveScenario || !scenario ? (
        <p className="text-sm text-zinc-500 mt-6">
          No hay ningún escenario activo. Activa un escenario para ver sus
          resultados en el panel.
        </p>
      ) : usedCountryIds.length === 0 ? (
        <p className="text-sm text-zinc-500 mt-6">
          El escenario activo aún no tiene valores cargados.
        </p>
      ) : (
        <>
          {/* Filtros – en móvil se pegan a la derecha pero con wrap */}
          <div className="mt-4 flex flex-wrap gap-3 justify-end">
            {/* Dropdown de países */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenCountryDropdown((o) => !o)}
                className="flex items-center gap-2 rounded-full bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm border border-zinc-300 shadow-sm"
              >
                <span className="font-medium text-[#0E1F36]">Países</span>
                <span className="text-[11px] sm:text-xs text-zinc-500">
                  {selectedCountryIds.length === 0
                    ? "Todos"
                    : `${selectedCountryIds.length} seleccionado(s)`}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {openCountryDropdown ? "▲" : "▼"}
                </span>
              </button>

              {openCountryDropdown && (
                <div className="absolute right-0 mt-2 w-60 max-w-[90vw] bg-white border border-zinc-200 rounded-2xl shadow-lg p-3 z-20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#0E1F36]">
                      Filtrar por países
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCountryIds([])}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {usedCountryIds.map((cid) => {
                      const checked = selectedCountryIds.includes(cid);
                      return (
                        <label
                          key={cid}
                          className="flex items-center gap-2 text-xs cursor-pointer px-1 py-1 rounded-md hover:bg-zinc-50"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={checked}
                            onChange={() => toggleCountry(cid)}
                          />
                          <span
                            className={
                              checked
                                ? "font-medium text-[#0E1F36]"
                                : "text-zinc-700"
                            }
                          >
                            {getCountryName(cid)}
                          </span>
                        </label>
                      );
                    })}
                    {usedCountryIds.length === 0 && (
                      <p className="text-[11px] text-zinc-400">
                        No hay países con datos.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dropdown de entornos */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenCategoryDropdown((o) => !o)}
                className="flex items-center gap-2 rounded-full bg-white px-3 sm:px-4 py-1.5 text-xs sm:text-sm border border-zinc-300 shadow-sm"
              >
                <span className="font-medium text-[#0E1F36]">Entornos</span>
                <span className="text-[11px] sm:text-xs text-zinc-500">
                  {selectedCategoryIds.length === 0
                    ? "Todos"
                    : `${selectedCategoryIds.length} seleccionado(s)`}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {openCategoryDropdown ? "▲" : "▼"}
                </span>
              </button>

              {openCategoryDropdown && (
                <div className="absolute right-0 mt-2 w-60 max-w-[90vw] bg-white border border-zinc-200 rounded-2xl shadow-lg p-3 z-20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#0E1F36]">
                      Filtrar por entornos
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryIds([])}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {catWeights.map((cw) => {
                      const checked = selectedCategoryIds.includes(
                        cw.category_id
                      );
                      return (
                        <label
                          key={cw.category_id}
                          className="flex items-center gap-2 text-xs cursor-pointer px-1 py-1 rounded-md hover:bg-zinc-50"
                        >
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={checked}
                            onChange={() => toggleCategory(cw.category_id)}
                          />
                          <span
                            className={
                              checked
                                ? "font-medium text-[#0E1F36]"
                                : "text-zinc-700"
                            }
                          >
                            {getCategoryName(cw.category_id)}
                          </span>
                        </label>
                      );
                    })}
                    {catWeights.length === 0 && (
                      <p className="text-[11px] text-zinc-400">
                        No hay entornos configurados.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tarjetas / visualizaciones */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
              <h2 className="mb-3 text-base sm:text-lg font-semibold text-zinc-800">
                Índice ponderado por entorno
              </h2>
              <div className="w-full h-[240px] sm:h-[260px] md:h-72">
                <CategoryIndexChart results={categoryChartData} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4">
              <h2 className="mb-3 text-base sm:text-lg font-semibold text-zinc-800">
                Índice global comparado entre países
              </h2>
              <div className="w-full h-[240px] sm:h-[260px] md:h-64">
                <GlobalIndexChart results={globalChartData} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 md:col-span-2">
              <h2 className="mb-3 text-base sm:text-lg font-semibold text-zinc-800">
                Mapa interactivo de índices globales por país
              </h2>
              <div className="w-full rounded-2xl sm:rounded-3xl bg-white shadow p-2 sm:p-4">
                <GlobalIndexMap data={mapData} />
              </div>
            </section>


            <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 md:col-span-2">
              <h2 className="mb-3 text-base sm:text-lg font-semibold text-zinc-800">
                Ranking de países según índice global
              </h2>
              {/* 👇 Scroll horizontal en móvil para no romper layout */}
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[320px] text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left pl-2">Posición</th>
                      <th className="py-2 text-left">País</th>
                      <th className="py-2 text-right pr-2">
                        Índice global (0–{DISPLAY_SCALE})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGlobalResults.map((g, index) => (
                      <tr
                        key={g.countryId}
                        className="border-b last:border-none"
                      >
                        <td className="py-1.5 pl-2">{index + 1}</td>
                        <td className="py-1.5">{g.countryName}</td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2.5 sm:h-3 rounded-full bg-zinc-200 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(g.index / 5) * 100}%`,
                                  backgroundColor: getHeatColor(g.index),
                                }}
                              />
                            </div>
                            <span className="text-xs sm:text-sm font-medium text-[#0E1F36] w-10 text-right">
                              {g.index.toFixed(2)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] sm:text-[11px] text-zinc-500">
                * Valores más altos indican mayor riesgo (o desempeño, según
                cómo hayas definido la normalización).
              </p>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
