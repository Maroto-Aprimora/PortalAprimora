# Documentação Técnica do Portal Aprimora

**Descrição do sistema na versão atual (estado "como construído")**

| Campo | Valor |
|---|---|
| Documento | DT-PA-001 — Documentação Técnica do Portal Aprimora |
| Versão do documento | 1.24 |
| Data | 09/10/2026 |
| Versão do sistema descrita | `main` no commit `af20f1c` (mescla do PR #7, 05/10/2026) |
| Repositório | `Maroto-Aprimora/PortalAprimora` (privado, GitHub; transferido de `AgenciaValkz/Aprimora`) |
| Produção | https://aprimora.vercel.app |
| Banco de dados | Supabase, projeto `boxweeufsyaknialzedc` (região São Paulo, plano gratuito) |
| Responsável pela diretoria | Diretoria Comercial da Aprimora Jr. |
| Classificação | Uso interno da Aprimora |

> **Como ler este documento.** Ele descreve o que **existe e funciona hoje**, não o que está planejado. Cada
> funcionalidade tem um código (`F-…`) e um status. Use a **Seção 18 (Matriz de rastreabilidade)** para comparar este
> documento com o Planejamento Estratégico de Escopo. Nomes de tabelas, funções, rotas e arquivos são citados
> exatamente como estão no código, para que pessoas e IAs consigam localizá-los.

## Sumário

1. Objetivo, público e convenções
2. Visão geral do produto
3. Arquitetura
4. Tecnologias e versões
5. Estrutura do repositório
6. Autenticação, sessão e autorização
7. Modelo de dados
8. Regras de negócio no banco de dados
9. Módulos funcionais
10. Indicadores e metas automáticas
11. Notificações, push e PWA
12. Integrações
13. Segurança
14. Configuração, implantação e operação
15. Dados
16. Limitações conhecidas e dívida técnica
17. Glossário
18. Matriz de rastreabilidade
19. Histórico do documento

---

# 1. Objetivo, público e convenções

## 1.1 Objetivo

Registrar, com detalhes técnicos, como o Portal Aprimora está construído na versão atual: arquitetura, banco de dados,
regras de negócio, permissões, telas, integrações e limitações. O documento serve de base para:

- novos desenvolvedores (membros da EJ ou terceiros) assumirem o sistema;
- assistentes de IA lerem o contexto antes de propor ou fazer mudanças;
- comparação com o Planejamento Estratégico de Escopo, para priorizar melhorias.

## 1.2 Público

Técnicos (desenvolvimento, dados, infraestrutura) e assistentes de IA. Diretores podem usar as Seções 2, 9 e 18.

## 1.3 Convenções

- **Idioma do sistema:** todo o código de domínio, tabelas, colunas, mensagens e interface estão em **português do
  Brasil** (ex.: `negocios`, `responsavel_id`, `salvarNegocio`). Termos técnicos de bibliotecas ficam em inglês.
- **Status das funcionalidades:**
  - `EM PRODUÇÃO` — publicado em https://aprimora.vercel.app e em uso;
  - `PRONTO, NÃO INSTALADO` — código existe no repositório, mas depende de infraestrutura ou credenciais ainda não
    configuradas;
  - `PARCIAL` — funciona, com lacunas descritas;
  - `NÃO IMPLEMENTADO` — previsto no escopo, sem código.
- **Fuso horário:** o banco grava `timestamptz` (UTC). A interface trabalha em America/São_Paulo, tratado como
  **UTC−3 fixo** (o Brasil não tem horário de verão desde 2019).
- **Referências a arquivos** são relativas à raiz do repositório.

---

# 2. Visão geral do produto

## 2.1 O que é

O Portal Aprimora é um **aplicativo web instalável (PWA)** de gestão interna da Aprimora — Empresa Júnior de
Engenharia de Produção da UTFPR Londrina. Começou pela **Diretoria Comercial** (CRM e funil de vendas, que substitui o
Pipefy) e foi estruturado para receber as demais diretorias.

## 2.2 Usuários e papéis

- **Diretorias** (tabela `diretorias`, campo `slug`): `presidencia` (Presidência, jurídico-financeiro), `rh`
  (exibida como **Vice-Presidência**), `projetos`, `comercial`, `marketing`.
- **Cargos por diretoria** (enum `cargo`): `diretor`, `assessor`, `trainee`. Uma pessoa pode ter cargo em mais de uma
  diretoria (tabela `membro_diretorias`).
- Não há auto-cadastro: só entra quem foi **pré-cadastrado** por um diretor (Seção 6.1).

## 2.3 Módulos e status

| Área | Módulo | Status |
|---|---|---|
| Geral | Painel geral, Agenda, Tarefas (com a Caixa de aprovação: quadro de colunas retráteis ou lista), Notificações (sino + push), PWA | EM PRODUÇÃO |
| Comercial | Desempenho individual, aberto a todo o time (indicadores, rubrica por critério e por semana, ligações avaliadas, plano de melhoria) | EM PRODUÇÃO |
| Presidência | Auditoria (só diretores) | EM PRODUÇÃO |
| Vice-Presidência | Membros (pré-cadastro, cargos, data de entrada, processos seletivos, transferência de carteira) | EM PRODUÇÃO |
| Vice-Presidência | Pontuação (0 a 12, marco em 6) | EM PRODUÇÃO |
| Comercial | Funil (kanban), Empresas e leads, Negócio, Anexos | EM PRODUÇÃO |
| Comercial | Painel comercial (indicadores), Exportação xlsx/csv, Metas (automáticas e manuais) | EM PRODUÇÃO |
| Comercial | Configurações do funil (fases, SLA, campos, cadastros auxiliares) | EM PRODUÇÃO |
| Comercial | Agentes A1 Enriquecedor (botão no negócio, aprovação do decisor) e A4 Analista gerencial (Relatórios da R.I) | EM PRODUÇÃO no portal; fluxos 06 e 07 do n8n a publicar |
| Projetos, Marketing | Telas próprias | FORA DO ESCOPO da v2 (diretorias mantidas no banco, sem telas) |
| Comercial | Da oportunidade à venda (Fase 4): Diagnóstico (`/negocios/[id]/diagnostico`), Precificação (`/precificacao`), Proposta com o A9 (`/proposta`), Dossiê de passagem (`/dossie`); guias Diagnóstico e Precificação em Config. do funil | EM PRODUÇÃO |
| Comercial | Cadência de e-mail (Fase 3): copies do playbook (Config. do funil → Copy), A5 Redator, A6 Monitor de respostas, A7 Organizador do dia | EM PRODUÇÃO no portal; Redator e Monitor desligados até a credencial Gmail da comercial@ e os fluxos 10/11 serem publicados |
| Integrações | n8n (ligações API4COM + Gemini; Enriquecedor; Analista; Redator e Monitor via Gmail API) | EM PRODUÇÃO (fluxos 06–09); 10 e 11 criados, a publicar |
| Integrações | Importação de dados do Pipefy | NÃO IMPLEMENTADO |

---

# 3. Arquitetura

## 3.1 Visão de componentes

```
                 Navegador / PWA (celular e computador)
                               │  HTTPS
                               ▼
        ┌────────────────────────────────────────────────┐
        │ VERCEL — Next.js 16 (App Router)               │
        │  • src/proxy.ts: renova sessão e protege rotas  │
        │  • Server Components: leitura de dados          │
        │  • Server Actions (acoes.ts): gravações         │
        │  • Route Handlers: /api/push, /comercial/exportar│
        └───────────────┬────────────────────────────────┘
                        │ supabase-js / @supabase/ssr (chave publicável + JWT do usuário)
                        ▼
        ┌────────────────────────────────────────────────┐
        │ SUPABASE                                       │
        │  • Auth (e-mail e senha; links por e-mail)      │
        │  • Postgres + RLS (regras de acesso no banco)   │
        │  • Schema "privado": funções auxiliares         │
        │  • Gatilhos (regras do funil, histórico, avisos)│
        │  • pg_cron: SLA 08h05 e notificações 08h10      │
        │  • pg_net: chama /api/push da Vercel            │
        │  • Storage: bucket privado "anexos"             │
        └───────────────┬────────────────────────────────┘
                        │ pg_net (HTTP) com segredo compartilhado
                        ▼
              /api/push (Vercel) ──▶ Web Push (VAPID) ──▶ aparelhos

   (PRONTO, NÃO INSTALADO) n8n da Aprimora ──▶ /api/n8n/* do portal (rotas ainda não criadas)
                                          ├─▶ Google Drive, Gemini, Gmail
```

## 3.2 Princípios de projeto

1. **Segurança no banco.** Toda tabela tem RLS. A interface esconde botões por conveniência, mas quem garante a
   permissão é o Postgres. O app usa apenas a **chave publicável** e age sempre como o usuário logado; **nenhuma chave
   `service_role` é usada pelo app**.
2. **Regras de negócio críticas em gatilhos.** Movimentação de fase, campos obrigatórios, rodízio, histórico, SLA,
   notificações e proteções de campos rodam no banco, valendo para qualquer cliente (tela, script ou integração).
3. **Funções auxiliares fora da API.** As funções usadas nas políticas RLS ficam no schema `privado`, que não é
   exposto pela API REST do Supabase.
4. **Servidor primeiro.** As páginas são Server Components que leem do Supabase com a sessão do usuário; gravações
   passam por Server Actions validadas com Zod.
5. **Configuração em vez de código.** Fases, SLA, campos por fase, motivos, origens, segmentos, serviços, tipos de
   atividade, reuniões recorrentes, metas e processos seletivos são editados pelos diretores na própria interface.

---

# 4. Tecnologias e versões

| Camada | Tecnologia | Versão (package.json) | Observação |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.3.8 | Usa `src/proxy.ts` (antigo *middleware*), `params`/`searchParams` assíncronos e `PageProps<"/rota">` gerado por `next typegen` |
| UI | React | 19.2.8 | Server Components + Server Actions |
| Linguagem | TypeScript | ^5 | `tsc --noEmit` no CI |
| Estilo | Tailwind CSS | ^4 | Tokens semânticos em `src/app/globals.css` (`bg-marca`, `text-texto-suave`, `bg-destaque`…) |
| Banco/Auth/Storage | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | ^2.117 / ^0.12 | Postgres com `pg_cron`, `pg_net`, `pg_trgm`, `unaccent` |
| Validação | Zod | ^4.6 | Em todas as Server Actions |
| Ícones | lucide-react | ^1.52 | — |
| Tema | next-themes | ^0.4 | Claro (padrão) e escuro |
| Avisos na tela | sonner | ^2.0 | *Toasts* |
| Push | web-push | ^3.6 | Chaves VAPID |
| Planilhas | write-excel-file | ^4.1 | Exportação .xlsx |
| Hospedagem | Vercel | — | Equipe "Aprimora", projeto `aprimora` |
| CI | GitHub Actions | — | `.github/workflows/ci.yml`: lint, tipos e build |

Componentes visuais são próprios (`src/components/ui/*`); não há biblioteca de componentes de terceiros.
Tamanho aproximado: ~9.000 linhas de TypeScript em `src/` e ~2.000 linhas de SQL em `supabase/migrations/`.

---

# 5. Estrutura do repositório

```
.github/workflows/ci.yml        CI (lint, typegen + tsc, build)
docs/
  DESENVOLVIMENTO.md            Guia do desenvolvedor (convenções, regras, variáveis)
  CONFIGURAR-EMAIL-E-LOGIN.md   SMTP, URLs de redirecionamento e modelos de e-mail
  PENDENCIAS.md                 Pendências fora do código
  escopo/                       Documento de Escopo v1.0 (PDF/DOCX) e seu gerador
  tecnico/                      Este documento
n8n/                            Instância n8n da Aprimora e fluxos (PRONTO, NÃO INSTALADO)
public/                         Ícones do PWA, logos, sw.js (service worker)
src/
  proxy.ts                      Sessão e proteção de rotas
  app/
    (auth)/                     entrar, primeiro-acesso, esqueci-senha
    auth/confirmar/             Recebe links de e-mail (hash, token_hash ou code)
    (app)/                      Área logada (layout com menu lateral)
      painel, agenda, tarefas, auditoria, membros, vice-presidencia/pontuacao,
      comercial (+ exportar), funil (+ configuracoes), empresas, negocios/[id],
      metas (+ configuracoes), definir-senha, configuracoes (redireciona)
    api/push/route.ts           Entrega das notificações push
    manifest.ts                 Manifesto do PWA
  components/
    ui/                         Botão, campos, cartão, diálogo, selo
    app/                        Menu lateral, sino, tema, medidor de pontos
    crm/                        Anexos, campos de empresa, mover negócio
    agenda/                     Formulário de atividade, atividades do negócio
  lib/
    supabase/                   Clientes (navegador, servidor, convite), sessão, tipos gerados
    usuario.ts                  Usuário logado e cargos (cache por requisição)
    crm.ts / crm-servidor.ts    Regras puras do CRM / carga da configuração comercial
    indicadores*.ts, periodo.ts Indicadores do funil e catálogo das metas automáticas
    resumo-comercial.ts         Números resumidos do funil
    agenda.ts, datas.ts         Agenda, ocorrências recorrentes e fuso
    pontuacao.ts, exportar.ts   Pontuação; geração de xlsx/csv
supabase/
  migrations/                   Migrações SQL (fonte da verdade do banco)
  dados/                        Scripts de dados fictícios (já removidos do banco)
```

Convenção de pastas por tela: `page.tsx` (Server Component), `acoes.ts` (Server Actions com `"use server"`),
`componentes.tsx` (Client Components).

---

# 6. Autenticação, sessão e autorização

## 6.1 Cadastro fechado (pré-cadastro)

1. Um diretor cria o pré-cadastro em **Membros** (`pre_cadastros` + `pre_cadastro_diretorias`, com cargo e diretoria).
2. O convite é um link mágico do Supabase Auth (`signInWithOtp`), disparado com o cliente `criarClienteConvite()`
   (fluxo *implicit*, porque o link é aberto no navegador do convidado). A pessoa também pode pedir em **Primeiro
   acesso**.
3. Quando a conta é criada em `auth.users`, o gatilho **`ao_criar_usuario`** procura o e-mail em `pre_cadastros`:
   - não encontrou → a criação é **recusada** (exceção);
   - encontrou → cria `membros` (nome e data de entrada do pré-cadastro), cria os cargos em `membro_diretorias` e
     marca `aceito_em`.
4. A pessoa define a senha em `/definir-senha`. Daí em diante entra com e-mail e senha.

O cargo nunca vem do navegador: só do pré-cadastro feito por um diretor.

## 6.2 Sessão

- Cookies gerenciados por `@supabase/ssr`. `src/proxy.ts` chama `atualizarSessao()` (`src/lib/supabase/sessao.ts`) em
  toda requisição, valida com `auth.getClaims()` e redireciona para `/entrar?voltar=…` quem não está logado.
- Rotas públicas: `/entrar`, `/primeiro-acesso`, `/esqueci-senha`, `/auth/*`, `/api/push`, `/api/n8n/*` e `/api/integracoes/*` (protegidas por segredo ou token).
- `/auth/confirmar` trata os três formatos de link do Supabase (fragmento `#access_token`, `token_hash` e `code`).
- `obterUsuario()` (`src/lib/usuario.ts`) carrega o membro e seus cargos uma vez por requisição e expõe `cargoEm()`,
  `ehDiretorDe()` e `ehDiretor`. Membro desativado é mandado de volta ao login.

## 6.3 Autorização (RLS)

Funções auxiliares no schema `privado`, todas `security definer` com `search_path = ''`:

| Função | Retorna verdadeiro quando |
|---|---|
| `membro_ativo()` | o usuário é membro ativo |
| `cargo_em(d)` | (retorna o cargo do usuário na diretoria `d`) |
| `eh_diretor_de(d)` / `eh_diretor()` | é diretor da diretoria `d` / de alguma diretoria |
| `pertence_a(d)` | tem qualquer cargo em `d` |
| `diretoria_do_funil(f)` / `diretoria_da_fase(f)` | (retornam a diretoria dona) |
| `participa_do_negocio(n)` | é responsável ou participante do negócio |
| `pode_editar_negocio(n)` / `pode_editar_empresa(e)` | qualquer membro da diretoria do funil (Comercial), desde 14/10/2026 |
| `participa_da_atividade(a)` / `pode_gerir_atividade(a)` | responsável/participante da atividade; ou diretor da diretoria dela |
| `responsavel_da_tarefa(t)` | é um dos responsáveis da tarefa |

Resumo das regras:

| Recurso | Ler | Criar | Editar | Excluir |
|---|---|---|---|---|
| Membros, cargos, diretorias | membros ativos | diretor (pré-cadastro, cargos) | diretor da diretoria; o próprio membro edita dados básicos | diretor |
| Empresas e contatos | membros ativos | membros da diretoria | `pode_editar_empresa` | diretor |
| Negócios | membros ativos | membros da diretoria do funil | `pode_editar_negocio` (todo membro do Comercial, inclusive trocar o responsável) | diretor |
| Histórico de negócio | membros ativos | só gatilhos | — | — |
| Configurações (fases, campos, motivos, origens, segmentos, serviços, metas, tipos de atividade, reuniões) | membros ativos | diretor da diretoria | diretor da diretoria | diretor da diretoria |
| Atividades | membros ativos | membros da diretoria do tipo (R.G: só diretores) | participante, quem edita o negócio ligado ou diretor | idem, exceto trainee |
| Tarefas | diretoria, diretores e responsáveis | diretor; qualquer membro cria tarefa pessoal (manual, para si); sistema e agentes via `privado.criar_tarefa` | diretor (tudo), autor da tarefa pessoal (tudo) ou responsável (só `status`) | diretor ou autor da tarefa pessoal |
| Notificações | só as próprias | só gatilhos | só `lida_em` | só as próprias |
| Pontuação | o próprio; diretores veem todas | diretor da Vice-Presidência (`rh`) | só cancelamento, pela Vice-Presidência | não existe exclusão |
| Auditoria | diretores | só funções internas | — | — |
| Anexos (tabela e Storage) | membros ativos | quem pode editar o negócio | — | quem pode editar o negócio |

Regras extras por gatilho: trainee não marca ganho; só diretor muda `ativo`, `email` e `data_entrada` de um membro;
uma diretoria nunca fica sem diretor ativo (`garantir_diretor`).

---

# 7. Modelo de dados

Fonte da verdade: `supabase/migrations/*.sql`. Tipos TypeScript gerados em `src/lib/supabase/database.types.ts`.
Todas as tabelas de domínio usam `uuid` (`gen_random_uuid()`), exceto `auditoria` e `negocio_historico` (`bigint`
identity). Colunas `created_at`/`updated_at` em `timestamptz`.

## 7.1 Enums

| Enum | Valores |
|---|---|
| `cargo` | diretor, assessor, trainee |
| `tipo_fase` | aberta, ganho, perda, pausa |
| `macroetapa` | prospeccao, cadencia, oportunidade, venda, ganho, pausa, perda |
| `acao_sla` | alertar, mover |
| `tipo_campo` | texto, texto_longo, data, numero, moeda, membros, selecao, booleano, link |
| `tipo_motivo` | perda, desqualificacao |
| `area_servico` | negocios, producao, qualidade |
| `status_atividade` | pendente, confirmada, realizada, remarcada, cancelada |
| `prioridade` | baixa, media, alta |
| `status_tarefa` | pendente, em_andamento, concluida |
| `origem_registro` | manual, sistema, agente (tarefas e ligações) |
| `prazo_tarefa_auto` | mesmo_dia, proximo_dia_util, proximo_toque, data_retorno, vespera_compromisso |

## 7.2 Pessoas e organização

| Tabela | Colunas principais | Função |
|---|---|---|
| `diretorias` | `slug` (PK), nome, ordem, ativa | As 5 diretorias. `rh` é exibida como "Vice-Presidência" |
| `membros` | id (= `auth.users.id`), nome, email, telefone, ativo, data_entrada | Pessoas com acesso |
| `membro_diretorias` | membro_id, diretoria, cargo, participa_rodizio | Cargo por diretoria; rodízio de leads |
| `pre_cadastros` / `pre_cadastro_diretorias` | email, nome, data_entrada, convite_enviado_em, aceito_em / cargo por diretoria | Lista de quem pode criar conta |
| `processos_seletivos` | nome, data | Define quem é "membro novo" (entrou a partir do último processo) |
| `auditoria` | autor_id, acao, entidade, entidade_id, dados (jsonb) | Ações sensíveis (cargos, ativação, carteira, exclusão de fase) |
| `pontuacoes` | membro_id, pontos (−12 a 12, ≠ 0), motivo, data, cancelado_em/por, criado_por | Lançamentos de pontos; total = soma dos não cancelados, limitado a 0..12 |

## 7.3 CRM (Comercial)

| Tabela | Colunas principais | Função |
|---|---|---|
| `funis` | diretoria, chave, nome | Funil por diretoria (hoje só `comercial`) |
| `fases` | funil_id, chave, nome, ordem, macroetapa, tipo, probabilidade, sla_dias, acao_sla, fase_destino_sla, auto_mover_para, distribui_responsavel, exige_motivo, ativa, excluida_em | Colunas do kanban e suas regras |
| `fase_campos` | fase_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem | Campos dinâmicos por fase (valores em `negocios.campos`, jsonb) |
| `empresas` | nome, razao_social, cnpj, segmento_id, telefone, e-mails, site, rede_social, endereco, cidade, uf, ficticio; do Enriquecedor: porte, cnae, situacao_cadastral, enriquecido_em, enriquecimento (jsonb com o resultado e as fontes); colunas derivadas `nome_normalizado`, `cnpj_digitos`, `telefone_digitos` | Leads/clientes. Colunas derivadas para busca e duplicidade |
| `contatos` | empresa_id, nome, cargo, decisor, email, telefone, linkedin, nao_contatar | Pessoas da empresa |
| `negocios` | funil_id, empresa_id, contato_id, titulo, fase_id, responsavel_id, valor, origem_id, campos (jsonb), motivo_id, retorno_em, entrou_na_fase_em, ganho_em, encerrado_em, ficticio | O card do funil |
| `negocio_historico` | negocio_id, fase_origem_id, fase_destino_id, autor_id, automatico, motivo_id, comentario, responsavel_id (da época) | Toda movimentação de fase (base dos indicadores) |
| `negocio_servicos`, `negocio_participantes` | `negocio_servicos.valor` | Serviços da Carta de Serviços (com valor por serviço) e pessoas envolvidas |
| `rodizio_estado` | funil_id, ultimo_membro_id | Ponteiro do rodízio |
| `segmentos`, `origens`, `servicos`, `motivos` | diretoria, nome, ativo (+ tipo/área/ordem); `origens.chave`, `motivos.chave`, `motivos.exige_comentario`, `motivos.marca_nao_contatar` | Cadastros auxiliares configuráveis. Listas de motivos e origens da v2 (PE-PA-002, 3.3 e 3.4) |
| `resultados_ligacao` | chave, nome, ordem, ativo, fase_destino_id, motivo_id, conta_tentativa, exige_retorno, registra_decisor, marca_telefone_invalido, tipo_atividade_id, tarefa_titulo, tarefa_prazo | Lista fechada de resultados de ligação e a ação de cada um (9 resultados iniciais) |
| `ligacoes` | negocio_id, contato_id, membro_id, inicio, duracao_seg, resultado_id, proximo_passo, retorno_em, compromisso_em, decisor_nome, decisor_melhor_horario, comentario, origem, resultado_aplicado_em; reservadas para a Fase 2: api4com_id, gravacao_url, transcricao, resumo | Registro de cada ligação |
| `cadencia_passos` | dia (D0 = entrada em E-mail), canal (email/ligacao), titulo, descricao, so_sem_contato, ativo | Cadência padrão (PE-PA-002, 3.2): cada toque vira tarefa no dia |
| `parametros_comercial` | cadencia_dias_reciclagem (21), reciclagem_retorno_dias (90), follow_up_proposta_dias (3), envio_hora_inicio (8), envio_hora_fim (18), remetente_nome | Prazos da cadência e do envio de e-mails, editáveis pelo diretor |
| `diagnostico_areas`, `diagnostico_perguntas` | chave, nome, servico_id (serviço sugerido), ordem, ativo / area_id, texto, ordem, ativo | Checklist de diagnóstico (10 áreas, 50 perguntas iniciais; nota 4 é sempre o melhor). Só o diretor altera |
| `diagnosticos` | negocio_id, realizado_em, respostas (jsonb: pergunta → nota 1–4 e comentário), observacoes, status (rascunho/concluido), maturidade (jsonb por área ao concluir), analise_status (gerando/pronto/erro), trabalho_id | Diagnóstico do negócio; o app só altera respostas, observações e data (o resto é do banco) |
| `propostas` | negocio_id (único), diagnostico_id, resumo_diagnostico, servicos_sugeridos (jsonb), escopo, texto, status (rascunho/revisada), gerado_em, revisado_por/em | Rascunho do A9 e revisão do responsável; o A9 não sobrescreve escopo e texto depois de revisados |
| `parametros_precificacao` | valor_hora_consultor, valor_hora_gerente, margem_minima, margem_maxima, imposto, fatores (jsonb: nome e opções com multiplicador; a primeira é a padrão) | Parâmetros da precificação, editáveis pelo diretor |
| `precificacoes` | negocio_id (único), fatores (escolhas), horas_consultor, horas_gerente, custos (jsonb), multiplicador, custo_base, preco_minimo, preco_maximo, preco_final, definido_por/em, observacoes | Calculadora do negócio. `calcular_precificacao` (gatilho) faz a conta; preço final só do diretor comercial e vira `negocios.valor` |
| `copies_email` | versao (V1, V2… sequencial), nome, uso (cadencia/pediu_email/pos_proposta), regra (qualquer/segmento/origem/sem_site/com_dores), regra_valor, ativo | Copies do playbook. Regra específica ganha da "qualquer"; copies da mesma regra alternam (A/B, a menos usada primeiro); o lead fica com a mesma copy a cadência toda. Só o diretor comercial altera |
| `copies_email_mensagens` | copy_id, passo_id (toque de e-mail da cadência; nulo fora dela), assunto, corpo | Um e-mail por toque, com `{{variáveis}}` que o Redator preenche |
| `emails` | negocio_id, contato_id, membro_id, copy_id, passo_id, uso, d0, para, assunto, corpo, status (rascunho/aprovado/enviado/erro/cancelado), responder_a, gmail_id, thread_id, enviado_em, aprovado_por, erro | E-mails da cadência; só funções internas escrevem |
| `respostas_email` | email_id, negocio_id, gmail_id (único), thread_id, de, assunto, trecho, recebido_em, classificacao (interessado/retornar_depois/recusa/descadastro/ausencia/outro), resumo, retorno_em, aplicada_em | Respostas dos leads (A6) |
| `agentes` | chave, codigo (A1…A12), nome, descricao, tipo, prioridade, fase_roadmap, quem_aprova, ativo | Os 12 agentes do PE-PA-002 + "Teste da fila"; liga/desliga em Config. do funil |
| `trabalhos` | agente, tipo, negocio_id, payload, status (pendente/processando/concluido/erro/cancelado), tentativas, max_tentativas, proximo_em, reservado_em, resultado, erro, chave | Fila que o n8n consome; só funções internas escrevem |
| `aprovacoes` | agente, tipo, trabalho_id, negocio_id, ligacao_id, email_id, resposta_id, responsavel_id, titulo, resumo, conteudo, conteudo_original, status, decidido_por/em, comentario | Caixa de aprovação (coluna "Para aprovar" em Tarefas) |
| `relatorios` | tipo ('ri'), de, ate, dados (números calculados no banco), analise (texto do A4), texto_revisado, status (gerando/pronto/erro), erro, trabalho_id, revisado_por/em, criado_por | Relatórios da R.I; só o diretor comercial lê e revisa |
| `rubrica_criterios` | chave, nome, descricao, ordem, ativo | Rubrica do Avaliador (PE-PA-002, 5.1), 7 critérios iniciais; o diretor edita |
| `avaliacoes_ligacao` | ligacao_id (único), membro_id, notas (jsonb: chave, nome, nota 1–4, comentário), media, comentario | Avaliação de cada ligação pelo A3; todo o time vê (desde 14/10/2026) |
| `eventos_integracoes` | origem, recebido_em, payload, externo_id (id da chamada na API4COM, único por origem), processado_em, ligacao_id, erro | Eventos recebidos de sistemas externos (API4COM), como chegaram; só o diretor lê |
| `feriados` | data, nome | Dias não úteis (nacionais 2026–2027 e aniversário de Londrina); tarefas automáticas pulam fins de semana e feriados |
| `metas` | diretoria, trimestre (`1T2026`), objetivo, codigo, titulo, alvo, unidade, realizado_manual, indicador, membro_id, peso | OKRs trimestrais; `indicador` liga a meta a um cálculo automático |
| `anexos` | negocio_id, nome, caminho, tamanho (≤ 10 MB), tipo_mime, enviado_por | Metadados dos arquivos do bucket `anexos` |

Fases do funil Comercial (dados iniciais, configuráveis): Entrada de leads → Enriquecimento → Coleta de dados
concluída → E-mail → Coldcall (semana 1) → Coldcall (semana 2) → Retornar futuro → Oportunidade → Diagnóstico agendado →
Elaboração de escopo → Apresentação de proposta → **Projetos Aprimora** (ganho); Reciclagem (pausa); Projeto não
vendido e Lead não qualificado (perdas, exigem motivo).

## 7.4 Rotina

| Tabela | Colunas principais | Função |
|---|---|---|
| `tipos_atividade` | diretoria (nula = geral), chave, nome, cor, ligada_a_lead, exige_confirmacao, ativo | Diagnóstico, Pré-escopo, Apresentação de proposta, Coldcall, Prospecção de campo, ProspectDay, Evento MEJ, R.I, R.G |
| `atividades` | tipo_id, diretoria, titulo, inicio, fim, local, link_reuniao, empresa_id, negocio_id, responsavel_id, status, resumo, proximos_passos, remarcada_para_id, remarcada_de_id | Compromissos da agenda. Remarcar deixa a original como `remarcada` e cria outra na data nova |
| `atividade_participantes` | atividade_id, membro_id | — |
| `reunioes_recorrentes` | tipo_id, diretoria, titulo, dia_semana, hora_inicio, hora_fim, local, valida_de, valida_ate, ativa | R.I (Comercial, seg 15:30–16:40) e R.G (todos, sex 15:30–16:40). **As ocorrências não são gravadas:** são calculadas na leitura (`ocorrenciasRecorrentes()`), então mudar o horário vale para as datas futuras |
| `tarefas`, `tarefa_responsaveis` | diretoria, titulo, descricao, prazo, prioridade, status, negocio_id, atividade_id, origem, chave (única), concluida_em | Tarefas distribuídas por diretores ou criadas pelo sistema (`privado.criar_tarefa`) |
| `notificacoes` | membro_id, tipo, titulo, mensagem, link, chave (única por membro), lida_em | Avisos do sino; `chave` impede duplicidade |
| `push_assinaturas` | membro_id, endpoint, p256dh, auth, user_agent | Aparelhos inscritos no Web Push |
| `privado.config` | chave, valor | `push_url` e `push_segredo` (fora da API) |

---

# 8. Regras de negócio no banco de dados

## 8.1 Gatilhos

| Gatilho (tabela) | Quando | O que faz |
|---|---|---|
| `ao_criar_usuario` (`auth.users`) | após inserir | Aceita só e-mails pré-cadastrados; cria membro e cargos |
| `proteger_membro` (`membros`) | antes de atualizar | Só diretor muda `ativo`, `email`, `data_entrada`; audita ativação |
| `garantir_diretor` (`membro_diretorias`) | após inserir/atualizar/excluir | Impede diretoria sem diretor ativo; audita mudança de cargo |
| `antes_de_salvar_negocio` (`negocios`) | antes de inserir/atualizar | Valida a fase; bloqueia ganho por trainee; exige motivo nas perdas; exige campos obrigatórios da fase de origem ao **avançar**; atualiza `entrou_na_fase_em`, `ganho_em`, `encerrado_em`; aplica o **rodízio** quando a fase distribui responsável |
| `depois_de_salvar_negocio` (`negocios`) | após inserir ou mudar `fase_id` | Grava `negocio_historico`; executa `auto_mover_para` (ex.: Entrada → Enriquecimento) |
| `notificar_responsavel_negocio` (`negocios`) | após inserir/atualizar | Notifica "Novo lead para você" quando o responsável muda (inclusive pelo rodízio) |
| `antes_de_salvar_atividade` (`atividades`) | antes de inserir/atualizar | Herda a diretoria do tipo; completa a empresa pelo negócio; carimba confirmação/realização |
| `proteger_tarefa` (`tarefas`) | antes de atualizar | Não diretor só altera `status`; carimba `concluida_em` |
| `enviar_push` (`notificacoes`) | após inserir | Chama `/api/push` via `pg_net` com as assinaturas do membro |
| `proteger_pontuacao` / `notificar_pontuacao` (`pontuacoes`) | antes de atualizar / após inserir | Lançamento só pode ser cancelado, nunca editado; avisa a pessoa com o total atual |
| `antes_de_salvar_ligacao` (`ligacoes`) | antes de inserir/atualizar | Exige resultado (registro manual), data de retorno e data do compromisso quando o resultado pede; resultado aplicado não muda |
| `aplicar_resultado_ligacao` (`ligacoes`) | após inserir / mudar `resultado_id` | Uma vez por ligação: conclui as tarefas de ligação abertas do negócio; move a fase (só para a frente, perdas e pausas sempre, nunca reabre encerrado; motivo do resultado); grava `retorno_em`; marca telefone inválido (contato ou empresa); cria o compromisso na agenda (90 min) e a tarefa do resultado com prazo em dia útil |
| `notificar_tarefa_atribuida` (`tarefa_responsaveis`) | após inserir | Notifica (sino + push) toda tarefa atribuída, exceto a manual criada para si mesmo |
| `a_validar_motivo_negocio` / `aplicar_motivo_negocio` (`negocios`) | antes / após salvar motivo | Motivo com `exige_comentario` ("Outro") exige `motivo_detalhe`; motivo com `marca_nao_contatar` marca o contato do negócio (ou todos da empresa) |
| `tarefas_ao_mudar_fase` (`negocio_historico`) | após inserir | Ao sair da cadência conclui as tarefas de cadência; ao entrar em Oportunidade cria o follow-up para marcar o diagnóstico; ao voltar da Reciclagem (automático) cria "Retomar contato" |
| `concluir_tarefas_da_atividade` (`atividades`) | após mudar status | Compromisso realizado, cancelado ou remarcado conclui a tarefa "Hoje às…" ligada a ele |
| `somar_valor_servicos` (`negocio_servicos`) | após inserir/atualizar/excluir | Quando algum serviço tem valor, `negocios.valor` = soma dos valores |
| `agentes_ao_mudar_fase` (`negocio_historico`) | após inserir | Entrou em Enriquecimento: enfileira o trabalho do Enriquecedor (A1), se ligado |
| `aplicar_aprovacao` (`aprovacoes`) | após mudar status | Aprovado `decisor_empresa`: cria ou atualiza o contato decisor (vira o contato do negócio, se vazio), completa os e-mails da empresa e acrescenta as hipóteses de dor ao negócio |
| (A2) `privado.processar_eventos_api4com()` | chamado pelo webhook e pela consulta do n8n | Chamada encerrada → ligação no negócio aberto da empresa (telefone: últimos 10 dígitos, contato ou empresa; membro pelo e-mail da API4COM). Com conversa (≥ 15 s e gravação): trabalho do Agente de ligação; sem conversa: aprovação "Não atendeu" sem IA. Sem negócio: tenta de novo por 7 dias |
| `aplicar_aprovacao` (tipos da Fase 3) | após mudar status | `email` aprovado (com as edições; recusa se sobrar `{{ }}`): e-mail vai para a fila de envio na próxima janela (dias úteis, horário do parâmetro), no mesmo fio do anterior; descartado: rascunho cancelado. `resposta_recusa` aprovada: encerra em Lead não qualificado com o motivo |
| `calcular_precificacao` / `preco_final_no_negocio` (`precificacoes`) | antes / depois de salvar | Custo base = horas × valor da hora + custos; multiplicador = produto dos fatores; mínimo e máximo = custo × multiplicador × (1 + margem) ÷ (1 − imposto). Preço final: só o diretor; copia para o valor do negócio |
| `passagem_para_projetos` (`negocio_historico`) | após inserir | A10: card entra em fase de ganho (agente "Passagem" ligado) → tarefa "Receber projeto" de prioridade alta para o diretor de Projetos (sem ninguém lá, para o diretor comercial) e aviso ao responsável com o link do dossiê |
| `agentes_apos_resultado_ligacao` (`ligacoes`) | após aplicar resultado | Resultado "Pediu e-mail": o Redator prepara o e-mail com material (copy de uso `pediu_email`) |
| `*_updated_at` | antes de atualizar | Atualiza `updated_at` |

## 8.2 Funções chamáveis pelo app (RPC)

| Função | Segurança | Uso |
|---|---|---|
| `mover_negocio(...)` | invoker (respeita RLS) | Move um negócio com motivo, comentário e data de retorno |
| `empresas_semelhantes(...)` | — | Aviso de empresa duplicada (CNPJ, telefone, domínio ou nome parecido, via `pg_trgm`) |
| `transferir_carteira(de, para, diretoria)` | definer, exige diretor | Passa negócios abertos, tarefas abertas e atividades futuras; audita |
| `excluir_fase(fase, destino)` | definer, exige diretor | Move os negócios e marca a fase como excluída (`excluida_em`), preservando o histórico; bloqueia a primeira fase e a última de ganho |
| `remarcar_atividade(atividade, novo_inicio, novo_fim?, motivo?)` | invoker (respeita RLS) | Marca a atividade como `remarcada` e cria a nova (mesmos participantes) |
| `enriquecer_negocio(negocio)` | definer, exige poder editar o negócio | Botão "Enriquecer agora": põe o negócio na fila do Enriquecedor (recusa se o agente estiver desligado ou já houver trabalho pendente) |
| `concluir_diagnostico(diagnostico)` / `reabrir_diagnostico(diagnostico)` | definer, exige poder editar o negócio | Calcula o mapa de maturidade (média por área) e enfileira o A9; reabrir volta a rascunho |
| `indicadores_email(de, ate, responsavel?)` | invoker (respeita RLS) | Enviados, respondidos, taxa de resposta (automática não conta), por classificação e por copy (Painel comercial e guia Copy) |
| `n8n_registrar_respostas(segredo, mensagens)` | definer, segredo do n8n | Mensagens da caixa da comercial@: guarda só as que respondem um fio enviado (uma vez cada), avisa o responsável e enfileira a classificação |
| `gerar_relatorio_ri(de?, ate?)` | definer, exige diretor comercial | Cria o relatório com os números (`privado.dados_relatorio_ri`: semana, trimestre, cada membro, SLA estourado) e enfileira o Analista gerencial; agente desligado → relatório só com números |

Funções internas (schema `privado`): `destinatario_negocio(negocio, reserva)` (responsável, senão quem pediu, senão o diretor comercial), `enfileirar_enriquecimento`, `aplicar_enriquecimento` (dados públicos só em campos vazios; aprovação `decisor_empresa`; tarefa "Completar dados do lead" com o que faltar), `aplicar_relatorio`, `aplicar_ligacao` (transcrição e resumo na ligação, aprovação "Confirmar resultado da ligação" e avaliação), `aprovacao_resultado_ligacao`, `aplicar_resultado_agente` (despacho por agente, chamado por `n8n_concluir`), `criar_tarefa(...)` (tarefa do sistema/agente com `chave` para não duplicar), `email_destino` (contato do negócio, decisor ou e-mail da empresa; "não contatar" bloqueia), `escolher_copy`, `enfileirar_redacao`, `aplicar_redacao`, `aplicar_envio`, `aplicar_classificacao` (interessado → Oportunidade e retornar depois → Retornar futuro, sozinhos e só para a frente; recusa/descadastro → aprovação; descadastro marca "não contatar"), `mover_por_chave`, `proxima_janela_envio`, `notificar`, `teve_contato` (ligação efetiva ou resposta real ao e-mail), `dia_util(data)`, `dia_util_anterior(data)`, `hoje()`.

## 8.3 Tarefas agendadas (pg_cron, horário UTC)

| Job | Horário | Função | O que faz |
|---|---|---|---|
| `aplicar-slas-diario` | 11:05 UTC (08:05 Brasília) | `privado.aplicar_slas()` | Move negócios com SLA estourado em fases com ação "mover" (Oportunidade: 15 dias → E-mail); devolve ao funil os da Reciclagem com data de retorno vencida |
| `tarefas-diarias` | 10:30 UTC (07:30 Brasília) | `privado.gerar_tarefas_diarias()` | Só em dia útil: tarefas dos toques da cadência que vencem no dia (ou nos dias não úteis anteriores), sem duplicar ligação já marcada por um resultado; toque de e-mail com Redator ligado, copy e e-mail do lead vira trabalho do Redator (senão, tarefa manual); resposta real do lead pausa a contagem; follow-up pós-proposta N dias úteis depois de entrar em Apresentação de proposta; A7 Organizador: notificação "Seu dia" (`resumo_dia`) para cada membro; D21 sem contato efetivo → Reciclagem com retorno em 90 dias; tarefa "Hoje às…" para cada compromisso ligado a lead |
| `notificacoes-diarias` | 11:10 UTC (08:10 Brasília) | `privado.gerar_notificacoes_diarias()` | SLA a 80% (`sla_proximo`) e estourado (`sla_estourado`); tarefa vencendo hoje (`tarefa_hoje`); R.I/R.G do dia (`reuniao_hoje`); atividade de amanhã ainda não confirmada, para os diretores (`atividade_sem_confirmacao`) |

---

# 9. Módulos funcionais

Menu lateral (`src/components/app/menu-lateral.tsx`): **Início, Agenda, Tarefas** (gerais) e seções retráteis:
Comercial, Vice-Presidência (Membros, Pontuação, Painel geral) e Presidência (Auditoria, só diretores). Desde a v2 o
portal é exclusivo do Comercial: Projetos e Marketing não aparecem no menu (as diretorias continuam no banco, sem
evolução). Grupos sem itens não são exibidos. O menu recolhe para uma barra de ícones
(preferência no `localStorage`). O sino de notificações fica no canto superior direito.

| Código | Rota | Quem acessa | Funcionalidade | Status |
|---|---|---|---|---|
| F-GER-01 | `/painel` | todos | **Início (Minhas tarefas)**: fila do dia (atrasadas, hoje, próximos 7 dias, sem prazo) com concluir, registrar ligação e abrir o negócio em um toque; compromissos de hoje | EM PRODUÇÃO |
| F-GER-06 | `/vice-presidencia/painel-geral` | todos | Painel geral da v1 (agenda, R.I/R.G, tarefas, pontuação, cartões da Vice-Presidência e do Comercial), mantido para comparação; sem cartões "Em breve" | EM PRODUÇÃO |
| F-GER-02 | `/agenda` | todos | Visão mês/lista, filtro por pessoa, criar/editar atividades, confirmar/realizar/**remarcar**/cancelar; reuniões recorrentes somente leitura | EM PRODUÇÃO |
| F-GER-03 | `/agenda/configuracoes` | diretores | Reuniões recorrentes (dia, horário, local, vigência) e tipos de atividade (cor, exige confirmação, ligada a lead) | EM PRODUÇÃO |
| F-GER-04 | `/tarefas` | todos | Tarefas de todas as diretorias; diretor cria/edita/exclui; qualquer membro cria tarefas pessoais; responsável muda o andamento; selo de tarefa automática; filtros | EM PRODUÇÃO |
| F-GER-05 | sino + `/api/push` | todos | Notificações no app e push no aparelho | EM PRODUÇÃO (push só em produção) |
| F-PRE-01 | `/auditoria` | diretores | Últimas 200 ações sensíveis com filtro por tipo | EM PRODUÇÃO |
| F-VP-01 | `/membros` | todos (gestão: diretores) | Pré-cadastro e convite, cargos, rodízio, ativação, data de entrada, transferência de carteira, processos seletivos | EM PRODUÇÃO |
| F-VP-02 | `/vice-presidencia/pontuacao` | todos (lançar: diretoria `rh`) | Medidor 0–12 com marco em 6; ranking (diretores); lançar/abonar/cancelar; histórico | EM PRODUÇÃO |
| F-COM-01 | `/comercial` | todos (visão por membro: diretor) | Painel comercial com indicadores do período calculados no banco (Seção 10), incluindo coldcall, ticket por solução, % no SLA e destinos, motivos por fase; SLA estourado; só para o diretor: desempenho por responsável da época, motivos por membro e atividades da equipe | EM PRODUÇÃO |
| F-COM-02 | `/comercial/exportar` | todos | Exporta indicadores (várias abas) ou lista de negócios em .xlsx/.csv, com os filtros da tela | EM PRODUÇÃO |
| F-COM-03 | `/funil` | todos | Kanban com arrastar e soltar; filtros retráteis (busca, responsável, origem, segmento); destaque de SLA; diálogo de motivo nas perdas (comentário obrigatório no "Outro"); selo da última ligação e registro rápido de ligação no card | EM PRODUÇÃO |
| F-COM-04 | `/funil/configuracoes` | diretor comercial | Fases (nome, SLA, ação, destino, probabilidade, rodízio, ativa, **excluir**), campos por fase, **cadência** (toques e prazos), **resultados de ligação** (ação no card e tarefa), motivos, origens, segmentos, serviços, **feriados** | EM PRODUÇÃO |
| F-COM-05 | `/empresas`, `/empresas/novo`, `/empresas/[id]` | todos | Busca por nome/CNPJ/telefone; novo lead com aviso de duplicidade; contatos | EM PRODUÇÃO |
| F-COM-06 | `/negocios/[id]` | todos (edição conforme RLS) | Dados do negócio, campos de cada fase, serviços com valor por serviço, participantes, histórico, atividades do negócio, anexos, **registro e histórico de ligações**; selos de telefone inválido e não contatar nos contatos | EM PRODUÇÃO |
| F-COM-07 | `/metas`, `/metas/configuracoes` | todos (configurar: diretor) | OKRs por trimestre; metas automáticas ou manuais; criar trimestre copiando outro | EM PRODUÇÃO |
| F-AUT-01 | `/entrar`, `/primeiro-acesso`, `/esqueci-senha`, `/definir-senha`, `/auth/confirmar` | público | Login e links por e-mail | EM PRODUÇÃO (ver limitação de SMTP, Seção 16) |

`/configuracoes` existe só para redirecionar endereços antigos para `/funil/configuracoes`.

---

# 10. Indicadores e metas automáticas

Implementação: no banco, `public.indicadores_comerciais(de, ate, responsavel?)` (JSON com todos os indicadores) e `public.valor_indicador_meta(chave, de, ate, membro?)`, apoiadas em `privado.negocios_comerciais()` e `privado.historico_comercial()`; `src/lib/indicadores.ts` só chama essas funções (RPC). `src/lib/indicadores-catalogo.ts` e `src/lib/periodo.ts` continuam no app.

## 10.1 Como os dados são lidos

Desde a v2 (Fase 0, PR 6) o cálculo é feito **no Postgres**, numa única chamada por página, em vez de carregar todos
os negócios e o histórico na Vercel. Os números são os mesmos do cálculo anterior: a comparação automática
(`supabase/testes/comparar_indicadores.sh`, com o cálculo antigo preservado em `supabase/testes/indicadores_v1.ts`)
deu resultado idêntico em 5 períodos, com e sem filtro por responsável, inclusive nas metas automáticas.

## 10.2 Definições

- **Período:** dias de Brasília, inclusive (`?periodo=mes|trimestre|30d|ano|personalizado&de=&ate=`; padrão =
  trimestre atual). Filtro opcional por responsável (`?resp=`).
- **Chegou à fase X no período:** existe registro em `negocio_historico` com destino X dentro do período. Cada negócio
  conta uma vez por fase.
- **Leads novos:** negócios com `created_at` no período.
- **Contratos e faturamento:** negócios com `ganho_em` no período; faturamento = soma de `valor`.
- **Ticket médio:** faturamento ÷ contratos. **Taxa de ganho:** ganhos ÷ (ganhos + "Projeto não vendido").
- **Ciclo de venda:** média de (`ganho_em` − `created_at`) dos ganhos.
- **Conversão da safra** (`funil`, desde 20/10/2026): os leads criados no período e até onde cada um chegou **até
  hoje**: Leads → Em cadência (E-mail, Coldcall 1 ou 2) → Oportunidade → Diagnóstico (ou Elaboração de escopo) →
  Proposta → Contrato. Vale a etapa mais avançada que o negócio já teve no histórico (ou `ganho_em`), então pular uma
  fase conta como ter passado por ela; Retornar futuro, Reciclagem e as perdas não sobem de etapa. % = etapa ÷ etapa
  anterior, dentro da mesma safra (nunca passa de 100%); `doTotal` = etapa ÷ leads da safra; `safraEmAberto` = leads
  da safra ainda não encerrados (safras recentes ainda estão amadurecendo). A conversão lead → contrato do resumo usa a
  safra.
- **Movimento no período** (`movimento`): entradas em cada fase do funil dentro do período, de qualquer safra, cada
  negócio uma vez por fase; sem porcentagem. Os cartões do resumo (diagnósticos, propostas…) seguem esta regra.
- **Tempo médio por fase:** intervalo entre a entrada na fase e a próxima movimentação do mesmo negócio, para saídas
  dentro do período.
- **Por responsável:** usa o **responsável da época** (`negocio_historico.responsavel_id`, gravado a cada movimentação):
  leads pelo primeiro responsável que o negócio teve; entradas em fases pelo responsável na entrada; contratos e perdas
  pelo responsável na entrada da fase de desfecho; atividades e ligações por quem as fez. Transferir a carteira não muda
  o passado. Antes da v2 o histórico não tinha o responsável: esses registros receberam o responsável atual.
- **Novos (v2):** propostas remarcadas (atividades de Apresentação de proposta com status `remarcada`); ticket por
  solução (soma de `negocio_servicos.valor` nos contratos ÷ contratos com valor); pipeline ponderado (valor ×
  probabilidade da fase atual, negócios abertos); % de saídas dentro do SLA e destinos de saída por fase; motivos por
  fase de saída e por membro; coldcall (ligações, % por resultado, % que vira diagnóstico, duração média; nota da
  rubrica na Fase 2).
- **Visão por membro** (tabela por responsável e motivos por membro): só o diretor, no painel e na exportação.

## 10.3 Metas automáticas

`metas.indicador` aponta para uma chave do catálogo. Com indicador, **realizado = cálculo automático +
`realizado_manual`** (o manual vira ajuste, para registrar o que aconteceu antes do portal). Sem indicador, a meta é
manual.

| Chave | Regra |
|---|---|
| `faturamento` | Soma do valor dos ganhos no trimestre |
| `contratos` | Negócios ganhos no trimestre |
| `propostas` | Entradas em Apresentação de proposta |
| `diagnosticos` | Entradas em Diagnóstico agendado |
| `diagnosticos_fora_londrina` | Diagnósticos de empresas com cidade ≠ Londrina |
| `diagnosticos_pos_venda` | Diagnósticos com origem "Pós-vendas" |
| `diagnosticos_membros_novos` | Diagnósticos cujo responsável entrou a partir do último processo seletivo |
| `oportunidades` | Entradas em Oportunidade |
| `leads_novos` | Negócios criados |
| `prospectday` | Atividades ProspectDay não canceladas |
| `coldcalls` | Atividades Coldcall realizadas |

---

# 11. Notificações, push e PWA

1. Algo gera uma linha em `notificacoes` (gatilho de negócio, job diário ou lançamento de pontuação) via
   `privado.notificar()`, que ignora duplicatas pela `chave`.
2. O gatilho `enviar_push` lê `push_url` e `push_segredo` de `privado.config` e faz `net.http_post` para
   `https://aprimora.vercel.app/api/push` com o cabeçalho `x-push-segredo` e as assinaturas do membro.
3. `src/app/api/push/route.ts` confere o segredo (comparação em tempo constante com `PUSH_SEGREDO`) e envia com
   `web-push` (VAPID).
4. `public/sw.js` mostra a notificação e abre o link ao tocar.
5. O sino (`src/components/app/sino.tsx`) consulta a tabela a cada 60 s e ao focar a janela; o usuário ativa o push no
   próprio sino ("Receber notificações neste aparelho"). No iPhone é preciso instalar o PWA na tela de início.

Manifesto: `src/app/manifest.ts` (`start_url` `/painel`, ícones 192 e 512). As pré-visualizações da Vercel exigem login
da Vercel, então o push só funciona em produção.

---

# 12. Integrações

| Integração | Situação | Detalhes |
|---|---|---|
| Supabase (Auth, Postgres, Storage, cron, net) | EM PRODUÇÃO | Projeto `boxweeufsyaknialzedc` |
| Vercel | EM PRODUÇÃO | Projeto `aprimora` (equipe Aprimora), ligado ao GitHub `Maroto-Aprimora/PortalAprimora` desde 13/10/2026 (antes, `AgenciaValkz/Aprimora`; a transferência do repositório desligou os deploys automáticos). Implanta a `main` em produção e cada branch como pré-visualização |
| Web Push | EM PRODUÇÃO | Chaves VAPID nas variáveis da Vercel |
| E-mail transacional (convite, senha) | PARCIAL | Usa o envio padrão do Supabase (limitado). SMTP próprio pendente (Seção 16) |
| n8n da Aprimora | INSTALADO (fluxos ainda não importados) | VPS Hostinger KVM 2 própria, https://srv2043014.hstgr.cloud; `n8n/docker-compose.yml` com Caddy (HTTPS automático) e n8n (1 vCPU / 1,5 GB, limpeza automática de execuções, áudios em disco, 2 execuções simultâneas); 5 fluxos em `n8n/fluxos/` |
| API4COM (ligações) | PARCIAL (recebimento ativo, por webhook e por consulta do n8n a cada 5 min; processamento na Fase 2.3) | Webhook "após desligamento da chamada" v1.4 → `POST /api/integracoes/api4com?token=…` → `eventos_integracoes` (payload bruto; token conferido pelo hash `privado.config.api4com_token_hash`). Previsto: evento → ligação → fila → n8n → Google Drive + Gemini → card |
| Gmail (cadência e respostas) | NÃO IMPLEMENTADO no portal | Previsto: e-mails aprovados no portal enviados pelo n8n; respostas classificadas pelo Gemini |
| Gemini | EM USO pelo n8n (A1 e A4) | Chave `GEMINI_API_KEY` só na VPS; modelo `gemini-3.8-flash`, fixo nos fluxos 06 e 07 (o `gemini-2.5-flash` deixou de aceitar contas novas; a variável `GEMINI_MODELO` da VPS ficou obsoleta). Plano gratuito: a busca do Google pelo Gemini não tem cota grátis, então o A1 não usa busca (só classifica e escreve a partir do que foi coletado); A1 e A4 respondem em JSON pelo `responseSchema` |
| Apollo.io | EM USO pelo n8n (A1), opcional | `APOLLO_API_KEY` na VPS. Busca de decisores pelo domínio (`mixed_people/api_search`, sem crédito) e revelação do 1º decisor (`people/match`, gasta crédito); sem chave ou sem crédito, o fluxo segue sem o Apollo |
| Site da empresa | EM USO pelo n8n (A1) | Página inicial lida pelo n8n: texto para o Gemini, e-mails, telefones e CNPJ do rodapé |
| BrasilAPI (CNPJ) | EM USO pelo n8n (A1) | `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`, pública e sem chave; cadastro oficial tem prioridade sobre a busca; o quadro societário dá o decisor quando a busca não acha |
| Google Drive | NÃO IMPLEMENTADO | Usado pelo fluxo de ligações (Fase 2.3) |

**Contrato entre n8n e portal** (em `n8n/README.md`): rotas genéricas `/api/n8n/*` para reservar trabalhos de um
agente, devolver resultado ou falha, saúde da fila, alerta e erro. O resultado é aplicado no banco conforme o agente
(`privado.aplicar_resultado_agente`). Autenticação por cabeçalho `x-n8n-segredo`. O portal funciona como fila: o n8n busca
trabalho, então trocar o n8n de servidor não exige mudar o portal.

---

# 13. Segurança

- **RLS em todas as tabelas** de `public`; `anon` sem permissões de escrita.
- **Schema `privado`** fora da API REST; funções de permissão e `privado.config` só executáveis/legíveis internamente.
- **Funções `security definer`** sempre com `set search_path = ''` e verificação explícita de cargo quando expostas
  (`transferir_carteira`, `excluir_fase`). O Security Advisor do Supabase aponta essas duas como "executáveis por
  usuários autenticados": é intencional e documentado.
- **Segredos:** nenhum segredo no repositório (`.env*` no `.gitignore`, exceto `.env.example`). Segredos na Vercel
  (`VAPID_PRIVATE_KEY`, `PUSH_SEGREDO` como *sensitive*) e em `privado.config` (`push_segredo`).
- **Storage:** bucket `anexos` privado; download por link assinado de 60 s; políticas por pasta
  `negocios/<negocio_id>/`.
- **Rotas do n8n:** `/api/n8n/*` não usam sessão; exigem `x-n8n-segredo` (= `N8N_SEGREDO`, comparação em tempo
  constante) e chamam funções `n8n_*` (security definer) que conferem o mesmo segredo pelo hash SHA-256 em
  `privado.config.n8n_segredo_hash`. O Security Advisor lista essas funções como "executáveis por anon": é
  intencional, pois sem o segredo elas recusam tudo. Para trocar o segredo: novo valor na Vercel (`N8N_SEGREDO`) e no
  projeto da VPS (`PORTAL_N8N_SEGREDO`), e o novo hash em `privado.config`.
- **Pendências de segurança:** proteção contra senhas vazadas desativada (exige plano pago do Supabase); SMTP próprio
  não configurado.
- **Dados de clientes:** planilhas reais do Pipefy não são versionadas (pasta `dados-reais/` no `.gitignore`).

---

# 14. Configuração, implantação e operação

## 14.1 Variáveis de ambiente (Vercel)

| Variável | Tipo | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | Chave publicável (a segurança vem do RLS) |
| `NEXT_PUBLIC_SITE_URL` | pública (produção) | Base dos links de e-mail |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | pública | Inscrição no push |
| `VAPID_PRIVATE_KEY` | sensível | Envio do push |
| `PUSH_SEGREDO` | sensível | Igual a `privado.config.push_segredo` |
| `N8N_SEGREDO` | sensível | Igual a `PORTAL_N8N_SEGREDO` no projeto n8n-aprimora da VPS; protege as rotas `/api/n8n/*` |

## 14.2 Fluxo de trabalho

- Uma branch por fase ou ajuste → Pull Request para `main` → revisão do Diretor Comercial → mescla. A Vercel publica a
  `main` em produção automaticamente e cada branch como pré-visualização.
- **CI** (`.github/workflows/ci.yml`) em todo PR e push na `main`: `npm ci`, `npm run lint`,
  `npx next typegen && npx tsc --noEmit`, `npm run build`.
- **Banco:** toda mudança é uma nova migração em `supabase/migrations/` (nome com data) aplicada ao projeto, seguida
  da regeneração de `src/lib/supabase/database.types.ts`.
- **Rodar localmente:** `npm install`, `.env.local` a partir de `.env.example`, `npm run dev`.

## 14.3 Operação

- Jobs diários às 08h05 e 08h10 (Brasília) no `pg_cron` do Supabase.
- Configuração de URL do Supabase Auth: Site URL `https://aprimora.vercel.app`; redirecionamentos
  `https://aprimora.vercel.app/**` e `https://aprimora-*-aprimora1.vercel.app/**`.

---

# 15. Dados

- **Dados reais:** ainda não importados. Os dados fictícios de teste (50 empresas/negócios) **foram removidos**; o
  funil está vazio aguardando a migração do Pipefy.
- **Exportação do Pipefy disponível:** 805 cards com 32 colunas (empresa, CNPJ, telefone, e-mail, segmento, decisor,
  endereço, responsável, datas de cadência). Lacunas conhecidas: sem origem do lead, sem valor dos projetos vendidos,
  sem motivo de perda, 330 segmentos em texto livre, responsáveis que já saíram da EJ, 50 CNPJs repetidos. A
  importação foi deixada para a etapa final do projeto.
- **Metas de 2026** (1T a 3T) cadastradas a partir do Planejamento Estratégico, com os valores realizados como ajuste
  manual.
- **Membros pré-cadastrados:** Comercial (diretor e assessores) e os demais diretores; processo seletivo 2026/1 com
  data de 31/05/2026.

---

# 16. Limitações conhecidas e dívida técnica

| # | Limitação | Impacto | Caminho sugerido |
|---|---|---|---|
| L1 | Sem testes automatizados (unitários ou de ponta a ponta); o CI só verifica lint, tipos e build | Regressões só aparecem no uso | Testes das funções de `src/lib` (indicadores, período) e testes de RLS em SQL |
| L2 | Envio de e-mail padrão do Supabase | Convites e recuperação de senha podem não chegar a quem não é da equipe do projeto no Supabase | SMTP próprio (Google Workspace com senha de app, ou Brevo) |
| L3 | ~~Indicadores calculados em memória a cada acesso~~ | Resolvido na v2 (Fase 0, PR 6): cálculo no Postgres | Se crescer muito, agregados materializados |
| L4 | ~~Indicador "por responsável" usa o responsável atual~~ | Resolvido na v2 (Fase 0, PR 6): responsável da época | — |
| L5 | Histórico confiável só a partir do uso do portal | Períodos antigos ficam incompletos nos indicadores | Ajuste manual nas metas (já existe) ou importação de histórico |
| L6 | Push só em produção | Não dá para testar push nas pré-visualizações | Aceitável |
| L7 | Fuso fixo UTC−3 | Erra se o Brasil voltar a ter horário de verão | Usar `Intl` com `America/Sao_Paulo` em todo cálculo |
| L8 | Integrações (n8n, API4COM, Gmail, Drive, Gemini) sem as rotas `/api/n8n/*` no portal | Ligações e cadência de e-mail ainda manuais | Implementar o contrato da Seção 12 |
| L9 | Áreas de Projetos e Marketing sem telas | Fora do escopo da v2 (PE-PA-002) | — |
| L10 | Slug da Vice-Presidência continua `rh` | Só cosmético no código | Manter (trocar exige migrar referências) |
| L11 | Proteção contra senhas vazadas desativada | Senhas fracas conhecidas são aceitas | Plano pago do Supabase |
| L12 | Regras da pontuação incompletas (zerar por semestre, ações ao atingir 6 e 12) | Total acumula indefinidamente | Definir com a Vice-Presidência |
| L13 | Conector usado na manutenção não executa `delete` direto no banco | Exclusões em massa precisam do SQL Editor do Supabase | Operacional |

---

# 17. Glossário

| Termo | Significado |
|---|---|
| EJ | Empresa Júnior (Aprimora Jr.) |
| Lead / negócio / card | Oportunidade comercial no funil (`negocios`), ligada a uma empresa |
| Fase / macroetapa | Coluna do kanban / agrupamento de fases (prospecção, cadência, oportunidade, venda…) |
| SLA | Prazo máximo, em dias, que um negócio pode ficar numa fase |
| Rodízio | Distribuição automática do responsável entre os membros com `participa_rodizio` |
| Reciclagem | Fase de pausa com data de retorno |
| R.I / R.G | Reunião Interna (Comercial) / Reunião Geral (todas as diretorias) |
| ProspectDay, Evento MEJ | Tipos de atividade da agenda |
| Trimestre `nTAAAA` | Formato das metas, ex.: `3T2026` |
| Pontuação | Pontos de punição por atividades não realizadas (0 a 12, marco em 6) |
| RLS | *Row Level Security*: regras de acesso por linha no Postgres |
| PWA | Aplicativo web instalável |

---

# 18. Matriz de rastreabilidade

Use esta tabela para cruzar com o Planejamento Estratégico de Escopo. A coluna "Fase do escopo" segue o Documento de
Escopo v1.0 (Seção 14).

| Código | Funcionalidade | Fase do escopo | Status | Onde está |
|---|---|---|---|---|
| F-AUT-01 | Cadastro fechado por pré-cadastro, login, convite, senha | 0 | EM PRODUÇÃO | `src/app/(auth)`, `ao_criar_usuario` |
| F-VP-01 | Diretorias, cargos, membros, rodízio, data de entrada, processos seletivos | 0/2 | EM PRODUÇÃO | `/membros` |
| F-PRE-01 | Auditoria | 2 | EM PRODUÇÃO | `/auditoria`, `auditoria` |
| F-COM-03 | Funil kanban com fases do Pipefy, SLA, rodízio, campos obrigatórios, motivos | 1 | EM PRODUÇÃO | `/funil`, gatilhos de `negocios` |
| F-COM-04 | Configurações do funil, incluindo excluir fase | 1 | EM PRODUÇÃO | `/funil/configuracoes` |
| F-COM-05 | Empresas, contatos, detecção de duplicidade | 1 | EM PRODUÇÃO | `/empresas` |
| F-COM-06 | Negócio com campos por fase, histórico e anexos | 1/3 | EM PRODUÇÃO | `/negocios/[id]` |
| F-COM-08 | Importação CSV e migração do Pipefy | 1 | NÃO IMPLEMENTADO | — |
| F-GER-02/03 | Agenda, atividades, R.I/R.G configuráveis | 2 | EM PRODUÇÃO | `/agenda` |
| F-GER-04 | Tarefas | 2 | EM PRODUÇÃO | `/tarefas` |
| F-GER-05 | Notificações no app e push | 2 | EM PRODUÇÃO | sino, `/api/push` |
| F-VP-03 | Transferência de carteira | 2 | EM PRODUÇÃO | `transferir_carteira` |
| F-GER-01 | Início (Minhas tarefas) | v2 F0 | EM PRODUÇÃO | `/painel` |
| F-GER-06 | Painel geral da v1 (comparação) | 2b | EM PRODUÇÃO | `/vice-presidencia/painel-geral` |
| F-VP-02 | Pontuação | 2b | EM PRODUÇÃO (regras L12 pendentes) | `/vice-presidencia/pontuacao` |
| F-COM-01 | Indicadores do funil e atividades da equipe | 3 | EM PRODUÇÃO | `/comercial` |
| F-COM-02 | Exportação xlsx/csv | 3 | EM PRODUÇÃO | `/comercial/exportar` |
| F-COM-07 | Metas automáticas e configuráveis | 3 | EM PRODUÇÃO | `/metas` |
| F-V2-01 | Resultado de ligação (lista fechada, ação no card, tarefa automática) | v2 F0 | EM PRODUÇÃO | `ligacoes`, `resultados_ligacao`, `components/crm/registrar-ligacao.tsx` |
| F-V2-02 | Motivos e origens da v2; comentário obrigatório no "Outro"; "não contatar" | v2 F0 | EM PRODUÇÃO | `motivos`, `origens` |
| F-V2-03 | Proposta remarcada e valor por serviço | v2 F0 | EM PRODUÇÃO | `remarcar_atividade`, `negocio_servicos.valor` |
| F-V2-04 | Tarefas automáticas (resultados de ligação, cadência, Oportunidade, Reciclagem, compromissos), dias úteis, feriados e notificação de toda tarefa | v2 F0 | EM PRODUÇÃO | `privado.criar_tarefa`, `privado.gerar_tarefas_diarias`, `cadencia_passos` |
| F-V2-05 | Indicadores no banco, pelo responsável da época, e indicadores novos da Seção 7 | v2 F0 | EM PRODUÇÃO | `indicadores_comerciais`, `valor_indicador_meta` |
| F-INT-01 | n8n: instância e fluxos | v2 F1 | EM PRODUÇÃO (fila e fluxo de teste; agentes nas Fases 2+) | `n8n/`, VPS Hostinger |
| F-V2-06 | Fila de trabalhos e rotas `/api/n8n/*` | v2 F1 | EM PRODUÇÃO | `trabalhos`, `n8n_*`, `src/app/api/n8n` |
| F-V2-07 | Caixa de aprovação, unificada com Tarefas em 13/10/2026 (`/aprovacoes` redireciona) | v2 F1 | EM PRODUÇÃO | `/tarefas`, `aprovacoes` |
| F-V2-08 | Liga/desliga de agentes e saúde da fila | v2 F1 | EM PRODUÇÃO | Config. do funil → Agentes e fila |
| F-V2-09 | A1 Enriquecedor (fila ao entrar em Enriquecimento, botão "Enriquecer agora", dados públicos, aprovação do decisor, tarefa "Completar dados") | v2 F2 | EM PRODUÇÃO no portal (fluxo 06 a publicar) | `enriquecer_negocio`, `aplicar_enriquecimento`, `n8n/fluxos/06-agente-enriquecedor.json` |
| F-V2-10 | A4 Analista gerencial (relatório da R.I com um clique, plano por membro, revisão do diretor) | v2 F2 | EM PRODUÇÃO no portal (fluxo 07 a publicar) | `/comercial/relatorios`, `gerar_relatorio_ri`, `n8n/fluxos/07-agente-analista-gerencial.json` |
| F-V2-11 | A2 Agente de ligação e A3 Avaliador: chamada da API4COM → ligação no negócio → transcrição, resumo, resultado sugerido, dores e próximo passo → o membro confirma na Caixa de aprovação (o resultado aplicado move o card e cria tarefas); nota por critério da rubrica | v2 F2 | EM PRODUÇÃO | `processar_eventos_api4com`, `aplicar_ligacao`, `n8n/fluxos/08` e `09` |
| F-V2-12 | Desempenho individual (membro vê o seu, diretor vê todos; nota média da rubrica no coldcall; plano de melhoria liberado quando o diretor revisa a R.I) e rubrica editável | v2 F2 | EM PRODUÇÃO | `/desempenho`, `plano_melhoria`, Config. do funil → Rubrica |
| F-V2-13 | Funil com cabeçalho estilo Pipefy (Kanban/Lista, busca, filtros) e card retrátil; Tarefas em quadro de colunas retráteis com card completo | v2 F2 | EM PRODUÇÃO | `/funil`, `/tarefas`, `components/app/barra-visoes.tsx` |
| F-INT-02 | Ligações API4COM com transcrição e avaliação por IA | 4/5 | NÃO IMPLEMENTADO no portal | contrato em `n8n/README.md` |
| F-V2-15 | Da oportunidade à venda (Fase 4): diagnóstico no celular com mapa de maturidade, precificação com preço mínimo e máximo e projetos parecidos, A9 Assistente de proposta, A10 passagem para Projetos com dossiê em PDF | v2 F4 | EM PRODUÇÃO | `diagnosticos`, `precificacoes`, `propostas`, `/negocios/[id]/(diagnostico|precificacao|proposta|dossie)`, `n8n/fluxos/12` |
| F-V2-14 | Cadência de e-mail (Fase 3): guia Copy (variáveis, regras, A/B, ativa/desativada, desempenho por copy, envio pela comercial@), A5 Redator com aprovação em Tarefas, envio pelo Gmail no mesmo fio, A6 Monitor de respostas (classifica e move o card), e-mails e respostas no negócio, cartão no Painel comercial, A7 resumo do dia | v2 F3 | EM PRODUÇÃO no portal; fluxos 10/11 a publicar após a credencial Gmail | `copies_email`, `emails`, `respostas_email`, `/funil/configuracoes?ver=copy`, `/api/n8n/emails/respostas`, `n8n/fluxos/10` e `11` |
| F-INT-04 | Resumo semanal e passagem do ganho para Projetos/Presidência | 4 | NÃO IMPLEMENTADO | — |
| F-INT-05 | Extração de leads e base de conhecimento com IA | 6 | NÃO IMPLEMENTADO | — |
| F-EXP-01 | Módulos de Projetos (incl. Histórico de Projetos), Presidência, Marketing | 8+ | NÃO IMPLEMENTADO | — |

---

# 19. Histórico do documento

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 09/10/2026 | Primeira versão, descrevendo a `main` no commit `af20f1c` |
| 1.1 | 12/10/2026 | Repositório transferido para `Maroto-Aprimora/PortalAprimora`; início da v2 (PE-PA-002) |
| 1.2 | 12/10/2026 | v2 Fase 0, PR 1: portal exclusivo do Comercial no menu; `/painel` vira Início; Painel geral em `/vice-presidencia/painel-geral` |
| 1.24 | 22/10/2026 | Indicadores por pessoa (painel, Desempenho individual e metas individuais) contam diagnósticos, propostas e atividades para todos os participantes da atividade, uma vez por negócio (migração `20261022120000`); valor do negócio sem depender de diagnóstico, escopo ou calculadora |
| 1.23 | 22/10/2026 | Importação do Pipefy e da Gestão de Conhecimento (835 negócios + contratos 2021–2026, um card por empresa para o que não foi vendido); vendas alinhadas à lista de contratos; Funil mostra todos os vendidos (qualquer data) na coluna Projetos Aprimora; Agenda e Tarefas carregam todos os negócios abertos no seletor (antes paravam em 500) e a edição de uma atividade mantém o negócio encerrado ligado a ela |
| 1.22 | 21/10/2026 | Controle do App (`/controle`, só o diretor comercial: ocorrências de fluxos do n8n, agentes, e-mails, Gemini no limite, fila e erros de tela, com aviso no sino); Agenda sem descrição, botões no cabeçalho e link pessoal para o Google Agenda (assinatura iCalendar em `/api/agenda/<código>.ics`, código guardado só como hash); diagnóstico agendado com 120 min; KPI "Ciclo de venda" removido do painel e do Excel; correções: avisos para várias pessoas, Retornar futuro (data sincronizada com o campo "Retornar em", pedida ao mover e tarefa "Retomar contato" na data), ligação salva mesmo quando o card não pode ser movido (tarefa "Mover para…"), funil, exportações e StockFacil sem o corte de 1.000 linhas (busca em páginas; kanban com "Mostrar mais"), meta coldcalls contando ligações; agentes Teste, A11 e A12 desligados (migração `20261021120000`). Limpeza semanal preparada em `20261021130000`, ainda não aplicada |
| 1.21 | 20/10/2026 | Painel comercial com duas visões do funil: Conversão da safra e Movimento no período (migração `20261020150000`, também no Excel exportado e nos dados da R.I); "Retornar futuro" vindo da resposta de e-mail passa por aprovação e gera tarefa para quem aprova (migração `20261020120000`) |
| 1.20 | 15/10/2026 | Fase 4: diagnóstico digital (checklist de 10 áreas e mapa de maturidade), precificação (preço mínimo e máximo no banco, preço final só do diretor), A9 Assistente de proposta (fluxo 12), A10 Passagem para Projetos e dossiê em PDF (migração `20261015120000`) |
| 1.19 | 14/10/2026 | Edição compartilhada (migração `20261014150000`): todo membro do Comercial edita qualquer card e empresa, troca o responsável, registra atividades e envia/exclui anexos; "Participantes" sai do card; "Dores identificadas" vira o checklist da Carta de Serviços (sem valor por item; anotações dos agentes em "Detalhes das dores"); página da empresa com "Atividade" (linha do tempo do lead), atividades e anexos; Desempenho individual aberto a todo o time; aprovação de e-mail no pop-up do card do Funil (contador no menu Funil); cards sem iniciais |
| 1.18 | 14/10/2026 | Fase 3: cadência de e-mail (migração `20261014120000`, guia Copy, Redator, Monitor de respostas, Organizador do dia, fluxos 10 e 11) |
| 1.17 | 13/10/2026 | Empresas e leads só em lista, com filtros de segmento, cidade e responsável; Config. do funil em abas (Campos, Agentes, Cadência); card do funil em janela; janelas mais claras sobre fundo escurecido |
| 1.16 | 13/10/2026 | Desempenho individual; Caixa de aprovação dentro de Tarefas (quadro retrátil); Funil com cabeçalho estilo Pipefy, visão em lista e card retrátil; rubrica editável; Agendador (A8) desligado |
| 1.15 | 13/10/2026 | A2 Agente de ligação e A3 Avaliador (migração `20261013160000`, fluxo 09, Caixa de aprovação com lista de resultados) |
| 1.14 | 13/10/2026 | Chamadas da API4COM também por consulta do n8n (fluxo 08, `n8n_registrar_chamadas`); o webhook não dispara para ligações do aplicativo |
| 1.13 | 13/10/2026 | Enriquecedor v2: site + Apollo + BrasilAPI + Gemini gratuito sem busca; fluxos criados direto no n8n pelo conector |
| 1.12 | 13/10/2026 | Fase 2: A1 Enriquecedor e A4 Analista gerencial (migração `20261013140000`, telas e fluxos 06/07) |
| 1.11 | 13/10/2026 | Recebimento do webhook da API4COM (`/api/integracoes/api4com`) |
| 1.10 | 13/10/2026 | Portão da Fase 1 aprovado: fluxo de teste do n8n foi e voltou pela fila sem erro |
| 1.9 | 13/10/2026 | Vercel religada ao repositório `Maroto-Aprimora/PortalAprimora` |
| 1.8 | 12/10/2026 | v2 Fase 1: fila de trabalhos, rotas `/api/n8n/*`, Caixa de aprovação, liga/desliga dos agentes e fluxo de teste |
| 1.7 | 12/10/2026 | v2 Fase 1: n8n instalado na VPS da Hostinger (https://srv2043014.hstgr.cloud) com Caddy |
| 1.6 | 12/10/2026 | Portão da Fase 0 aprovado; listas antigas de motivos e origens apagadas |
| 1.5 | 12/10/2026 | v2 Fase 0, PR 6: indicadores no banco, responsável da época no histórico, indicadores novos e visão por membro só do diretor |
| 1.4 | 12/10/2026 | v2 Fase 0, PR 5: tarefas automáticas (cadência, D21 → Reciclagem, Oportunidade, retorno da Reciclagem, compromissos), job das 07h30, tarefas pessoais e Início com a fila do dia |
| 1.3 | 12/10/2026 | v2 Fase 0, PRs 2 a 4: ligações e resultados, motivos e origens novos, remarcação, valor por serviço, base de tarefas automáticas e feriados |

**Manutenção:** ao mesclar mudanças relevantes, atualize as seções afetadas, a matriz (Seção 18) e este histórico.
A fonte deste documento é `docs/tecnico/Documentacao-Tecnica-Portal-Aprimora.md`.
