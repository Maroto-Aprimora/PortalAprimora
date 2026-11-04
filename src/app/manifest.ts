import type { MetadataRoute } from "next";

/** Permite instalar o portal no celular como aplicativo (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal Aprimora",
    short_name: "Aprimora",
    description: "Portal interno da Aprimora — Empresa Júnior de Engenharia de Produção da UTFPR Londrina.",
    start_url: "/painel",
    display: "standalone",
    background_color: "#24476f",
    theme_color: "#24476f",
    lang: "pt-BR",
    // Gerados por scripts/gerar-icones.py a partir dos logos oficiais
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      // Android recorta o ícone em círculo/gota: versão com margem maior para o símbolo não ser cortado
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
