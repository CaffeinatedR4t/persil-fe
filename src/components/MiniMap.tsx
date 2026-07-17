"use client";

import { MapContainer, TileLayer, Polygon } from "react-leaflet";

// A simple polygon to highlight the generic field area on the mini map
const PADDY_POLYGON: [number, number][] = [
  [-7.049, 107.559],
  [-7.049, 107.561],
  [-7.051, 107.561],
  [-7.051, 107.559],
];

export default function MiniMap() {
  return (
    <MapContainer
      center={[-7.05, 107.56]}
      zoom={16}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ width: "100%", height: "100%", background: "#0f172a" }}
    >
      <TileLayer
        attribution='&copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <Polygon positions={PADDY_POLYGON} pathOptions={{ color: "#56FF4D", weight: 2, fillOpacity: 0.1 }} />
    </MapContainer>
  );
}
