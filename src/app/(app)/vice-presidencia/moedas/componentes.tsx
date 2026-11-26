"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BadgeDollarSign, Check, Pencil, Plus, X } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import {
  cancelarPedidoItem, cancelarPedidoMoedas, darMoedas, decidirPedidoItem, decidirPedidoMoedas, pedirItem, pedirMoedas, salvarItem,
} from "./acoes";

type Pessoa = { id: string; nome: string; diretorias: string[] };

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg: string, depois?: () => void) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    toast.success(msg);
    depois?.();
    router.refresh();
  });
  return { pendente, rodar };
}

/** Dar/retirar (diretores) ou pedir (equipe da VP) moedas para vários membros. */
export function MoedasParaMembros({ modo, pessoas, diretorias }: {
  modo: "dar" | "pedir"; pessoas: Pessoa[]; diretorias: { slug: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [retirar, setRetirar] = useState(false);
  const { pendente, rodar } = useAcao();
  const alternar = (id: string) => setEscolhidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <>
      <Botao variante={modo === "dar" ? "primario" : "secundario"} onClick={() => setAberto(true)}>
        <BadgeDollarSign className="h-4 w-4" /> {modo === "dar" ? "Dar ou retirar moedas" : "Pedir moedas"}
      </Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={modo === "dar" ? "Dar ou retirar moedas" : "Pedir moedas"} className="w-[min(94vw,620px)]"
        descricao={modo === "dar" ? "Tudo ou nada: se o saldo de alguém ficaria negativo, nada é lançado." : "Um diretor aprova; as moedas entram só depois."}>
        <form className="space-y-4" action={(f) => {
          const valor = Math.abs(Number(f.get("valor") ?? 0)) * (modo === "dar" && retirar ? -1 : 1);
          const dados = { membros: escolhidos, valor, motivo: String(f.get("motivo") ?? "") };
          rodar(() => (modo === "dar" ? darMoedas(dados) : pedirMoedas(dados)),
            modo === "dar" ? "Moedas lançadas." : "Pedido enviado aos diretores.", () => { setAberto(false); setEscolhidos([]); });
        }}>
          {modo === "dar" && (
            <div className="flex gap-2">
              <Botao type="button" variante={retirar ? "secundario" : "primario"} tamanho="sm" onClick={() => setRetirar(false)}>Dar</Botao>
              <Botao type="button" variante={retirar ? "primario" : "secundario"} tamanho="sm" onClick={() => setRetirar(true)}>Retirar</Botao>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Campo rotulo="Moedas" obrigatorio><Entrada name="valor" type="number" min={1} max={100000} defaultValue={10} required /></Campo>
            <Campo rotulo="Motivo" obrigatorio><Entrada name="motivo" required maxLength={200} placeholder="Ex.: destaque na R.G" /></Campo>
          </div>
          <Campo rotulo={`Membros (${escolhidos.length})`} obrigatorio>
            <div className="mb-2 flex flex-wrap gap-1">
              <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setEscolhidos(pessoas.map((p) => p.id))}>Todos</Botao>
              {diretorias.map((d) => (
                <Botao key={d.slug} type="button" variante="fantasma" tamanho="sm"
                  onClick={() => setEscolhidos((x) => [...new Set([...x, ...pessoas.filter((p) => p.diretorias.includes(d.slug)).map((p) => p.id)])])}>
                  + {d.nome}
                </Botao>
              ))}
              <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setEscolhidos([])}>Limpar</Botao>
            </div>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-controle border border-borda p-2 sm:grid-cols-2">
              {pessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={escolhidos.includes(p.id)} onChange={() => alternar(p.id)} className="h-4 w-4 accent-marca" />{p.nome}
                </label>
              ))}
            </div>
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente} disabled={!escolhidos.length}>Confirmar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

/** Responder pedido (de item ou de moedas). */
export function Responder({ tipo, id, titulo }: { tipo: "item" | "moedas"; id: string; titulo: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const { pendente, rodar } = useAcao();
  const decidir = (aprovar: boolean) => rodar(
    () => (tipo === "item" ? decidirPedidoItem(id, aprovar, texto) : decidirPedidoMoedas(id, aprovar, texto)),
    aprovar ? "Pedido aprovado." : "Pedido recusado.", () => setAberto(false));
  return (
    <>
      <Botao tamanho="sm" onClick={() => setAberto(true)}>Responder</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Responder pedido" descricao={titulo}>
        <div className="space-y-4">
          <Campo rotulo="Resposta (opcional)"><AreaTexto rows={2} maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === "item" ? "Ex.: retire na sala da EJ na sexta" : undefined} /></Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" carregando={pendente} onClick={() => decidir(false)}><X className="h-4 w-4" /> Recusar</Botao>
            <Botao carregando={pendente} onClick={() => decidir(true)}><Check className="h-4 w-4" /> Aprovar</Botao>
          </div>
        </div>
      </Dialogo>
    </>
  );
}

export function Cancelar({ tipo, id }: { tipo: "item" | "moedas"; id: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <Botao tamanho="sm" variante="fantasma" disabled={pendente}
      onClick={() => confirm("Cancelar este pedido?") && rodar(() => (tipo === "item" ? cancelarPedidoItem(id) : cancelarPedidoMoedas(id)), "Pedido cancelado.")}>
      Cancelar
    </Botao>
  );
}

export function PedirItem({ id, nome, preco, disponivel }: { id: string; nome: string; preco: number; disponivel: number }) {
  const [aberto, setAberto] = useState(false);
  const [obs, setObs] = useState("");
  const { pendente, rodar } = useAcao();
  const falta = preco - disponivel;
  return (
    <>
      <Botao tamanho="sm" disabled={falta > 0} title={falta > 0 ? `Faltam ${falta} moedas` : undefined} onClick={() => setAberto(true)}>Pedir</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Pedir ${nome}`}
        descricao={`${preco} moedas ficam reservadas até um diretor responder. Saem do saldo só se o pedido for aprovado.`}>
        <div className="space-y-4">
          <Campo rotulo="Observação (opcional)"><AreaTexto rows={2} maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Tamanho, cor…" /></Campo>
          <div className="flex justify-end"><Botao carregando={pendente} onClick={() => rodar(() => pedirItem(id, obs), "Pedido enviado.", () => setAberto(false))}>Confirmar pedido</Botao></div>
        </div>
      </Dialogo>
    </>
  );
}

export type ItemLoja = { id: string; nome: string; descricao: string | null; preco: number; estoque: number | null; ativo: boolean };

export function FormItem({ atual }: { atual?: ItemLoja }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      {atual
        ? <Botao variante="fantasma" tamanho="icone" aria-label="Editar item" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></Botao>
        : <Botao variante="secundario" onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo item</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar item" : "Novo item da lojinha"}>
        <form className="space-y-4" action={(f) => rodar(() => salvarItem(atual?.id ?? null, {
          nome: String(f.get("nome") ?? ""), descricao: String(f.get("descricao") ?? ""), preco: f.get("preco"),
          estoque: String(f.get("estoque") ?? ""), ativo: f.get("ativo") === "on",
        }), "Item salvo.", () => setAberto(false))}>
          <Campo rotulo="Nome" obrigatorio><Entrada name="nome" required maxLength={80} defaultValue={atual?.nome} /></Campo>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={2} maxLength={500} defaultValue={atual?.descricao ?? ""} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Preço (moedas)" obrigatorio><Entrada name="preco" type="number" min={1} required defaultValue={atual?.preco ?? 10} /></Campo>
            <Campo rotulo="Estoque" dica="Vazio = sem limite."><Entrada name="estoque" type="number" min={0} defaultValue={atual?.estoque ?? ""} /></Campo>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={atual?.ativo ?? true} className="h-4 w-4 accent-marca" /> Disponível na lojinha
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}
