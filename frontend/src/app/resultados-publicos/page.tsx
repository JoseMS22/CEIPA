"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "@/lib/api";
import { CategoryIndexChart } from "@/components/results/CategoryIndexChart";
import { GlobalIndexChart } from "@/components/results/GlobalIndexChart";
import { getHeatColor } from "@/lib/heatColors";
import Image from "next/image";
import dynamic from "next/dynamic";
import jsPDF from "jspdf";
import leafletImage from "leaflet-image";

import type {
  CountryPoint,
  GlobalIndexMapRef,
} from "@/components/results/GlobalIndexMap";

const GlobalIndexMap = dynamic(
  () =>
    import("@/components/results/GlobalIndexMap").then(
      (mod) => mod.GlobalIndexMap
    ),
  { ssr: false }
);

/* ================== Tipos ================== */

type Scenario = {
  id: number;
  name: string;
  description?: string | null;
  active?: boolean;
};

type CategoryWeight = {
  category_id: number;
  weight: number;
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
  description?: string | null;
  source_name?: string | null;
  source_url?: string | null;
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

type DescriptionKey = "hero" | "chart_category" | "chart_global";

type PublicDescription = {
  id: number;
  key: DescriptionKey;
  title: string;
  content: string;
};

const DISPLAY_SCALE = 5;

/* ===== Textos por defecto si no hay nada en BD ===== */

const DEFAULT_PUBLIC_TEXT: Record<DescriptionKey, string> = {
  hero:
    "Visualiza el desempeño de los países en diferentes entornos de riesgo geopolítico. Los valores se normalizan en una escala de 0 a 5 y se combinan mediante ponderaciones definidas por el equipo académico.",
  chart_category:
    "Cada entorno se calcula como un promedio ponderado de los indicadores asociados. Los valores más altos indican mayor nivel de riesgo o exposición, dependiendo de la interpretación de cada indicador.",
  chart_global:
    "El índice global combina los distintos entornos mediante ponderaciones definidas en el escenario activo. Esto permite comparar rápidamente el nivel de riesgo relativo entre países.",
};

/* ===== Helper HEX → RGB (para jsPDF) ===== */

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/* ================== Página pública ================== */

export default function PublicResultsPage() {
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

  // filtros gráficas
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

  // descripciones públicas
  const [publicText, setPublicText] = useState<Record<DescriptionKey, string>>({
    hero: DEFAULT_PUBLIC_TEXT.hero,
    chart_category: DEFAULT_PUBLIC_TEXT.chart_category,
    chart_global: DEFAULT_PUBLIC_TEXT.chart_global,
  });

  // exportación PDF
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPdfCountries, setSelectedPdfCountries] = useState<number[]>([]);
  const [selectAllPdf, setSelectAllPdf] = useState(true);
  const [pdfCountrySearch, setPdfCountrySearch] = useState("");
  const mapRef = useRef<GlobalIndexMapRef | null>(null);

  /* ========== Loaders básicos ========== */

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
      map[it.indicator_id] = it.weight;
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

  /* ========== Cargar escenario activo ========== */

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
        console.error("Error cargando escenario activo (pública)", err);
        setScenario(null);
        setHasActiveScenario(false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // descripciones públicas
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<PublicDescription[]>(
          "/v1/public-descriptions"
        );

        const next: Record<DescriptionKey, string> = {
          ...DEFAULT_PUBLIC_TEXT,
        };

        (data || []).forEach((item) => {
          const key = item.key as DescriptionKey;
          const content = item.content?.trim();
          if (content) {
            next[key] = content;
          }
        });

        setPublicText(next);
      } catch (err) {
        console.error("Error cargando descripciones públicas", err);
      }
    })();
  }, []);

  // cargar indicadores al tener categorías
  useEffect(() => {
    if (catWeights.length === 0) return;
    const ids = catWeights.map((c) => c.category_id);
    loadIndicatorsForCategories(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catWeights]);

  /* ========== Helpers / cálculos ========== */

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
    valuesByCountry: Record<number, number>;
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
          valuesByCountry[cid] = sum / wSum;
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

  const visibleCategoryResults = useMemo(() => {
    if (selectedCategoryIds.length === 0) return categoryResults;
    return categoryResults.filter((c) =>
      selectedCategoryIds.includes(c.categoryId)
    );
  }, [selectedCategoryIds, categoryResults]);

  type GlobalResult = {
    countryId: number;
    countryName: string;
    index: number;
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
          index: sum / wSum,
        });
      }
    });

    arr.sort((a, b) => b.index - a.index);
    return arr;
  }, [categoryResults, usedCountryIds, countries]);

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

  const visibleGlobalResultsForCharts = useMemo(() => {
    const set = new Set(visibleCountryIds);
    return globalResults.filter((g) => set.has(g.countryId));
  }, [globalResults, visibleCountryIds]);

  const globalChartData = useMemo(
    () =>
      visibleGlobalResultsForCharts.map((g) => ({
        countryName: g.countryName,
        index: g.index,
      })),
    [visibleGlobalResultsForCharts]
  );

  const mapData: CountryPoint[] = useMemo(
    () =>
      globalResults
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
    [globalResults, categoryResults, countries]
  );

  const ranking = globalResults;

  /* ====== selección países PDF ====== */

  function togglePdfCountry(id: number) {
    setSelectedPdfCountries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const normalizedPdfSearch = pdfCountrySearch.trim().toLowerCase();
  const pdfCountryIdsForList =
    normalizedPdfSearch === ""
      ? usedCountryIds
      : usedCountryIds.filter((cid) =>
          getCountryName(cid).toLowerCase().includes(normalizedPdfSearch)
        );

  async function captureMapPng(): Promise<{
    dataUrl: string;
    width: number;
    height: number;
  } | null> {
    const mapInstance = mapRef.current?.getMapInstance();
    if (!mapInstance) {
      console.warn("No hay instancia de Leaflet disponible para capturar el mapa.");
      return null;
    }

    return await new Promise((resolve, reject) => {
      leafletImage(mapInstance as any, (err: any, canvas: HTMLCanvasElement) => {
        if (err) {
          console.error("Error en leaflet-image:", err);
          return reject(err);
        }
        try {
          const dataUrl = canvas.toDataURL("image/png");
          resolve({ dataUrl, width: canvas.width, height: canvas.height });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function drawPdfHeader(
    doc: jsPDF,
    pageWidth: number,
    marginX: number,
    scenarioName?: string | null
  ): number {
    const today = new Date();
    const dateStr = today.toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Informe de índices geopolíticos por país", pageWidth / 2, 15, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = 21;

    doc.text(`Fecha de generación: ${dateStr}`, pageWidth / 2, y, {
      align: "center",
    });
    y += 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, y, pageWidth - marginX, y);

    return y + 4;
  }

  async function handleExportPdf(onlySelected: boolean) {
    if (globalResults.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const countriesForPdf =
      onlySelected && selectedPdfCountries.length > 0
        ? globalResults.filter((g) => selectedPdfCountries.includes(g.countryId))
        : globalResults;

    if (countriesForPdf.length === 0) {
      alert("No hay países seleccionados para exportar.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;

    let y = drawPdfHeader(doc, pageWidth, marginX, scenario?.name);

    // 1) mapa
    try {
      const imgResult = await captureMapPng();

      if (imgResult) {
        const { dataUrl, width, height } = imgResult;

        const PX_TO_MM = 0.264583;
        const imgWidthMmReal = width * PX_TO_MM;
        const imgHeightMmReal = height * PX_TO_MM;

        const maxWidthMm = pageWidth - marginX * 2;
        const scale = Math.min(1, maxWidthMm / imgWidthMmReal);

        const renderWidthMm = imgWidthMmReal * scale;
        const renderHeightMm = imgHeightMmReal * scale;

        doc.addImage(
          dataUrl,
          "PNG",
          (pageWidth - renderWidthMm) / 2,
          y,
          renderWidthMm,
          renderHeightMm
        );
        y += renderHeightMm + 6;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(
          "Mapa de índices globales de riesgo geopolítico (0–5).",
          marginX,
          y
        );
        y += 8;
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(
          "Mapa no disponible en esta exportación (no se pudo capturar la instancia del mapa).",
          marginX,
          y
        );
        y += 10;
      }
    } catch (err) {
      console.error("Error al capturar el mapa con leaflet-image:", err);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(
        "Mapa no disponible en esta exportación por un error al capturarlo.",
        marginX,
        y
      );
      y += 10;
    }

    // 2) título sección detalle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Detalle por país", marginX, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Índice global y valores por entorno en escala 0–5.", marginX, y);
    y += 6;

    function newPageWithHeader() {
      doc.addPage();
      y = drawPdfHeader(doc, pageWidth, marginX, scenario?.name);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Detalle por país (continuación)", marginX, y);
      y += 6;
    }

    const lineHeight = 5;
    const barMaxWidth = 60;

    // 3) bloques por país
    countriesForPdf.forEach((country) => {
      if (y > pageHeight - 35) {
        newPageWithHeader();
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(
        `${country.countryName} — Índice global: ${country.index.toFixed(
          2
        )} / ${DISPLAY_SCALE}`,
        marginX,
        y
      );
      y += lineHeight;

      const barX = marginX;
      const barY = y - 3;
      const barWidth = (country.index / DISPLAY_SCALE) * barMaxWidth;
      const hexGlobal = getHeatColor(country.index);
      const { r: rG, g: gG, b: bG } = hexToRgb(hexGlobal);

      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(240, 240, 240);
      doc.rect(barX, barY, barMaxWidth, 4, "FD");

      doc.setFillColor(rG, gG, bG);
      doc.rect(barX, barY, barWidth, 4, "F");

      y += lineHeight;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const envs = categoryResults
        .map((cr) => ({
          name: cr.categoryName,
          value: cr.valuesByCountry[country.countryId],
        }))
        .filter((e) => e.value !== undefined);

      envs.forEach((env) => {
        if (env.value === undefined) return;

        if (y > pageHeight - 20) {
          newPageWithHeader();
        }

        const label = `- ${env.name}: ${env.value!.toFixed(
          2
        )} / ${DISPLAY_SCALE}`;
        doc.text(label, marginX, y);

        const envBarX = marginX + 70;
        const envBarY = y - 3;
        const envBarWidth =
          ((env.value as number) / DISPLAY_SCALE) * barMaxWidth;

        const hex = getHeatColor(env.value as number);
        const { r, g, b } = hexToRgb(hex);

        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(240, 240, 240);
        doc.rect(envBarX, envBarY, barMaxWidth, 4, "FD");

        doc.setFillColor(r, g, b);
        doc.rect(envBarX, envBarY, envBarWidth, 4, "F");

        y += lineHeight;
      });

      const blockBottom = y;
      doc.setDrawColor(235, 235, 235);
      doc.line(marginX, blockBottom, pageWidth - marginX, blockBottom);

      y += 3;
    });

    // numeración
    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      (doc as any).setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: "right" }
      );
    }

    doc.save("indices-geopoliticos.pdf");
  }

  /* ========== Indicadores: grid ========= */

  function renderIndicatorsGrid() {
    if (catWeights.length === 0) {
      return (
        <p className="text-sm text-zinc-500">
          Aún no hay entornos configurados para este escenario.
        </p>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {catWeights.map((cw) => {
          const catName = getCategoryName(cw.category_id);
          const indicators = indicatorsByCat[cw.category_id] || [];

          return (
            <div
              key={cw.category_id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <h4 className="mb-1 text-base font-semibold text-[#0E1F36]">
                {catName}
              </h4>
              <p className="mb-2 text-xs text-zinc-500">
                Peso del entorno:{" "}
                <span className="font-semibold">
                  {(cw.weight * 100).toFixed(1)}%
                </span>
              </p>

              {indicators.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Aún no hay indicadores configurados para este entorno.
                </p>
              ) : (
                <ul className="mt-1 space-y-2 text-xs">
                  {indicators.map((ind) => {
                    const w = indicatorWeightsMap[ind.id];
                    const weightPct =
                      w !== undefined ? (w * 100).toFixed(1) + "%" : "—";

                    return (
                      <li
                        key={ind.id}
                        className="border-t pt-2 first:border-t-0 first:pt-0"
                      >
                        <div className="font-semibold text-[#0E1F36]">
                          {ind.name}
                        </div>
                        <div className="mb-1 text-[11px] text-zinc-500">
                          Peso del indicador:{" "}
                          <span className="font-semibold">{weightPct}</span>
                        </div>
                        {ind.description && (
                          <p className="mb-1 text-[11px] text-zinc-500">
                            {ind.description}
                          </p>
                        )}
                        {ind.source_url && (
                          <a
                            href={ind.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            Fuente
                            {ind.source_name ? `: ${ind.source_name}` : ""}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ================== RENDER ================== */

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#1a1f36]">
      {/* HEADER */}
      <header className="bg-[#0E1F36] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/ceipa-logo.png"
              alt="CEIPA"
              width={260}
              height={80}
              priority
              className="h-12 w-auto md:h-16"
            />
          </div>

          <nav className="hidden gap-5 text-sm sm:flex">
            <a href="#explorar" className="opacity-90 hover:opacity-100">
              Resultados
            </a>
            <a href="#graficas" className="opacity-90 hover:opacity-100">
              Gráficas
            </a>
            <a href="#indicadores" className="opacity-90 hover:opacity-100">
              Indicadores
            </a>
            <a href="#ranking" className="opacity-90 hover:opacity-100">
              Ranking
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <h1 className="mb-2 text-2xl font-semibold text-[#0E1F36] md:text-3xl">
            Plataforma de Riesgos Geopolíticos
          </h1>

          <p className="mb-4 max-w-5xl text-sm leading-relaxed text-zinc-600 md:text-base">
            {publicText.hero}
          </p>

          <a
            href="#explorar"
            className="inline-flex items-center rounded-xl bg-[#0E1F36] px-4 py-2 text-sm text-white shadow-sm"
          >
            Explorar resultados
          </a>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-8 md:space-y-10 md:px-6">
        {loading ? (
          <p className="mt-6 text-sm text-zinc-500">
            Cargando resultados públicos...
          </p>
        ) : !hasActiveScenario || !scenario ? (
          <p className="mt-6 text-sm text-zinc-500">
            No hay ningún escenario activo disponible para vista pública.
          </p>
        ) : usedCountryIds.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            El escenario activo aún no tiene valores cargados.
          </p>
        ) : (
          <>
            {/* MAPA */}
            <section id="explorar" className="pt-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-[#0E1F36]">
                  Mapa interactivo de índices globales por país (0–5)
                </h2>

                <div className="overflow-hidden rounded-2xl border border-zinc-100">
                  <div className="h-[360px] sm:h-[420px] md:h-[520px]">
                    <GlobalIndexMap ref={mapRef} data={mapData} />
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-zinc-500">
                  Haz clic en un país del mapa para ver el detalle de sus
                  entornos y su índice global.
                </p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="max-w-md text-[11px] text-zinc-600">
                    Puedes exportar un PDF con el mapa y el resumen de los
                    países seleccionados.
                  </p>
                  <button
                    onClick={() => setIsPdfModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-[#0E1F36] px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#17294a]"
                  >
                    Exportar PDF
                  </button>
                </div>
              </div>
            </section>

            {/* GRÁFICAS */}
            <section id="graficas" className="space-y-6">
              {/* Índice por entorno */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-lg font-semibold text-[#0E1F36]">
                    Índice ponderado por entorno (0–5)
                  </h2>

                  <div className="flex flex-wrap gap-3 text-xs">
                    {/* Países */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenCountryDropdown((o) => !o)}
                        className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs shadow-sm"
                      >
                        <span className="font-medium text-[#0E1F36]">
                          Países
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {selectedCountryIds.length === 0
                            ? "Todos"
                            : `${selectedCountryIds.length} seleccionado(s)`}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {openCountryDropdown ? "▲" : "▼"}
                        </span>
                      </button>

                      {openCountryDropdown && (
                        <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
                          <div className="mb-2 flex items-center justify-between">
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

                          <div className="max-h-56 space-y-1 overflow-y-auto">
                            {usedCountryIds.map((cid) => {
                              const checked = selectedCountryIds.includes(cid);
                              return (
                                <label
                                  key={cid}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-zinc-50"
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

                    {/* Entornos */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenCategoryDropdown((o) => !o)}
                        className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs shadow-sm"
                      >
                        <span className="font-medium text-[#0E1F36]">
                          Entornos
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {selectedCategoryIds.length === 0
                            ? "Todos"
                            : `${selectedCategoryIds.length} seleccionado(s)`}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {openCategoryDropdown ? "▲" : "▼"}
                        </span>
                      </button>

                      {openCategoryDropdown && (
                        <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
                          <div className="mb-2 flex items-center justify-between">
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

                          <div className="max-h-56 space-y-1 overflow-y-auto">
                            {catWeights.map((cw) => {
                              const checked =
                                selectedCategoryIds.includes(cw.category_id);
                              return (
                                <label
                                  key={cw.category_id}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-zinc-50"
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
                </div>

                <div className="h-[260px] w-full md:h-[360px]">
                  <CategoryIndexChart results={categoryChartData} />
                </div>

                <p className="mt-3 text-xs text-zinc-600 md:text-sm">
                  {publicText.chart_category}
                </p>
              </div>

              {/* Índice global */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-lg font-semibold text-[#0E1F36]">
                    Índice global comparado entre países (0–5)
                  </h2>
                </div>

                <div className="h-[260px] w-full md:h-[360px]">
                  <GlobalIndexChart results={globalChartData} />
                </div>

                <p className="mt-3 text-xs text-zinc-600 md:text-sm">
                  {publicText.chart_global}
                </p>
              </div>
            </section>

            {/* RANKING */}
            <section id="ranking">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-[#0E1F36]">
                  Ranking de países según índice global (0–{DISPLAY_SCALE})
                </h2>

                <div className="divide-y divide-zinc-200 text-sm">
                  {ranking.map((r, idx) => {
                    const country = getCountryById(r.countryId);
                    const iso2 = country?.iso2?.toLowerCase();
                    return (
                      <div
                        key={r.countryId}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="w-6 text-right text-xs text-zinc-500">
                          {idx + 1}
                        </div>
                        <div className="w-8">
                          {iso2 ? (
                            <img
                              src={`https://flagcdn.com/w40/${iso2}.png`}
                              alt={r.countryName}
                              className="h-[18px] w-[26px] rounded-[2px] border border-zinc-300 object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1 text-sm font-medium">
                          {r.countryName}
                        </div>
                        <div className="flex w-40 items-center gap-2 sm:w-64">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(r.index / DISPLAY_SCALE) * 100}%`,
                                backgroundColor: getHeatColor(r.index),
                              }}
                            />
                          </div>
                          <div className="w-12 text-right text-sm font-semibold">
                            {r.index.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-2 text-[11px] text-zinc-500">
                  * Valores más altos indican mayor riesgo (o desempeño, según
                  cómo hayas definido la normalización).
                </p>
              </div>
            </section>

            {/* INDICADORES / ENTORNOS */}
            <section id="indicadores">
              <div className="mb-2">
                <h2 className="mb-2 text-lg font-semibold text-[#0E1F36]">
                  Detalle de entornos e indicadores
                </h2>
                <p className="text-xs text-zinc-500">
                  Cada entorno se compone de indicadores ponderados. Los pesos
                  aquí mostrados corresponden a la configuración actual del
                  escenario activo.
                </p>
              </div>

              {renderIndicatorsGrid()}
            </section>
          </>
        )}
      </main>

      <footer className="mt-6 border-t border-zinc-200 bg-white text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6">
          © CEIPA — Vista pública de resultados de riesgos geopolíticos
        </div>
      </footer>

      {/* Modal exportación PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-4 shadow-lg">
            <h3 className="mb-1 text-base font-semibold text-[#0E1F36]">
              Exportar datos a PDF
            </h3>
            <p className="mb-3 text-xs text-zinc-600">
              Selecciona los países que quieres incluir. Si marcas &quot;Todos
              los países&quot;, el PDF incluirá el mapa completo y el detalle de
              todos los países con datos.
            </p>

            <div className="mb-3 flex items-center gap-2 text-xs">
              <input
                id="select-all-pdf"
                type="checkbox"
                className="h-3 w-3"
                checked={selectAllPdf}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectAllPdf(checked);
                  if (checked) {
                    setSelectedPdfCountries([]);
                  }
                }}
              />
              <label
                htmlFor="select-all-pdf"
                className="cursor-pointer text-zinc-700"
              >
                Todos los países
              </label>
            </div>

            <div className="mb-2">
              <label className="mb-1 block text-[11px] text-zinc-600">
                Buscar país
              </label>
              <input
                type="text"
                value={pdfCountrySearch}
                onChange={(e) => setPdfCountrySearch(e.target.value)}
                placeholder="Escribe para filtrar..."
                className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E1F36]"
                disabled={selectAllPdf}
              />
            </div>

            <div
              className={`max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 ${
                selectAllPdf ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {pdfCountryIdsForList.map((cid) => (
                <label
                  key={cid}
                  className="flex cursor-pointer items-center gap-2 py-0.5 text-xs"
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={selectedPdfCountries.includes(cid)}
                    onChange={() => togglePdfCountry(cid)}
                  />
                  <span>{getCountryName(cid)}</span>
                </label>
              ))}
              {pdfCountryIdsForList.length === 0 && (
                <p className="text-[11px] text-zinc-500">
                  No hay países que coincidan con la búsqueda.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsPdfModalOpen(false);
                  await handleExportPdf(!selectAllPdf);
                }}
                className="rounded-lg bg-[#0E1F36] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#17294a]"
              >
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
