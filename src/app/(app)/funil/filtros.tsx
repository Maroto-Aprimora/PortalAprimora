"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarraVisoes, BotaoFiltros, CampoBusca, useParametros } from "@/components/app/barra-visoes";
import { Campo, Selecao } from "@/components/ui/campos";
import type { MembroResumo } from "@/lib/crm";

const FILTROS = ["resp", "origem", "segmento", "etiqueta"] as const;

/** Cabeçalho do funil (estilo Pipefy): Kanban e Lista à esquerda; busca e filtros à direita. Tudo fica na URL. */
export function BarraFunil({ membros, origens, segmentos, etiquetas, acoes }: {
  membros: MembroResumo[]; origens: { id: string; nome: string }[]; segmentos: { id: string; nome: string }[];
  etiquetas: { id: string; nome: string }[]; acoes?: React.ReactNode;
}) {
  const router = useRouter();
  const { params, montar } = useParametros();
  const [busca, setBusca] = useState(params.get("q") ?? "");
  const ativos = FILTROS.filter((c) => params.get(c)).length;
  const aplicar = (m: Record<string, string | null>) => router.replace(montar(m), { scroll: false });

  useEffect(() => {
    if (busca === (params.get("q") ?? "")) return;
    const t = setTimeout(() => aplicar({ q: busca || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <BarraVisoes visoes={[{ chave: "kanban", rotulo: "Kanban" }, { chave: "lista", rotulo: "Lista" }]} padrao="kanban">
      <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Procurar cards" />
      <BotaoFiltros ativos={ativos} aoLimpar={() => aplicar(Object.fromEntries(FILTROS.map((c) => [c, null])))}>
        <Campo rotulo="Responsável">
          <Selecao value={params.get("resp") ?? ""} onChange={(e) => aplicar({ resp: e.target.value || null })}>
            <option value="">Todos</option>
            <option value="meus">Meus negócios</option>
            <option value="sem">Sem responsável</option>
            {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Origem">
          <Selecao value={params.get("origem") ?? ""} onChange={(e) => aplicar({ origem: e.target.value || null })}>
            <option value="">Todas</option>
            {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Segmento">
          <Selecao value={params.get("segmento") ?? ""} onChange={(e) => aplicar({ segmento: e.target.value || null })}>
            <option value="">Todos</option>
            {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Etiqueta">
          <Selecao value={params.get("etiqueta") ?? ""} onChange={(e) => aplicar({ etiqueta: e.target.value || null })}>
            <option value="">Todas</option>
            {etiquetas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Selecao>
        </Campo>
      </BotaoFiltros>
      {acoes}
    </BarraVisoes>
  );
}
