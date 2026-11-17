import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "Leads StockFacil" virou "Leads Contak": endereços antigos continuam funcionando
  async redirects() {
    return [
      { source: "/stockfacil", destination: "/contak", permanent: true },
      { source: "/stockfacil/:caminho*", destination: "/contak/:caminho*", permanent: true },
    ];
  },
};

export default nextConfig;
