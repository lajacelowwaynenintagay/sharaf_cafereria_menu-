"use client";

import { Suspense } from "react";
import { SmartMenuPage } from "@/components/smart-menu-page";

export default function Home() {
  return (
    <Suspense fallback={<div style={{ padding: "20px", textAlign: "center" }}>Loading menu...</div>}>
      <SmartMenuPage />
    </Suspense>
  );
}
