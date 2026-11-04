"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Phone } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { registrarLigacao } from "@/app/(app)/negocios/acoes";
import type { ResultadoLigacao } from "@/lib/crm";
import { hojeBR } from "@/lib/datas";
import { cn } from "@/lib/utils";

/**
 * Registro rápido de ligação (PE-PA-002, Seção 3.1). O resultado é uma lista fechada; os campos extras
 * (data de retorno, decisor, data do compromisso) só aparecem quando o resultado pede.
 */
export function RegistrarLigacao({
  negocioId, titulo, resultados, contatos = [], contatoPadrao, compacto, className,
}: {
  negocioId: string; titulo: string; resultados: ResultadoLigacao[];
  contatos?: { id: string; nome: string; telefone?: string | null; telefone_invalido?: boolean }[];
  contatoPadrao?: string | null; compacto?: boolean; className?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [resultadoId, setResultadoId] = useState("");
  const [pendente, iniciar] = useTransition();
  const resultado = resultados.find((r) => r.id === resultadoId);

  const fechar = () => { setAberto(false); setResultadoId(""); };

  return (
    <>
      {compacto ? (
        <button onClick={() => setAberto(true)} title="Registrar ligação" aria-label="Registrar ligação"
          className={cn("rounded-controle p-1 text-texto-suave opacity-70 hover:bg-superficie-2 hover:opacity-100", className)}>
          <Phone className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Botao variante="secundario" onClick={() => setAberto(true)} className={className}>
          <Phone className="h-4 w-4" /> Registrar ligação
        </Botao>
      )}

      {/* Fora do card do funil (que é arrastável), para não interferir nos campos */}
      {aberto && createPortal(
      <Dialogo aberto={aberto} aoFechar={fechar} titulo="Registrar ligação" descricao={titulo}>
        <form
          className="space-y-4"
          action={(form) => iniciar(async () => {
            const dados = Object.fromEntries(form.entries());
            const r = await registrarLigacao({ ...dados, negocio_id: negocioId });
            if (!r.ok) return void toast.error(r.erro, { duration: 8000 });
            toast.success(resultado?.tarefa_titulo ? `Ligação registrada. Tarefa criada: ${resultado.tarefa_titulo}.` : "Ligação registrada.");
            fechar();
            router.refresh();
          })}
        >
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
              Resultado<span className="ml-0.5 text-destaque">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {resultados.map((r) => (
                <label key={r.id} className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-controle border px-3 py-2 text-sm",
                  r.id === resultadoId ? "border-marca bg-superficie-2 font-semibold" : "border-borda hover:bg-superficie-2",
                )}>
                  <input type="radio" name="resultado_id" value={r.id} required checked={r.id === resultadoId}
                    onChange={() => setResultadoId(r.id)} className="accent-marca" />
                  {r.nome}
                </label>
              ))}
            </div>
          </fieldset>

          {resultado?.exige_retorno && (
            <Campo rotulo="Ligar de novo em" obrigatorio dica="O card fica na fase atual e você recebe a tarefa nessa data.">
              <Entrada type="date" name="retorno_em" required min={hojeBR()} />
            </Campo>
          )}
          {resultado?.tipo_atividade_id && (
            <Campo rotulo="Data e horário do compromisso" obrigatorio dica="Entra na agenda e cria a tarefa de preparação.">
              <Entrada type="datetime-local" name="compromisso_em" required />
            </Campo>
          )}
          {resultado?.registra_decisor && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome do decisor"><Entrada name="decisor_nome" /></Campo>
              <Campo rotulo="Melhor horário"><Entrada name="decisor_melhor_horario" placeholder="Ex.: terças, 9h–11h" /></Campo>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {contatos.length > 0 && (
              <Campo rotulo="Com quem">
                <Selecao name="contato_id" defaultValue={contatoPadrao ?? ""}>
                  <option value="">Telefone da empresa</option>
                  {contatos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.telefone_invalido ? " (telefone inválido)" : ""}</option>
                  ))}
                </Selecao>
              </Campo>
            )}
            <Campo rotulo="Duração (min)">
              <Entrada name="duracao_min" inputMode="decimal" placeholder="Ex.: 3" />
            </Campo>
          </div>
          {contatos.length === 0 && contatoPadrao && <input type="hidden" name="contato_id" value={contatoPadrao} />}

          <Campo rotulo="Próximo passo">
            <Entrada name="proximo_passo" placeholder="O que foi combinado" />
          </Campo>
          <Campo rotulo="Comentário">
            <AreaTexto name="comentario" className="min-h-16" placeholder="Dores, objeções, observações" />
          </Campo>

          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={fechar}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Registrar</Botao>
          </div>
        </form>
      </Dialogo>, document.body)}
    </>
  );
}
