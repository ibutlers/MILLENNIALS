// Approved local assets catalog — demo/generated images only
export interface AssetEntry {
  id: string;
  path: string; // relative to /assets/
  mime: string;
  width: number;
  height: number;
  alt: string;
}

export const CATALOG: AssetEntry[] = [
  { id: 'hero-building.jpg', path: 'hero-building.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Fachada de edificio residencial reformado con luz natural' },
  { id: 'residential-complex.jpg', path: 'residential-complex.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Complejo residencial con zonas verdes comunitarias' },
  { id: 'commercial-retail.jpg', path: 'commercial-retail.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Local comercial a pie de calle con escaparate' },
  { id: 'warehouse-industrial.jpg', path: 'warehouse-industrial.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Nave industrial diáfana con altillo de oficinas' },
  { id: 'land-plot-aerial.jpg', path: 'land-plot-aerial.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Vista aérea de parcela urbanizable' },
  { id: 'floorplan-example.png', path: 'floorplan-example.png', mime: 'image/png', width: 1200, height: 900, alt: 'Plano de distribución tipo de las viviendas' },
  { id: 'rooftop-terrace.jpg', path: 'rooftop-terrace.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Terraza comunitaria con vistas a la ciudad' },
  { id: 'lobby-reception.jpg', path: 'lobby-reception.jpg', mime: 'image/jpeg', width: 1440, height: 810, alt: 'Vestíbulo de entrada con recepción' },
];

export function getAssetById(id: string): AssetEntry | undefined {
  return CATALOG.find((a) => a.id === id);
}

export function assetUrl(asset: AssetEntry): string {
  return `/assets/${asset.path}`;
}
