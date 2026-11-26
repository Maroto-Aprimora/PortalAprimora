import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A tela "Leads Contak" (antiga "Leads StockFacil") saiu em 26/11/2026: os leads estão no funil com a etiqueta SAAS
  async redirects() {
    return [
      { source: "/contak/:caminho*", destination: "/funil", permanent: false },
      { source: "/contak", destination: "/funil", permanent: false },
      { source: "/stockfacil/:caminho*", destination: "/funil", permanent: false },
      { source: "/stockfacil", destination: "/funil", permanent: false },
    ];
  },
};

export default nextConfig;
