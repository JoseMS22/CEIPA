"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// 👉 Si luego usas <Marker />, descomenta esto (fix de iconos en Next):
// import L from "leaflet";
// import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
// import markerIcon from "leaflet/dist/images/marker-icon.png";
// import markerShadow from "leaflet/dist/images/marker-shadow.png";
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: markerIcon2x.src,
//   iconUrl: markerIcon.src,
//   shadowUrl: markerShadow.src,
// });

type Props = {
  center?: [number, number];
  zoom?: number;
  /** Alto del mapa. Si lo omites, controla el alto con Tailwind desde className (ej: 'h-96'). */
  height?: number | string;
  className?: string;
  /** Desactiva zoom wheel si necesitas */
  scrollWheelZoom?: boolean;
  /** Controla si el mapa usa world copy jump (útil en proyecciones globales) */
  worldCopyJump?: boolean;
};

export default function LeafletMap({
  center = [20, 0],
  zoom = 2,
  height,
  className,
  scrollWheelZoom = true,
  worldCopyJump = false,
}: Props) {
  // Evita recrear el objeto center en cada render
  const memoCenter = useMemo(() => center, [center]);

  return (
    <div
      className={className}
      style={height ? { height: typeof height === "number" ? `${height}px` : height } : undefined}
    >
      <MapContainer
        center={memoCenter}
        zoom={zoom}
        style={!height ? { height: "400px", width: "100%" } : { width: "100%", height: "100%" }}
        scrollWheelZoom={scrollWheelZoom}
        worldCopyJump={worldCopyJump}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}
