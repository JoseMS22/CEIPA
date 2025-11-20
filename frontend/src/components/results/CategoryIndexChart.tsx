// src/components/results/CategoryIndexChart.tsx
"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useEffect, useState } from "react";
import { getHeatColor } from "@/lib/heatColors";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type CategoryResultForChart = {
  categoryName: string;
  valuesByCountry: Record<string, number>; // nombre país -> índice 0–5
};

type CategoryIndexChartProps = {
  results: CategoryResultForChart[];
};

export function CategoryIndexChart({ results }: CategoryIndexChartProps) {
  const [isSmall, setIsSmall] = useState(false);

  // detectar si estamos en pantalla pequeña
  useEffect(() => {
    const check = () => {
      if (typeof window !== "undefined") {
        setIsSmall(window.innerWidth < 768); // md breakpoint
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (results.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay datos suficientes para calcular los índices por entorno.
      </p>
    );
  }

  const labels = results.map((r) => r.categoryName);

  // conjunto de países
  const countryNames = Array.from(
    new Set(results.flatMap((r) => Object.keys(r.valuesByCountry)))
  );

  const datasets = countryNames.map((country) => {
    const data = labels.map(
      (label) =>
        results.find((r) => r.categoryName === label)?.valuesByCountry[
          country
        ] ?? 0
    );

    const avg = data.reduce((acc, v) => acc + v, 0) / (data.length || 1);

    return {
      label: country,
      data,
      backgroundColor: getHeatColor(avg),
    };
  });

  const chartData = {
    labels,
    datasets,
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false, // 👈 CLAVE para que use el alto del contenedor
    scales: {
      y: {
        beginAtZero: true,
        max: 5,
        title: {
          display: true,
          text: "Índice (0–5)",
          font: {
            size: isSmall ? 11 : 13,
          },
        },
        ticks: {
          font: {
            size: isSmall ? 10 : 12,
          },
        },
      },
      x: {
        ticks: {
          font: {
            size: isSmall ? 10 : 12,
          },
          maxRotation: isSmall ? 40 : 0,
          minRotation: isSmall ? 0 : 0,
        },
      },
    },
    plugins: {
      legend: {
        position: isSmall ? "bottom" : "right",
        labels: {
          font: {
            size: isSmall ? 10 : 12,
          },
        },
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}
