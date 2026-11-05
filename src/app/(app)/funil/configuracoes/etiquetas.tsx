"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { SeloEtiqueta } from "@/components/crm/selo-etiqueta";
import { CORES_ETIQUETA, type CorEtiqueta } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";
import { excluirEtiqueta, salvarEtiqueta } from "../etiquetas-acoes";

type ItemEtiqueta = { id: string; nome: string; cor: string; descricao: string | null; cards: number };

/** Etiquetas do funil (só o Diretor Comercial): nome, cor e para que servem. */
export function Etiquetas({ etiquetas }: { etiquetas: ItemEtiqueta[] }) {
  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Etiquetas"
        descricao="Aparecem como selos nos cards e podem ser filtradas no funil. Qualquer membro do Comercial marca e desmarca as etiquetas no card." />
      <ul className="divide-y divide-borda">
        {etiquetas.map((e) => <LinhaEtiqueta key={e.id} etiqueta={e} />)}
        <LinhaEtiqueta etiqueta={null} />
      </ul>
    </Cartao>
  );
}

function SeletorCor({ valor, aoMudar }: { valor: CorEtiqueta; aoMudar: (c: CorEtiqueta) => void }) {
  return (
    <span className="flex items-center gap-1" role="radiogroup" aria-label="Cor">
      {(Object.keys(CORES_ETIQUETA) as CorEtiqueta[]).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={valor === c} title={CORES_ETIQUETA[c].nome} onClick={() => aoMudar(c)}
          className={cn("h-5 w-5 rounded-full border-2", CORES_ETIQUETA[c].ponto, valor === c ? "border-texto" : "border-transparent")} />
      ))}
    </span>
  );
}

function LinhaEtiqueta({ etiqueta }: { etiqueta: ItemEtiqueta | null }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(etiqueta?.nome ?? "");
  const [cor, setCor] = useState<CorEtiqueta>((etiqueta?.cor as CorEtiqueta) ?? "roxo");
  const [descricao, setDescricao] = useState(etiqueta?.descricao ?? "");

  function salvar() {
    iniciar(async () => {
      const r = await salvarEtiqueta(etiqueta?.id ?? null, { nome, cor, descricao });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(etiqueta ? "Etiqueta salva." : "Etiqueta criada.");
      if (!etiqueta) { setNome(""); setDescricao(""); setCor("roxo"); }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-6 py-3">
      <span className="w-24 shrink-0">{nome.trim() ? <SeloEtiqueta etiqueta={{ nome: nome.trim(), cor }} /> : <span className="text-xs text-texto-suave">Nova</span>}</span>
      <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder={etiqueta ? "Nome" : "Nova etiqueta"} maxLength={30} className="h-9 w-40" />
      <SeletorCor valor={cor} aoMudar={setCor} />
      <Entrada value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Para que serve (opcional)" className="h-9 min-w-48 flex-1" />
      {etiqueta && <span className="text-xs text-texto-suave">{etiqueta.cards} {etiqueta.cards === 1 ? "card" : "cards"}</span>}
      <Botao tamanho="sm" variante={etiqueta ? "fantasma" : "primario"} onClick={salvar} carregando={pendente} disabled={!nome.trim()}>
        {etiqueta ? "Salvar" : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
      </Botao>
      {etiqueta && (
        <Botao tamanho="sm" variante="fantasma" aria-label={`Excluir a etiqueta ${etiqueta.nome}`} disabled={pendente}
          onClick={() => confirm(`Excluir a etiqueta ${etiqueta.nome}? Ela sai de ${etiqueta.cards} card(s).`) && iniciar(async () => {
            const r = await excluirEtiqueta(etiqueta.id);
            if (r.ok) toast.success("Etiqueta excluída."); else toast.error(r.erro);
          })}>
          <Trash2 className="h-3.5 w-3.5" />
        </Botao>
      )}
    </li>
  );
}
