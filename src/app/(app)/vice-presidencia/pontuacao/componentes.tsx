"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, FileText, Plus, RotateCcw, Trash2, Undo2, X } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import {
  decidirPonto, enviarJustificativa, excluirJustificativa, marcarJustificativa, pedirPonto, retirarPonto, zerarPontos,
} from "./acoes";

type Pessoa = { id: string; nome: string };

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

/** Qualquer membro pede um ponto descrevendo o fato. */
export function PedirPonto({ membros, hoje }: { membros: Pessoa[]; hoje: string }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Pedir ponto</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Pedir ponto"
        descricao="Conte o que aconteceu. A Vice-Presidência analisa e define quantos pontos vale (de 1 a 6); só ela vê o pedido.">
        <form className="space-y-4" action={(f) => rodar(() => pedirPonto({
          membro_id: String(f.get("membro_id") ?? ""), motivo: String(f.get("motivo") ?? ""), data: String(f.get("data") ?? ""),
        }), "Pedido enviado para a VP.", () => setAberto(false))}>
          <Campo rotulo="Membro" obrigatorio>
            <Selecao name="membro_id" defaultValue="" required>
              <option value="" disabled>Escolha…</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Quando aconteceu"><Entrada type="date" name="data" max={hoje} defaultValue={hoje} /></Campo>
          <Campo rotulo="O que aconteceu" obrigatorio>
            <AreaTexto name="motivo" rows={4} required maxLength={1000} placeholder="Ex.: faltou à R.G de 21/11 sem avisar" />
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Enviar pedido</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

/** A equipe da VP aprova (com a quantidade) ou recusa um pedido. */
export function DecidirPedido({ id, membro, motivo }: { id: string; membro: string; motivo: string }) {
  const [aberto, setAberto] = useState(false);
  const [pontos, setPontos] = useState(1);
  const [obs, setObs] = useState("");
  const { pendente, rodar } = useAcao();
  return (
    <>
      <Botao tamanho="sm" onClick={() => setAberto(true)}>Analisar</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={`Pedido para ${membro}`} descricao={motivo}>
        <div className="space-y-4">
          <Campo rotulo="Quantos pontos vale" dica="De 1 a 6. Ao somar 6, o membro entra em PDI.">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setPontos(n)}
                  className={`h-9 w-9 rounded-controle border text-sm font-semibold ${pontos === n ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2"}`}>
                  {n}
                </button>
              ))}
            </div>
          </Campo>
          <Campo rotulo="Observação (opcional)"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} /></Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" carregando={pendente}
              onClick={() => rodar(() => decidirPonto(id, false, null, obs), "Pedido recusado.", () => setAberto(false))}>
              <X className="h-4 w-4" /> Recusar
            </Botao>
            <Botao carregando={pendente}
              onClick={() => rodar(() => decidirPonto(id, true, pontos, obs), `${pontos} ponto(s) aprovado(s).`, () => setAberto(false))}>
              <Check className="h-4 w-4" /> Aprovar {pontos}
            </Botao>
          </div>
        </div>
      </Dialogo>
    </>
  );
}

export function RetirarPonto({ id }: { id: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <Botao tamanho="sm" variante="fantasma" disabled={pendente} title="Retirar ponto"
      onClick={() => {
        const obs = prompt("Por que retirar este ponto? (opcional)");
        if (obs === null) return;
        rodar(() => retirarPonto(id, obs), "Ponto retirado.");
      }}>
      <Undo2 className="h-3.5 w-3.5" /> Retirar
    </Botao>
  );
}

export function ZerarPontos({ membro, rotulo }: { membro: string | null; rotulo: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <Botao tamanho="sm" variante="secundario" carregando={pendente}
      onClick={() => confirm(membro
        ? "Zerar os pontos deste membro? Os lançamentos continuam no histórico, mas deixam de contar."
        : "Zerar os pontos de TODOS os membros (ex.: novo semestre)? Os lançamentos continuam no histórico.")
        && rodar(() => zerarPontos(membro), "Pontos zerados.")}>
      <RotateCcw className="h-4 w-4" /> {rotulo}
    </Botao>
  );
}

// ---------- Justificativas ----------

export function EnviarJustificativa({ hoje }: { hoje: string }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}><FileText className="h-4 w-4" /> Enviar justificativa</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Justificativa"
        descricao="Justifique uma falta, atraso ou atividade não realizada. Só você e a Vice-Presidência veem.">
        <form className="space-y-4" action={(f) => rodar(() => enviarJustificativa({
          data_evento: String(f.get("data_evento") ?? ""), motivo: String(f.get("motivo") ?? ""),
        }), "Justificativa enviada.", () => setAberto(false))}>
          <Campo rotulo="Data do ocorrido" obrigatorio><Entrada type="date" name="data_evento" defaultValue={hoje} required /></Campo>
          <Campo rotulo="Justificativa" obrigatorio><AreaTexto name="motivo" rows={5} required maxLength={2000} /></Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Enviar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function AcoesJustificativa({ id, vista, minha, analisa }: { id: string; vista: boolean; minha: boolean; analisa: boolean }) {
  const { pendente, rodar } = useAcao();
  return (
    <div className="flex shrink-0 gap-1">
      {analisa && (
        <Botao tamanho="sm" variante={vista ? "fantasma" : "secundario"} carregando={pendente}
          onClick={() => rodar(() => marcarJustificativa(id, !vista), vista ? "Marcada como nova." : "Marcada como vista.")}>
          {vista ? <><RotateCcw className="h-3.5 w-3.5" /> Desmarcar</> : <><Check className="h-3.5 w-3.5" /> Marcar como vista</>}
        </Botao>
      )}
      {minha && !vista && (
        <Botao tamanho="icone" variante="fantasma" aria-label="Excluir justificativa" disabled={pendente}
          onClick={() => confirm("Excluir esta justificativa?") && rodar(() => excluirJustificativa(id), "Justificativa excluída.")}>
          <Trash2 className="h-4 w-4" />
        </Botao>
      )}
    </div>
  );
}
