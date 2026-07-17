"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/lib/supabase";

export default function MapComponent({ onSelectKabupaten, onSelectPlot }: { onSelectKabupaten: (code: string) => void, onSelectPlot?: (plot: any) => void }) {
  const [geoData, setGeoData] = useState<any>(null);
  const [villageGeoData, setVillageGeoData] = useState<any>(null);
  const [forecasts, setForecasts] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load GeoJSON and Forecasts concurrently
    const fetchData = async () => {
      try {
        const [geoRes, villageRes, { data: fData }] = await Promise.all([
          fetch("/kabupaten_west_java.json"),
          fetch("/village_fields.json").catch(() => null),
          supabase.from("yield_forecasts").select("*")
        ]);
        
        const gData = await geoRes.json();
        const featureCollection = {
          type: "FeatureCollection",
          features: gData.map((k: any) => ({
            type: "Feature",
            geometry: k.geometry,
            properties: {
              code: k.kabupaten_code,
              name: k.name
            }
          }))
        };
        setGeoData(featureCollection);

        if (villageRes && villageRes.ok) {
            const vData = await villageRes.json();
            setVillageGeoData(vData);
        }

        if (fData) {
          const map = fData.reduce((acc: any, row: any) => {
            acc[row.kabupaten_code] = row;
            return acc;
          }, {});
          setForecasts(map);
        }
      } catch (err) {
        console.error("Map data fetch error:", err);
      }
    };
    fetchData();
  }, []);

  const getStyle = (feature: any) => {
    const data = forecasts[feature.properties.code];
    let fillColor = "#334155"; // default Slate
    if (data) {
      if (data.yield_deviation_pct < -10) fillColor = "#ef4444"; // red
      else if (data.yield_deviation_pct < 0) fillColor = "#f59e0b"; // yellow
      else fillColor = "#10b981"; // green
    }
    return {
      fillColor,
      weight: 1,
      opacity: 1,
      color: "rgba(255,255,255,0.4)",
      fillOpacity: 0.35
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    layer.on({
      click: () => onSelectKabupaten(feature.properties.code)
    });
  };

  const getVillageStyle = (feature: any) => {
    const dev = feature.properties.deviation_pct;
    let fillColor = "#10b981"; // green
    if (dev < -10) fillColor = "#ef4444"; // red
    else if (dev < 0) fillColor = "#f59e0b"; // yellow
    
    return {
      fillColor,
      weight: 2,
      opacity: 1,
      color: "#000",
      fillOpacity: 0.8
    };
  };

  const onEachVillageFeature = (feature: any, layer: any) => {
    layer.bindTooltip(`Plot: ${feature.properties.h3_index}<br/>Health (NDVI): ${feature.properties.ndvi_2024}<br/>Deviation: ${feature.properties.deviation_pct}%`);
    layer.on({
      click: () => {
        if (onSelectPlot) {
          onSelectPlot(feature.properties);
        }
      }
    });
  };

  const position: [number, number] = [-6.3475, 107.6533]; // Sukamandi, Subang

  return (
    <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container">
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      {geoData && Object.keys(forecasts).length > 0 && (
        <GeoJSON 
          data={geoData} 
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {villageGeoData && (
        <GeoJSON 
          data={villageGeoData} 
          style={getVillageStyle}
          onEachFeature={onEachVillageFeature}
        />
      )}
    </MapContainer>
  );
}
