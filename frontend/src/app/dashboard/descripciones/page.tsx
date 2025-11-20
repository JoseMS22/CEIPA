"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type DescriptionKey = "hero" | "chart_category" | "chart_global";

type PublicDescription = {
  id: number;
  key: DescriptionKey;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};

const KEY_LABELS: Record<DescriptionKey, { title: string; helper: string }> = {
  hero: {
    title: "Descripción inicial de la página pública",
    helper:
      "Este texto aparece al inicio de la página pública, debajo del título “Plataforma de Riesgos Geopolíticos”.",
  },
  chart_category: {
    title: "Descripción del gráfico: Índice ponderado por entorno",
    helper:
      "Este texto aparece debajo del gráfico de columnas de entornos (civil, económico, relaciones internacionales, cultural).",
  },
  chart_global: {
    title: "Descripción del gráfico: Índice global comparado entre países",
    helper:
      "Este texto aparece debajo del gráfico de columnas de índice global por país.",
  },
};

const DEFAULT_CONTENT: Record<DescriptionKey, string> = {
  hero:
    "Visualiza el desempeño de los países en diferentes entornos de riesgo geopolítico. Los valores se normalizan en una escala de 0 a 5 y se combinan mediante ponderaciones definidas por el equipo académico.",
  chart_category:
    "Cada entorno se calcula como un promedio ponderado de los indicadores asociados. Los valores más altos indican mayor nivel de riesgo o exposición, dependiendo de la interpretación de cada indicador.",
  chart_global:
    "El índice global combina los distintos entornos mediante ponderaciones definidas en el escenario activo. Esto permite comparar rápidamente el nivel de riesgo relativo entre países.",
};

type FormState = {
  [K in DescriptionKey]: {
    id?: number;
    title: string;
    content: string;
  };
};

const INITIAL_FORM: FormState = {
  hero: {
    title: KEY_LABELS.hero.title,
    content: "",
  },
  chart_category: {
    title: KEY_LABELS.chart_category.title,
    content: "",
  },
  chart_global: {
    title: KEY_LABELS.chart_global.title,
    content: "",
  },
};

export default function PublicDescriptionsPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<DescriptionKey | null>(null);
  const [resettingKey, setResettingKey] = useState<DescriptionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar descripciones existentes desde el backend
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get<PublicDescription[]>(
          "/v1/public-descriptions"
        );

        const next: FormState = { ...INITIAL_FORM };

        (data || []).forEach((item) => {
          if (item.key in next) {
            const k = item.key as DescriptionKey;
            next[k] = {
              id: item.id,
              title: item.title || KEY_LABELS[k].title,
              content: item.content || "",
            };
          }
        });

        setForm(next);
      } catch (err) {
        console.error("Error cargando descripciones públicas", err);
        setError("No se pudieron cargar las descripciones.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleChangeContent(key: DescriptionKey, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        content: value,
      },
    }));
  }

  function handleChangeTitle(key: DescriptionKey, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        title: value,
      },
    }));
  }

  async function handleSave(key: DescriptionKey) {
    try {
      setSavingKey(key);
      setError(null);
      setSuccessMessage(null);

      const payload = {
        title: form[key].title || KEY_LABELS[key].title,
        content: form[key].content.trim(),
      };

      const { data } = await api.put<PublicDescription>(
        `/v1/public-descriptions/${key}`,
        payload
      );

      setForm((prev) => ({
        ...prev,
        [key]: {
          id: data.id,
          title: data.title,
          content: data.content,
        },
      }));

      setSuccessMessage("Descripciones guardadas correctamente.");
    } catch (err) {
      console.error("Error guardando descripción", err);
      setError("Ocurrió un error al guardar esta descripción.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleResetToDefault(key: DescriptionKey) {
    try {
      setResettingKey(key);
      setError(null);
      setSuccessMessage(null);

      await api.delete(`/v1/public-descriptions/${key}`);

      setForm((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          content: "",
        },
      }));

      setSuccessMessage(
        "Se restableció la descripción. La vista pública usará el texto por defecto."
      );
    } catch (err) {
      console.error("Error reseteando descripción", err);
      setError("No se pudo restablecer esta descripción.");
    } finally {
      setResettingKey(null);
    }
  }

  return (
    <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-0 py-5 sm:py-6 lg:py-8">
      <h1 className="text-xl sm:text-2xl font-semibold text-[#0E1F36] mb-2">
        Descripciones de la vista pública
      </h1>
      <p className="text-xs sm:text-sm text-zinc-600 mb-4">
        Aquí puedes definir los textos que se mostrarán en la página pública de
        resultados. Si dejas algún campo vacío o lo eliminas desde aquí, la
        vista pública usará un texto por defecto.
      </p>

      {loading && (
        <p className="text-sm text-zinc-500">Cargando descripciones...</p>
      )}

      {!loading && error && (
        <p className="text-xs sm:text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!loading && successMessage && (
        <p className="text-xs sm:text-sm text-green-700 mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {successMessage}
        </p>
      )}

      {!loading && (
        <div className="space-y-5 sm:space-y-6">
          {/* HERO */}
          <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm">
            <h2 className="text-sm sm:text-base font-semibold text-[#0E1F36] mb-1">
              {KEY_LABELS.hero.title}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 mb-3">
              {KEY_LABELS.hero.helper}
            </p>

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Título interno (opcional)
            </label>
            <input
              type="text"
              value={form.hero?.title ?? ""}
              onChange={(e) => handleChangeTitle("hero", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs sm:text-sm mb-3"
              placeholder={KEY_LABELS.hero.title}
            />

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Texto que verá el público
            </label>
            <textarea
              value={form.hero?.content ?? ""}
              onChange={(e) => handleChangeContent("hero", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs sm:text-sm min-h-[100px]"
              placeholder={DEFAULT_CONTENT.hero}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleSave("hero")}
                disabled={savingKey === "hero"}
                className="inline-flex items-center rounded-lg bg-[#0E1F36] px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
              >
                {savingKey === "hero" ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => handleResetToDefault("hero")}
                disabled={resettingKey === "hero"}
                className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {resettingKey === "hero"
                  ? "Restableciendo..."
                  : "Restablecer a texto por defecto"}
              </button>
            </div>
          </section>

          {/* GRÁFICO: ÍNDICE POR ENTORNO */}
          <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm">
            <h2 className="text-sm sm:text-base font-semibold text-[#0E1F36] mb-1">
              {KEY_LABELS.chart_category.title}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 mb-3">
              {KEY_LABELS.chart_category.helper}
            </p>

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Título interno (opcional)
            </label>
            <input
              type="text"
              value={form.chart_category?.title ?? ""}
              onChange={(e) =>
                handleChangeTitle("chart_category", e.target.value)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs sm:text-sm mb-3"
              placeholder={KEY_LABELS.chart_category.title}
            />

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Texto que verá el público
            </label>
            <textarea
              value={form.chart_category?.content ?? ""}
              onChange={(e) =>
                handleChangeContent("chart_category", e.target.value)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs sm:text-sm min-h-[90px]"
              placeholder={DEFAULT_CONTENT.chart_category}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleSave("chart_category")}
                disabled={savingKey === "chart_category"}
                className="inline-flex items-center rounded-lg bg-[#0E1F36] px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
              >
                {savingKey === "chart_category"
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => handleResetToDefault("chart_category")}
                disabled={resettingKey === "chart_category"}
                className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {resettingKey === "chart_category"
                  ? "Restableciendo..."
                  : "Restablecer a texto por defecto"}
              </button>
            </div>
          </section>

          {/* GRÁFICO: ÍNDICE GLOBAL */}
          <section className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm">
            <h2 className="text-sm sm:text-base font-semibold text-[#0E1F36] mb-1">
              {KEY_LABELS.chart_global.title}
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 mb-3">
              {KEY_LABELS.chart_global.helper}
            </p>

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Título interno (opcional)
            </label>
            <input
              type="text"
              value={form.chart_global?.title ?? ""}
              onChange={(e) =>
                handleChangeTitle("chart_global", e.target.value)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs sm:text-sm mb-3"
              placeholder={KEY_LABELS.chart_global.title}
            />

            <label className="block text-[11px] sm:text-xs font-medium text-zinc-600 mb-1">
              Texto que verá el público
            </label>
            <textarea
              value={form.chart_global?.content ?? ""}
              onChange={(e) =>
                handleChangeContent("chart_global", e.target.value)
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs sm:text-sm min-h-[90px]"
              placeholder={DEFAULT_CONTENT.chart_global}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleSave("chart_global")}
                disabled={savingKey === "chart_global"}
                className="inline-flex items-center rounded-lg bg-[#0E1F36] px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
              >
                {savingKey === "chart_global"
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={() => handleResetToDefault("chart_global")}
                disabled={resettingKey === "chart_global"}
                className="inline-flex items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {resettingKey === "chart_global"
                  ? "Restableciendo..."
                  : "Restablecer a texto por defecto"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
