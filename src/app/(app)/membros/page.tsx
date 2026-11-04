import type { Metadata } from "next";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, iniciais, NOME_CARGO } from "@/lib/formatar";
import { obterUsuario } from "@/lib/usuario";
import { AcoesMembro, AcoesPreCadastro, DataEntrada, NovoPreCadastro, ProcessosSeletivos, TransferirCarteira } from "./componentes";
import { UserOff } from "@/components/ui/icones";

export const metadata: Metadata = { title: "Membros" };

export default async function PaginaMembros() {
  const usuario = await obterUsuario();
  const supabase = await criarClienteServidor();
  const [{ data: diretorias }, { data: membros }, { data: cargos }, { data: pre }, { data: processos }] = await Promise.all([
    supabase.from("diretorias").select("slug, nome").order("ordem"),
    supabase.from("membros").select("id, nome, email, ativo, data_entrada").order("nome"),
    supabase.from("membro_diretorias").select("membro_id, diretoria, cargo, participa_rodizio"),
    usuario.ehDiretor
      ? supabase.from("pre_cadastros").select("id, nome, email, convite_enviado_em, aceito_em, pre_cadastro_diretorias(diretoria, cargo)").is("aceito_em", null).order("nome")
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("processos_seletivos").select("id, nome, data").order("data", { ascending: false }),
  ]);

  const minhasDiretorias = (diretorias ?? []).filter((d) => usuario.ehDiretorDe(d.slug));
  const ordemCargo = { diretor: 0, assessor: 1, trainee: 2 } as const;

  return (
    <>
      <TituloPagina
        titulo="Membros"
        descricao="Quem tem acesso ao portal, por diretoria. Só entra quem for pré-cadastrado pelo diretor da diretoria."
        acoes={minhasDiretorias.length > 0 && <NovoPreCadastro diretorias={minhasDiretorias} />}
      />

      {usuario.ehDiretor && (pre ?? []).length > 0 && (
        <Cartao className="mb-6">
          <CabecalhoCartao
            titulo="Aguardando primeiro acesso"
            descricao="Pré-cadastrados que ainda não ativaram a conta. Envie o convite ou peça para a pessoa usar “Primeiro acesso” na tela de login."
          />
          <ul className="divide-y divide-borda">
            {(pre ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nome}</p>
                  <p className="truncate text-sm text-texto-suave">{p.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.pre_cadastro_diretorias.map((v) => (
                    <Selo key={v.diretoria} tom="marca">
                      {NOME_CARGO[v.cargo]} · {diretorias?.find((d) => d.slug === v.diretoria)?.nome}
                    </Selo>
                  ))}
                  {p.convite_enviado_em && <Selo>Convite enviado em {formatarData(p.convite_enviado_em)}</Selo>}
                  <AcoesPreCadastro
                    id={p.id}
                    email={p.email}
                    podeGerir={p.pre_cadastro_diretorias.some((v) => usuario.ehDiretorDe(v.diretoria))}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {usuario.ehDiretor && <div className="mb-6"><ProcessosSeletivos processos={processos ?? []} /></div>}

      <div className="grid gap-6 xl:grid-cols-2">
        {(diretorias ?? []).map((d) => {
          const daDiretoria = (cargos ?? [])
            .filter((c) => c.diretoria === d.slug)
            .map((c) => ({ ...c, membro: membros?.find((m) => m.id === c.membro_id) }))
            .filter((c) => c.membro)
            .sort((a, b) => ordemCargo[a.cargo] - ordemCargo[b.cargo] || a.membro!.nome.localeCompare(b.membro!.nome));
          const podeGerir = usuario.ehDiretorDe(d.slug);
          return (
            <Cartao key={d.slug}>
              <CabecalhoCartao titulo={d.nome} descricao={`${daDiretoria.length} ${daDiretoria.length === 1 ? "pessoa" : "pessoas"} com acesso`} />
              {daDiretoria.length === 0 ? (
                <Vazio compacto icone={UserOff} titulo="Ninguém ativou o acesso nesta diretoria ainda." />
              ) : (
                <ul className="divide-y divide-borda">
                  {daDiretoria.map((c) => (
                    <li key={c.membro_id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar iniciais={iniciais(c.membro!.nome)} nome={c.membro!.nome} className={c.membro!.ativo ? "" : "opacity-40"} />
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {c.membro!.nome}
                            {!c.membro!.ativo && <Selo tom="perigo" className="ml-2">Desativado</Selo>}
                          </p>
                          <p className="truncate text-sm text-texto-suave">{c.membro!.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                      <DataEntrada membroId={c.membro_id} valor={c.membro!.data_entrada} podeEditar={podeGerir} />
                      {podeGerir && (
                        <TransferirCarteira membroId={c.membro_id} nome={c.membro!.nome} diretoria={d.slug}
                          destinos={daDiretoria.filter((x) => x.membro!.ativo).map((x) => ({ id: x.membro_id, nome: x.membro!.nome }))} />
                      )}
                      {podeGerir ? (
                        <AcoesMembro
                          membroId={c.membro_id}
                          diretoria={d.slug}
                          cargo={c.cargo}
                          ativo={c.membro!.ativo}
                          participaRodizio={c.participa_rodizio}
                          ehVoce={c.membro_id === usuario.id}
                          mostrarRodizio={d.slug === "comercial"}
                        />
                      ) : (
                        <Selo tom={c.cargo === "diretor" ? "destaque" : "neutro"}>{NOME_CARGO[c.cargo]}</Selo>
                      )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          );
        })}
      </div>
    </>
  );
}
