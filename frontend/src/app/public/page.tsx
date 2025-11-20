"use client";

import Image from "next/image";
import Link from "next/link";

export default function PublicPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#E9EAED] text-[#0E1F36] p-6">
      <div className="max-w-lg text-center space-y-4">
        <Image
          src="/ceipa-logo.png"
          alt="CEIPA"
          width={160}
          height={50}
          className="mx-auto"
          priority
        />

        <h1 className="text-2xl font-semibold mt-4">
          Herramienta de Análisis de Riesgo Geopolítico
        </h1>

        <p className="text-sm text-zinc-600">
          Plataforma desarrollada para la evaluación, visualización y comparación
          de indicadores de riesgo geopolítico en distintos países.
        </p>

        <div className="pt-6">
          <Link
            href="/dashboard"
            className="rounded-full bg-[#0E1F36] text-white px-6 py-2 font-medium hover:brightness-110"
          >
            Ir al Panel de Administración
          </Link>
        </div>
      </div>
    </div>
  );
}
