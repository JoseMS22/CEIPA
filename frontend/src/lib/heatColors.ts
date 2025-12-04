// frontend/src/lib/heatColors.ts

/**
 * Devuelve un color HEX (#rrggbb) en escala de verde → amarillo → rojo
 * para un valor entre 0 y 5.
 *
 * 0   → verde oscuro (#006400)     = menor riesgo
 * 2.5 → amarillo (#FFD700)          = riesgo medio
 * 5   → rojo oscuro (#8B0000)       = mayor riesgo
 */
export function getHeatColor(value: number): string {
  // Aseguramos el rango 0–5
  const v = Math.max(0, Math.min(5, value));

  // Normalizamos a 0–1
  const t = v / 5;

  // Dos tramos:
  // 0 → 0.5: verde → amarillo
  // 0.5 → 1: amarillo → rojo
  if (t <= 0.5) {
    // Interpolamos entre verde (#006400) y amarillo (#FFD700)
    const tt = t / 0.5; // 0–1
    return lerpColor(
      { r: 0, g: 100, b: 0 },        // verde
      { r: 255, g: 215, b: 0 },     // amarillo
      tt
    );
  } else {
    // Interpolamos entre amarillo (#FFD700) y rojo (#8B0000)
    const tt = (t - 0.5) / 0.5; // 0–1
    return lerpColor(
      { r: 255, g: 215, b: 0 },     // amarillo
      { r: 139, g: 0, b: 0 },       // rojo
      tt
    );
  }
}

type RGB = { r: number; g: number; b: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): string {
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bVal = Math.round(lerp(a.b, b.b, t));

  return rgbToHex(r, g, bVal);
}

function componentToHex(c: number): string {
  const hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
