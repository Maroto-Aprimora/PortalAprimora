import type { Metadata } from "next";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campos";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, iniciais } from "@/lib/formatar";
import { TIPOS_FEEDBACK } from "@/lib/vp";
import { acompanhados, carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { ExcluirFeedback, FormFeedback } from "./componentes";

export const metadata: Metadata = { title: "Feedbacks" };

export default async function PaginaFeedbacks({ searchParams }: PageProps<"/vice-presidencia/feedbacks">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp, adminVp, gestao } = papel;
  const { data } = await supabase.from("feedbacks").select("*").order("dado_em", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const membro = typeof sp.membro === "string" && sp.membro ? sp.membro : null;
  const tipo = typeof sp.tipo === "string" && TIPOS_FEEDBACK[sp.tipo] ? sp.tipo : null;
  const lista = (data ?? []).filter((f) => (!membro || f.membro_id === membro) && (!tipo || f.tipo === tipo));
  const acompanha = acompanhados(papel, pessoas);
  const hoje = hojeBR();

  return (
    <>
      <TituloPagina
        titulo={gestao ? "Feedbacks" : "Meus feedbacks"}
        descricao={gestao
          ? "Feedbacks e reconhecimentos registrados pela Vice-Presidência. O membro só vê os que forem compartilhados com ele."
          : "Feedbacks que a Vice-Presidência compartilhou com você."}
        acoes={equipeVp && <FormFeedback membros={acompanha} hoje={hoje} membroInicial={membro ?? undefined} />}
      />
      {gestao && (
        <form className="mb-4 flex flex-wrap items-center gap-2" action="/vice-presidencia/feedbacks">
          <Selecao name="membro" defaultValue={membro ?? ""} className="h-9 w-56" aria-label="Membro">
            <option value="">Todos os membros</option>
            {acompanha.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Selecao>
          <Selecao name="tipo" defaultValue={tipo ?? ""} className="h-9 w-56" aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS_FEEDBACK).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </Selecao>
          <Botao type="submit" variante="secundario" tamanho="sm">Filtrar</Botao>
        </form>
      )}
      <Cartao>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum feedback aqui" descricao={equipeVp ? "Registre um feedback em “Registrar feedback”." : undefined} />
        ) : (
          <ul className="divide-y divide-borda">
            {lista.map((f) => {
              const t = TIPOS_FEEDBACK[f.tipo] ?? TIPOS_FEEDBACK.positivo;
              const podeEditar = equipeVp && f.membro_id !== usuario.id && (f.autor_id === usuario.id || adminVp);
              return (
                <li key={f.id} className="flex gap-3 px-6 py-4">
                  <Avatar iniciais={iniciais(nome(f.membro_id))} nome={nome(f.membro_id)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      {gestao && f.membro_id !== usuario.id && <span className="font-semibold">{nome(f.membro_id)}</span>}
                      <Selo tom={t.tom}>{t.rotulo}</Selo>
                      {gestao && <Selo>{f.compartilhado ? "Compartilhado" : "Só gestão"}</Selo>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-texto">{f.descricao}</p>
                    <p className="mt-1 text-xs text-texto-suave">{nome(f.autor_id)} · {formatarData(f.dado_em)}</p>
                  </div>
                  {podeEditar && (
                    <div className="flex shrink-0 items-start gap-1">
                      <FormFeedback membros={[]} hoje={hoje} atual={f} />
                      <ExcluirFeedback id={f.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}
