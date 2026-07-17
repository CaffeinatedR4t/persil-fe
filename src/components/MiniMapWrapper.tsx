"use client";
import dynamic from "next/dynamic";

const MiniMapComponent = dynamic(() => import("./MiniMap"), { ssr: false });

export default function MiniMapWrapper() {
  return <MiniMapComponent />;
}
