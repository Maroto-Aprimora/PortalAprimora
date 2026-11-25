import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type Cargo = Enums<"cargo">;
export type UsuarioAtual = {
  id: string;
  nome: string;
  email: string;
  cargos: { diretoria: string; cargo: Cargo }[];
  /** Cargo na diretoria (ou null se não pertence). */
  cargoEm: (diretoria: string) => Cargo | null;
  ehDiretorDe: (diretoria: string) => boolean;
  ehDiretor: boolean;
  /** Diretorias que a pessoa enxerga: as suas + as liberadas por um diretor (membro_visibilidades). */
  diretoriasVisiveis: string[];
  veDiretoria: (diretoria: string) => boolean;
};

/** Usuário logado + cargos. Redireciona para /entrar se não houver sessão válida. Cacheado por requisição. */
export const obterUsuario = cache(async (): Promise<UsuarioAtual> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/entrar");

  const [{ data: membro }, { data: cargos }, { data: extras }] = await Promise.all([
    supabase.from("membros").select("id, nome, email, ativo").eq("id", id).maybeSingle(),
    supabase.from("membro_diretorias").select("diretoria, cargo").eq("membro_id", id),
    supabase.from("membro_visibilidades").select("diretoria").eq("membro_id", id),
  ]);
  if (!membro || !membro.ativo) redirect("/entrar?erro=inativo");

  const lista = cargos ?? [];
  const cargoEm = (d: string) => lista.find((c) => c.diretoria === d)?.cargo ?? null;
  const diretoriasVisiveis = [...new Set([...lista.map((c) => c.diretoria), ...(extras ?? []).map((e) => e.diretoria)])];
  return {
    id: membro.id,
    nome: membro.nome,
    email: membro.email,
    cargos: lista,
    cargoEm,
    ehDiretorDe: (d: string) => cargoEm(d) === "diretor",
    ehDiretor: lista.some((c) => c.cargo === "diretor"),
    diretoriasVisiveis,
    veDiretoria: (d: string) => diretoriasVisiveis.includes(d),
  };
});
