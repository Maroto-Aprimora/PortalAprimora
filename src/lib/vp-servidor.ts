import "server-only";
import { cache } from "react";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario, type UsuarioAtual } from "@/lib/usuario";

export type PessoaVp = { id: string; nome: string; diretorias: string[]; daVp: boolean };

/** Papéis nos módulos da VP (as regras valem no banco; aqui só decidem o que mostrar). */
export type PapelVp = {
  usuario: UsuarioAtual;
  /** Qualquer cargo na Vice-Presidência: agenda, registra e gere o acompanhamento (nunca o próprio). */
  equipeVp: boolean;
  /** Diretor da Vice-Presidência: o "Administrador" do 1on1 (conteúdo privado, apagar, configurar). */
  adminVp: boolean;
  /** Diretor de outra diretoria: só lê o acompanhamento da própria diretoria. */
  diretorLeitor: boolean;
  /** Vê o acompanhamento de outras pessoas (equipe da VP ou diretor). */
  gestao: boolean;
};

export const obterPapelVp = cache(async (): Promise<PapelVp> => {
  const usuario = await obterUsuario();
  const equipeVp = usuario.cargoEm("rh") !== null;
  const adminVp = usuario.ehDiretorDe("rh");
  const diretorLeitor = !equipeVp && usuario.ehDiretor;
  return { usuario, equipeVp, adminVp, diretorLeitor, gestao: equipeVp || diretorLeitor };
});

/** Membros ativos com as diretorias (para listas de escolha e nomes). Todo membro ativo lê membros pelo RLS. */
export const carregarPessoas = cache(async (): Promise<PessoaVp[]> => {
  const supabase = await criarClienteServidor();
  const [{ data: membros }, { data: cargos }] = await Promise.all([
    supabase.from("membros").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("membro_diretorias").select("membro_id, diretoria"),
  ]);
  return (membros ?? []).map((m) => {
    const diretorias = (cargos ?? []).filter((c) => c.membro_id === m.id).map((c) => c.diretoria);
    return { id: m.id, nome: m.nome, diretorias, daVp: diretorias.includes("rh") };
  });
});

/**
 * Pessoas cujo acompanhamento quem logou pode ver como gestão: a equipe da VP vê todos (menos si);
 * o diretor vê quem está em alguma das diretorias que ele dirige.
 */
export function acompanhados(papel: PapelVp, pessoas: PessoaVp[]) {
  const { usuario } = papel;
  if (papel.equipeVp) return pessoas.filter((p) => p.id !== usuario.id);
  if (!papel.diretorLeitor) return [];
  const dirige = usuario.cargos.filter((c) => c.cargo === "diretor").map((c) => c.diretoria);
  return pessoas.filter((p) => p.id !== usuario.id && p.diretorias.some((d) => dirige.includes(d)));
}

export async function frequencia1on1(): Promise<number> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("parametros_vp").select("frequencia_1on1_dias").maybeSingle();
  return data?.frequencia_1on1_dias ?? 30;
}
