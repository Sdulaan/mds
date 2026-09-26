import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Report generators run in route handlers; load them with Node's require instead of bundling.
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"],
};

export default nextConfig;
