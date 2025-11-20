"use client";

import {
  useEffect,
  useMemo,
  useState,
  Fragment,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L, {
  PathOptions,
  Map as LeafletMap,
  LatLngBounds,
} from "leaflet";

import "leaflet/dist/leaflet.css";
import { getHeatColor } from "@/lib/heatColors";

/* ========= Tipos ========= */

export type CountryEnv = {
  categoryId: number;
  name: string;
  value?: number;
};

export type CountryPoint = {
  countryId: number;
  countryName: string;
  iso3: string;
  index: number;
  envs: CountryEnv[];
};

export type GlobalIndexMapProps = {
  data: CountryPoint[];
};

export type GlobalIndexMapRef = {
  getMapInstance: () => LeafletMap | null;
};

/* ========= Componente ========= */

export const GlobalIndexMap = forwardRef<GlobalIndexMapRef, GlobalIndexMapProps>(
  function GlobalIndexMap({ data }, ref) {
    // evitar problemas en SSR
    if (typeof window === "undefined") return null;

    const [selected, setSelected] = useState<CountryPoint | null>(null);
    const [worldData, setWorldData] = useState<FeatureCollection | null>(null);
    const mapInstanceRef = useRef<LeafletMap | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getMapInstance: () => mapInstanceRef.current,
      }),
      []
    );

    useEffect(() => {
      setSelected(data[0] ?? null);
    }, [data]);

    // Cargar GeoJSON
    useEffect(() => {
      fetch("/world_countries.json")
        .then((res) => res.json())
        .then((json: FeatureCollection) => {
          setWorldData(json);
        })
        .catch((err) => {
          console.error("Error cargando world_countries.json", err);
        });
    }, []);

    // Mapa ISO3 -> datos
    const countryMap = useMemo(() => {
      const map = new Map<string, CountryPoint>();
      data.forEach((c) => {
        if (c.iso3) {
          map.set(c.iso3.toUpperCase(), c);
        }
      });
      return map;
    }, [data]);

    // Ajustar zoom a países con datos
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!worldData || !map || data.length === 0) return;

      map.invalidateSize();

      const scenarioIso3 = new Set(data.map((d) => d.iso3.toUpperCase()));

      let bounds: LatLngBounds | null = null;

      (worldData.features || []).forEach((feature: any) => {
        const props = feature.properties || {};
        const iso3 =
          (props.ISO_A3 as string | undefined)?.toUpperCase() ||
          (props.ISO3 as string | undefined)?.toUpperCase();

        if (!iso3 || !scenarioIso3.has(iso3)) return;

        const layer = L.geoJSON(feature);
        const fbounds = layer.getBounds();
        layer.remove();

        if (!bounds) bounds = fbounds;
        else bounds.extend(fbounds);
      });

      if (!bounds) return;

      const safeBounds = bounds as LatLngBounds;
      if (!safeBounds.isValid()) return;

      map.fitBounds(safeBounds, {
        padding: [20, 20],
        maxZoom: 3,
      });
    }, [worldData, data]);

    const styleFn = (feature: Feature<Geometry, any>): PathOptions => {
      if (!feature) {
        return {
          color: "#CCCCCC",
          fillColor: "#E5E7EB",
          fillOpacity: 0.3,
          weight: 0.5,
        };
      }

      const props = (feature.properties ?? {}) as any;

      const iso3 =
        (props.ISO_A3 as string | undefined)?.toUpperCase() ||
        (props.ISO3 as string | undefined)?.toUpperCase();

      const point = iso3 ? countryMap.get(iso3) : undefined;

      if (point) {
        const color = getHeatColor(point.index);
        return {
          color: "#FFFFFF",
          fillColor: color,
          fillOpacity: 0.7,
          weight: 1,
        };
      }

      return {
        color: "#CCCCCC",
        fillColor: "#E5E7EB",
        fillOpacity: 0.3,
        weight: 0.5,
      };
    };

    const onEachCountry = (feature: Feature<Geometry, any>, layer: L.Layer) => {
      const props = (feature.properties ?? {}) as any;

      const iso3 =
        (props.ISO_A3 as string | undefined)?.toUpperCase() ||
        (props.ISO3 as string | undefined)?.toUpperCase();

      if (!iso3) return;

      const point = countryMap.get(iso3);
      if (!point) return;

      layer.on("click", () => {
        setSelected(point);
      });
    };

    if (!worldData) {
      return (
        <div className="flex h-64 sm:h-72 items-center justify-center text-xs text-zinc-500">
          Cargando mapa...
        </div>
      );
    }

    return (
      <div className="flex flex-col lg:flex-row w-full">
        {/* Mapa */}
        <div className="w-full lg:flex-1 h-64 sm:h-72 md:h-80 lg:h-[420px]">
          <MapContainer
            ref={mapInstanceRef}
            center={[15, -40]}
            zoom={2}
            scrollWheelZoom={false}
            preferCanvas={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <GeoJSON
              data={worldData as any}
              style={styleFn as any}
              onEachFeature={onEachCountry as any}
            />
          </MapContainer>
        </div>

        {/* Panel derecho / abajo en móvil */}
        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3 mt-4 lg:mt-0">
          <h3 className="text-base font-semibold text-[#0E1F36]">
            {selected ? selected.countryName : "Selecciona un país"}
          </h3>

          <div>
            <div className="text-2xl font-bold text-[#1A2E4A]">
              {selected ? selected.index.toFixed(2) : "—"}
            </div>
            <div className="text-xs text-zinc-500">Índice global (0–5)</div>
          </div>

          {selected && (
            <div className="space-y-2 text-xs">
              {selected.envs.map((env) => (
                <Fragment key={env.categoryId}>
                  {renderBarRow(env.name, env.value)}
                </Fragment>
              ))}
            </div>
          )}

          <div className="mt-2 text-xs text-zinc-600">
            Escala de colores (0–5)
            <div className="h-3 rounded-full mt-1 bg-[linear-gradient(to_right,#8B0000,#FFD700,#006400)]" />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
              <span>0</span>
              <span>2.5</span>
              <span>5</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 mt-auto">
            Haz clic en un país del mapa para ver su detalle.
          </p>
        </aside>
      </div>
    );
  }
);

/* ========= Helper para filas de barras ========= */

function renderBarRow(label: string, value?: number) {
  if (value === undefined || value === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-28 text-xs text-zinc-700">{label}</div>
        <div className="flex-1 h-3 rounded-full bg-zinc-200" />
        <span className="text-[11px] text-zinc-400">—</span>
      </div>
    );
  }

  const pct = (value / 5) * 100;
  const color = getHeatColor(value);

  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-xs text-zinc-700">{label}</div>
      <div className="flex-1 h-3 rounded-full bg-zinc-200 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-[11px] bg-zinc-100 rounded-full px-2 py-[2px] text-[#1A2E4A]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
