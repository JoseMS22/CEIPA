// frontend/src/types/leaflet-image.d.ts
declare module "leaflet-image" {
  import type * as L from "leaflet";

  // Firma simplificada
  export default function leafletImage(
    map: L.Map,
    callback: (err: any, canvas: HTMLCanvasElement) => void
  ): void;
}
