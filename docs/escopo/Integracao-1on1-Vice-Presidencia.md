# Integração do "Aprimora · Gestão de 1:1" ao Portal Aprimora

| Campo | Valor |
|---|---|
| Código | EI-PA-003 |
| Versão | 1.0 (26/11/2026) |
| Origem | Repositório `lbusettilemes-gif/aprimora-1on1` (app próprio da Vice-Presidência, Supabase separado, `aprimora-vp.vercel.app`) |
| Destino | Portal Aprimora (Supabase `boxweeufsyaknialzedc`), menu **Vice-Presidência** |

## 1. O que o 1on1 faz

| Bloco | Módulos do 1on1 |
|---|---|
| Núcleo 1:1 | Reuniões 1:1 (agendar, registrar, cancelar, reabrir), anotações privadas, transcrição com consentimento, análise da transcrição por IA, resumo compartilhável, compromissos; Desenvolvimento (objetivos com etapas e histórico); Feedbacks; Resumo dos membros (visão 360); Relatórios (1:1 por mês e por diretoria, cobertura, Excel) |
| Rotina da VP | Pontos e justificativas (pedido → aprovação da VP com 1 a 6 pontos → aviso de PDI aos 6 → zerar por semestre); Tarefas da VP com comprovante em foto; Calendário da VP com anexos, lembretes por e-mail (2 e 1 dia antes) e feed `.ics` |
| Engajamento | Mural de elogios mensal (post-its, anônimo opcional); Moedas e lojinha (saldo, extrato, pedidos de prêmio, pedidos de moedas); Jornal da Apri (o que cada um fez no mês) |
| JAD | Cursos e capacitações (obrigatório/recomendado/opcional, por diretoria, certificado); Gestão do conhecimento; Projetos internos (participantes, atividades, atualizações, lições); Objetivos anuais com indicadores e evidências |

## 2. Decisões (Diretor Comercial, 26/11/2026)

| # | Tema | Decisão |
|---|---|---|
| D1 | Escopo | Entram os quatro blocos, em fases |
| D2 | Pontuação | Vale a regra do 1on1: qualquer pessoa **pede** um ponto descrevendo o fato; a equipe da VP aprova e define de 1 a 6; ao chegar a 6 dispara o PDI; a VP zera (ex.: novo semestre). Substitui o lançamento direto −12..12 (a tabela `pontuacoes` não tinha lançamentos) |
| D3 | PDI | A tela PDI passa a valer para **todas as diretorias**. Ao chegar a 6 pontos, o Portal avisa a VP e o diretor e abre um rascunho de ciclo de PDI |
| D4 | Dados | Migrar tudo do 1on1 a partir de um **dump SQL** do banco dele (Fase 5) |
| D5 | Administrador | O papel "Administrador" do 1on1 fica com o **diretor da Vice-Presidência** (diretoria `rh`) |
| D6 | Quem conduz | **A equipe da VP conduz todas as 1:1** (não há "responsável/mentor" por membro) |
| D7 | IA da 1:1 | **Agente na fila do n8n**: A13 Analista de 1:1. A transcrição não vai no payload da fila (que todo membro lê): o n8n a busca por rota própria protegida pelo segredo |
| D8 | Calendários | Página separada, **um calendário por diretoria**. Diretor e assessores da diretoria criam e editam; a diretoria (e quem tem visibilidade liberada) vê; a VP vê todos |
| D9 | Avisos | Sino + push + e-mail (lembretes de evento com cópia para a VP e aviso de PDI) |
| D10 | Moedas | Igual ao 1on1: qualquer diretor dá/retira moedas, cuida da lojinha e aprova pedidos; a equipe da VP pede moedas (vai para aprovação) |
| D11 | Diretores × 1:1 | O diretor de cada diretoria **só lê**: datas das 1:1, resumos compartilhados, objetivos, feedbacks e o Resumo dos membros da própria diretoria. Não cria nem edita |
| D12 | Objetivos × PDI | Ficam separados: "Desenvolvimento" (objetivos da 1:1) e "PDI" (ciclo com metas semanais); aparecem juntos no Resumo do membro |
| D13 | Objetivos anuais do JAD | **Fundidos em Metas**: a tela Metas ganha o nível anual (ano + trimestres), sem tela separada no JAD |
| D14 | Entrega | Por fases, direto na `main`, cada uma com migração, tipos, DT-PA-001 e roteiro de teste; validação antes da próxima |

## 3. Papéis no Portal

| Papel do 1on1 | No Portal | Função auxiliar |
|---|---|---|
| Administrador | Diretor da Vice-Presidência | `privado.eh_diretor_de('rh')` |
| VP (equipe da VP) | Qualquer cargo na diretoria Vice-Presidência | `privado.eh_equipe_vp()` |
| Diretor(a) | Diretor de qualquer diretoria; nos módulos da VP, só leitura sobre os membros da própria diretoria | `privado.eh_diretor_do_membro(membro)` |
| Membro | Membro ativo; vê só o que foi compartilhado com ele | `auth.uid() = membro_id` |

Regra herdada do 1on1: **no próprio cadastro valem as regras de membro**. Quem é da VP não conduz, não registra
feedback nem objetivo sobre si mesmo e não lê as próprias anotações privadas.

Conteúdo privado (anotações, pontos de preocupação, perguntas para a próxima, transcrição e análise da IA):
só quem conduziu a 1:1 e o diretor da VP.

## 4. Fases

| Fase | Conteúdo | Situação |
|---|---|---|
| 1 | Núcleo 1:1: reuniões, registro, conteúdo privado, transcrição, agente A13 (n8n), compromissos, desenvolvimento, feedbacks, resumo dos membros, relatórios | Em implementação |
| 2 | Rotina da VP: pontos e justificativas (D2), PDI para todos com gatilho (D3), tarefas com comprovante em foto, calendários por diretoria (D8) com lembretes e `.ics`, e-mail (D9) | A fazer |
| 3 | Engajamento: mural de elogios, moedas e lojinha (D10), Jornal da Apri | A fazer |
| 4 | JAD: capacitações, conhecimento, projetos internos; objetivos anuais em Metas (D13) | A fazer |
| 5 | Migração dos dados do 1on1 (dump SQL), conferência e desligamento do app antigo | A fazer (aguarda o dump) |

## 5. Pendências

- Receber o dump SQL do Supabase do 1on1 (Fase 5). Usuários do 1on1 são ligados aos membros do Portal pelo e-mail.
- Publicar no n8n o fluxo `14-agente-analista-1on1.sdk.js` e ligar o agente A13 na tela de 1:1 (diretor da VP).
