// src/components/results/GlobalIndexChart.tsx
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

export type GlobalResultForChart = {
  countryName: string;
  index: number; // 0–5
};

type GlobalIndexChartProps = {
  results: GlobalResultForChart[];
};

export function GlobalIndexChart({ results }: GlobalIndexChartProps) {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof window !== "undefined") {
        setIsSmall(window.innerWidth < 768);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (results.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No hay datos suficientes para el índice global.
      </p>
    );
  }

  const labels = results.map((r) => r.countryName);
  const values = results.map((r) => r.index); // ya está en 0–5

  const chartData = {
    labels,
    datasets: [
      {
        label: "Índice global (0–5)",
        data: values,
        backgroundColor: values.map((v) => getHeatColor(v)),
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false, // 👈 igual que antes
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
        display: false, // solo una serie → sin leyenda
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
