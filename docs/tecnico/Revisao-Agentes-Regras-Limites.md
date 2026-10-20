# Revisão geral · agentes, regras do funil e limites (20/10/2026)

Retrato do sistema antes da importação do Pipefy. Complementa a DT-PA-001; problemas encontrados estão marcados com **⚠**.

## 1. Agentes do n8n (nó a nó)

Todos os agentes seguem o mesmo padrão de fila: **gatilho por horário → `POST /api/n8n/trabalhos/reservar` (pega até N
trabalhos do agente, só se o agente estiver ligado no portal) → separa um por um → processa → `POST .../resultado`**
(o banco aplica o efeito) **ou `POST .../falha`** (o banco tenta de novo em 5, 10 e 15 min; na 3ª falha marca erro, faz o
plano B e avisa os diretores). Toda chamada ao portal leva o cabeçalho `x-n8n-segredo`. O Gemini usado é o
`gemini-3.8-flash` gratuito, sempre com `responseSchema` (resposta em JSON com formato fixo).

| Fluxo (n8n) | Estado | Agente no portal |
|---|---|---|
| Sistema · Teste da fila | publicado | teste (ligado) |
| Sistema · Monitor da fila | publicado | — |
| Sistema · Tratamento de erros | publicado (error workflow) | — |
| A1 Enriquecedor | publicado | ligado |
| A2 Agente de ligação (+A3 Avaliador) | publicado | ligados |
| Ligações · Buscar chamadas da API4COM | publicado | — |
| A4 Analista gerencial | publicado | ligado |
| A5 Redator | publicado em 20/10 | ligado |
| A6 Monitor de respostas | publicado em 20/10 | ligado |
| A9 Assistente de proposta | publicado | ligado |
| Temporário · Leads StockFacil | publicado | ligado |
| Ligações · Processar fila (antigo 01) | desligado | substituído pelo A2 |

A7 Organizador do dia e A10 Passagem para Projetos rodam **dentro do banco** (sem n8n). A8 Agendador está desligado.
A11 Analista de ICP e A12 Prospector aparecem ligados, mas ainda não têm fluxo (nada é enfileirado para eles).

### Sistema · Teste da fila (a cada 2 min)
1. **Reservar trabalhos de teste** (até 5) → 2. **Separar** → 3. **Devolver resultado** (eco da mensagem).
Serviu para o portão da Fase 1; pode ser desligado.

### Sistema · Monitor da fila (de hora em hora, 7h–21h)
1. **Consultar saúde da fila** (`GET /api/n8n/saude`) → 2. **Fila acumulada ou com erros?** (mais de 30 pendentes, o
mais antigo com mais de 3 h, ou mais de 5 erros em 24 h) → 3. **Avisar diretores** (`/api/n8n/alerta`, vira notificação).

### Sistema · Tratamento de erros (quando qualquer fluxo quebra)
1. **Quando um fluxo falhar** → 2. **Avisar o portal** (`/api/n8n/erro`: fluxo, nó, mensagem e link da execução;
vira registro na Auditoria e notificação aos diretores).

### A1 Enriquecedor (a cada 2 min, 2 por vez) — disparado quando o card entra em Enriquecimento
1. **Reservar** → 2. **Separar**.
3. **Preparar coleta**: descobre o site (campo site ou domínio do e-mail; ignora gmail/hotmail…).
4. **Ler o site** (15 s; se falhar segue em frente).
5. **Extrair do site**: texto (6.000 caracteres), até 5 e-mails, 3 telefones, CNPJ.
6. **Apollo: buscar decisores** (dono, sócio, diretor…; não gasta crédito) → 7. **Apollo: revelar decisor** (gasta
   crédito; sem crédito segue sem ele).
8. **Consultar CNPJ (BrasilAPI)**: razão social, porte, CNAE, situação, sócios.
9. **Montar pedido ao Gemini** → 10. **Gemini: segmento e dores** (se o Gemini falhar, segue sem IA).
11. **Montar resultado**: dados públicos (prioridade CNPJ > site > Apollo), decisor (Apollo ou sócio administrador),
    até 3 e-mails, até 3 hipóteses de dor, resumo e fontes.
12. **Devolver resultado** ou **Registrar falha**.

No portal: preenche só os campos vazios da empresa, cria a aprovação **"Decisor da empresa"** (ao aprovar, cria o contato
e soma as dores ao card) e a tarefa **"Completar dados do lead"** com o que faltou.

### A2 Agente de ligação + A3 Avaliador (a cada 2 min, 1 por vez)
Origem: o fluxo **Buscar chamadas da API4COM** (a cada 5 min lê as últimas 50 chamadas dos últimos 2 dias e entrega
ao portal). O portal acha o membro pelo e-mail, o lead pelo telefone (últimos 10 dígitos) e o negócio aberto da empresa;
com gravação e 15 s ou mais de conversa, enfileira o A2.
1. **Reservar** → 2. **Separar** → 3. **Baixar gravação** (até 120 s) → 4. **Áudio em base64**.
5. **Montar pedido ao Gemini**: áudio + resultados possíveis + rubrica.
6. **Gemini: ouvir e avaliar** (até 5 min): transcrição, resumo, resultado sugerido, próximo passo, datas de retorno e de
   compromisso, decisor e melhor horário, dores, e as notas da rubrica (1 a 4 em 7 critérios).
7. **Ler resposta** (valida datas, até 6 dores) → 8. **Devolver** ou **Registrar falha**.

No portal: grava transcrição e resumo, grava a avaliação (se o Avaliador estiver ligado e houve conversa) e cria a
aprovação **"Confirmar resultado da ligação"** para quem ligou. Só ao confirmar o resultado é aplicado (ver 2.5).
Na 3ª falha: aprovação sem sugestão, para preencher à mão.

### A4 Analista gerencial (a cada 1 min, 1 por vez) — disparado ao gerar o relatório da R.I
1. **Reservar** → 2. **Separar** → 3. **Montar pedido** (números da semana, do trimestre e de cada membro) →
4. **Escrever com o Gemini** (resumo, destaques, pontos de atenção e plano de melhoria por membro) → 5. **Ler análise** →
6. **Devolver** (relatório fica "pronto" para o diretor revisar) ou **Registrar falha** (relatório com erro).

### A5 Redator (a cada 2 min, 5 por vez)
1. **Reservar** → 2. **Separar** → 3. **Redigir ou enviar?**
- **Redigir** (toque de e-mail da cadência ou "Pediu e-mail" na ligação): **Montar pedido ao Gemini** (copy escolhida
  + contato, empresa, serviços, dores, últimas ligações, quem assina, saudação pelo horário) → **Gemini: preencher a copy**
  → **Ler redação** (recusa se sobrar `{{ }}`) → **Devolver**. No portal vira **"Aprovar e-mail"** no card do funil e em
  Tarefas. Na 3ª falha vira a tarefa manual "Escrever e-mail".
- **Enviar** (só depois de aprovado; o portal só libera dentro do horário de envio, em dia útil): **Continua um fio?** →
  (sim) **Gmail: e-mail anterior** (pega o Message-ID) → **Montar e-mail** (texto puro, remetente comercial@, mesmo fio)
  → **Gmail: enviar** → **Ler envio** (ids do Gmail) → **Devolver**. Na 3ª falha o e-mail fica "Erro" e o responsável é avisado.

### A6 Monitor de respostas (dois gatilhos)
- **Caixa (a cada 5 min)**: **Gmail: mensagens recebidas** (inbox, últimos 2 dias, máx. 50, sem as nossas) →
  **Separar mensagens** → **Gmail: ler mensagem** → **Montar lote** (remetente, assunto, texto sem a parte citada) →
  **Entregar ao portal**. O portal guarda só respostas a fios da cadência (uma vez cada), pausa a cadência, avisa o
  responsável e enfileira a classificação.
- **Classificar (a cada 2 min, 5 por vez)**: **Reservar** → **Separar** → **Montar pedido** → **Gemini: classificar**
  (interessado, retornar depois, recusa, descadastro, automática, outro + resumo + data) → **Ler classificação** →
  **Devolver**. No portal: interessado → card vai para **Oportunidade**; retornar depois → aprovação + tarefa alta
  "Aprovar retorno futuro"; recusa/descadastro → aprovação "Encerrar lead?" (descadastro marca "não contatar").

### A9 Assistente de proposta (a cada 2 min, 1 por vez) — disparado ao concluir o diagnóstico
1. **Reservar** → 2. **Separar** → 3. **Montar pedido** (carta de serviços, empresa, dores, mapa de maturidade, respostas,
resumos das ligações; proíbe prazos e preços) → 4. **Gemini: analisar diagnóstico** → 5. **Ler resposta** (até 3
serviços) → 6. **Devolver** (rascunho de escopo e proposta) ou **Registrar falha**.

### Temporário · Leads StockFacil (a cada 2 min, 1 busca por vez)
Reserva a busca → cria o job no raspador do Google Maps (gosom, na mesma VPS) com "tipo em Londrina, PR" → espera em
ciclos de 1 min (até 26) → baixa o CSV → normaliza (nome, categoria, endereço, bairro, telefone, site, nota, link) →
devolve ao portal (sem duplicar; descarta fechados) → apaga o job.

**⚠ Achados nos fluxos:** A5 e A6 não repetem chamadas que falham (os outros tentam 2–3 vezes); o ramo da caixa do A6 não
tem desvio de erro (cai no Tratamento de erros); o fluxo do StockFacil não está versionado no repositório.

## 2. Regras do funil

### 2.1 Fases e o que cada uma exige

| # | Fase | Prob. | Regra |
|---|---|---|---|
| 1 | Entrada de leads | 0 | vai sozinha para Enriquecimento |
| 2 | Enriquecimento | 0 | ao entrar, chama o A1 |
| 3 | Coleta de dados concluída | 0 | — |
| 4 | E-mail | 0 | **rodízio**: se o card não tem responsável, recebe o próximo da fila (ordem alfabética, sem diretores) e é avisado; começa a cadência (D0) |
| 5–6 | Coldcall semana 1 e 2 | 0 | — (mudança entre elas é manual) |
| 7 | Retornar futuro | 0 | para sair, exige "Retornar em" |
| 8 | Oportunidade | 10% | para sair, exige "Qual a oportunidade?"; **SLA 15 dias → volta sozinha para E-mail** |
| 9 | Diagnóstico agendado | 25% | para sair, exige "Data marcada" |
| 10 | Elaboração de escopo | 50% | — |
| 11 | Apresentação de proposta | 70% | para sair, exige "Data de apresentação"; follow-up 3 dias depois |
| 12 | Projetos Aprimora (ganho) | 100% | trainee não pode marcar; grava `ganho_em`; A10 avisa Projetos |
| 13 | Reciclagem (pausa) | — | pede "retomar contato em"; na data volta sozinha para Enriquecimento |
| 14–15 | Não vendido / Não qualificado | — | exigem motivo (o "Outro" exige detalhe) |

- Os campos obrigatórios são os da fase **de onde o card sai**, e só quando ele **avança**. Voltar, pausar ou perder
  não cobra nada.
- Ganho e perda gravam `encerrado_em`; reabrir apaga a data (e reabrir um ganho apaga `ganho_em`).
- Motivos que marcam "não contatar" (ex.: descadastro) bloqueiam e-mails para o contato.

### 2.2 Cadência (dias corridos desde a última entrada em E-mail; fim de semana e feriado vão para o próximo dia útil)
D0 e-mail 1 · D3 e-mail 2 · D7 ligação 1 · D8 e-mail 3 (só sem contato) · D14 ligação 2 · D15 e-mail 4 (só sem contato)
· **D21 sem contato efetivo → Reciclagem por 90 dias**. Resposta real de e-mail pausa a cadência. Os e-mails passam pelo
A5 (rascunho → aprovação → envio); sem e-mail do lead ou sem copy, vira tarefa manual.

### 2.3 Agenda / calendário
- A Agenda mostra **atividades** (diagnóstico, pré-escopo, apresentação de proposta, coldcall, prospecção de campo,
  ProspectDay, eventos MEJ, R.I e R.G) e as **reuniões recorrentes** (R.I segunda 15:30, R.G sexta), calculadas na hora.
- Atividade nasce de duas formas: **criada à mão** na Agenda, no card ou na empresa, ou **automaticamente** quando uma
  ligação tem o resultado **"Diagnóstico agendado"** (90 min, responsável = dono do card).
- **⚠** Mover o card à mão para "Diagnóstico agendado" **não cria** o compromisso; datas de retorno, de coldcall e
  tarefas **não aparecem** na Agenda; **não há sincronização com o Google Agenda** (era o A8, desligado).
- Lembretes: véspera → diretores são avisados de diagnósticos/propostas ainda não confirmados; no dia → tarefa alta
  "Hoje às HH:MM" para o responsável (fecha sozinha quando a atividade é realizada, cancelada ou remarcada).

### 2.4 Distribuição de tarefas
Três rotinas automáticas diárias (dias úteis): **07:30** tarefas do dia + resumo "Seu dia" (A7) · **08:05** SLAs e
volta da Reciclagem · **08:10** notificações (véspera, R.I/R.G). Cada regra tem uma chave única, então nunca duplica.

| Situação | Tarefa | Quem recebe |
|---|---|---|
| Toque da cadência (e-mail manual / ligação) | "E-mail 1…", "Ligação 1…" | responsável do card |
| Resultado de ligação | ver 2.5 | responsável do card (ou quem ligou) |
| Entrou em Oportunidade | "Follow-up para marcar o diagnóstico" (dia útil seguinte) | responsável |
| Voltou da Reciclagem | "Retomar contato" | responsável |
| Compromisso do dia | "Hoje às HH:MM: …" | responsável da atividade |
| 3 dias após a proposta | follow-up | responsável |
| Enriquecedor / falha do Redator | "Completar dados", "Escrever e-mail" | responsável; sem ele, quem pediu; sem ele, o 1º diretor |
| Resposta "retornar depois" | "Aprovar retorno futuro" (alta) | quem aprova |
| Ganho (A10) | "Receber projeto" | diretores de Projetos |

- Toda nova ligação fecha as tarefas de ligação abertas do card; sair da cadência fecha as tarefas da cadência.
- Membro comum cria tarefa só para si; o diretor cria para qualquer um. Quem não é diretor só muda o status das tarefas
  atribuídas.
- **⚠** Card **sem responsável** não gera tarefa de cadência nem de Oportunidade/Reciclagem (só ganha responsável ao
  entrar em E-mail).
- **⚠ Bug:** o aviso (sino/push) é deduplicado pela chave **para todos**: quando o mesmo aviso vai para várias pessoas
  (R.I/R.G, "sem confirmação" para diretores, erros de agente), **só a primeira recebe**.

### 2.5 Fluxo de ligação
**Entrada:** à mão (botão de ligação no card, com resultado obrigatório) ou pela API4COM (ver A2: vira aprovação
"Confirmar resultado" para quem ligou). Ao gravar o resultado, uma única vez:

| Resultado | Card | Efeito | Tarefa |
|---|---|---|---|
| Não atendeu / Caixa postal | — | conta tentativa | próxima ligação em 7 dias |
| Barrado na secretária | — | registra decisor e horário | ligar para o decisor (dia útil seguinte) |
| Decisor indisponível | — | exige data de retorno | ligar na data |
| Pediu e-mail | — | A5 redige a copy "Material pedido na ligação" | (sem A5: "Enviar e-mail com material") |
| Sem interesse | Não qualificado | motivo sem interesse | — |
| Interessado sem data | Oportunidade | — | follow-up da Oportunidade |
| Diagnóstico agendado | Diagnóstico | exige data/hora; cria o compromisso na Agenda e preenche "Data marcada" | preparar o briefing (véspera) |
| Número errado | — | marca telefone inválido | corrigir o telefone |

O card só anda **para a frente** e nunca reabre negócio encerrado.
**⚠** Se o card estiver numa fase com campo obrigatório vazio (ex.: Oportunidade sem "Qual a oportunidade?"), o
resultado que move o card **falha e a ligação não é salva**. **⚠** "Retornar futuro" grava a data numa coluna e cobra
outra ("Retornar em"), então o card aprovado para Retornar trava ao avançar. **⚠** A meta "coldcalls" conta atividades
do tipo coldcall, não as ligações registradas.

## 3. KPIs

Período padrão = trimestre atual (dias de Brasília). Filtro por pessoa usa o **responsável da época** de cada evento.

- **Ciclo de venda** = média de (data do ganho − data de criação do card), dos contratos **ganhos no período**.
  Conta desde a criação do card, mesmo que ele tenha sido criado antes do período e passado meses em Reciclagem.
  **⚠** Na importação do Pipefy, a data de criação precisa vir do Pipefy, senão o ciclo fica perto de zero.
- **Taxa de ganho** = ganhos ÷ (ganhos + "Projeto não vendido"), ambos com desfecho no período. "Lead não qualificado"
  **não** entra (não chegou a ser uma venda perdida). Se um perdido for reaberto, deixa de contar.
- **Contratos e faturamento**: ganhos no período (soma do valor; ganho sem valor conta como R$ 0 e puxa o ticket para baixo).
- **Ticket médio** = faturamento ÷ contratos.
- **Diagnósticos, propostas, oportunidades**: entradas na fase no período (um por card).
- **Conversão da safra** e **Movimento no período**: como aprovado em 20/10.
- **Pipeline ponderado** = soma de valor × probabilidade da fase de todos os cards abertos **hoje** (ignora o período;
  o filtro por pessoa usa o responsável atual).
- **Metas**: valor automático + ajuste manual; faturamento/contratos por ganhos, diagnósticos etc. por entradas.

## 4. Limitações atuais

**Base de dados (Supabase gratuito):** 500 MB de banco e 1 GB de arquivos. Hoje: 18 MB de banco, 0 de arquivos. Um card
completo ocupa poucos KB, então **dezenas de milhares de leads cabem**. Anexos têm limite de 10 MB cada. O que cresce sem
limpeza: notificações, fila de trabalhos, auditoria e eventos da API4COM (precisa de rotina de limpeza). O projeto
gratuito **pausa após 7 dias sem uso** e não tem backup diário recuperável pelo painel.

**Listas cortadas sem aviso** (o Supabase devolve no máximo 1.000 linhas por consulta):
- Funil (kanban e lista): até 1.000 cards (abertos + encerrados nos últimos 90 dias). Acima disso, cards somem.
- Exportação do painel: 1.000 negócios. Leads StockFacil: lista, contadores e exportação param em 1.000 (hoje há 662).
- Seletores de negócio na Agenda e em Tarefas: 500. Tarefas: 800. Auditoria: 200.
- Empresas é a única lista paginada (50 por página).

**Desempenho:** o painel recalcula todos os indicadores sobre o histórico inteiro a cada abertura; o relatório da R.I
faz isso uma vez por membro + 2. Com alguns milhares de cards continua rápido; com dezenas de milhares precisa de cache.

**Envios e IA:**
- E-mail de login (Supabase + SMTP comercial@): limite configurável (padrão baixo; sugestão 60/h).
- E-mails da cadência pela comercial@: ~2.000/dia (Google Workspace); o Redator envia em lotes de 5 a cada 2 min
  (~150/h no máximo).
- Monitor de respostas: lê 50 mensagens dos últimos 2 dias a cada 5 min. Caixa muito movimentada pode esconder respostas.
- Gemini gratuito: limite por minuto e por dia (a fila espera e tenta de novo); **no plano gratuito o Google pode usar os
  dados enviados** (risco LGPD para transcrições de ligação).
- Ligações: ~1 transcrição a cada 2 min por fila (≈30/h); gravações até ~20 MB.
- n8n na VPS: 2 execuções simultâneas, 1 CPU e 1,5 GB, compartilhados com o raspador do StockFacil.
- Apollo: créditos do plano para revelar decisores.

## 5. Segurança — pontos para a correção geral

1. Funções `n8n_*` chamáveis por qualquer pessoa com a chave pública; proteção só pelo segredo (hash SHA-256 sem
   limite de tentativas).
2. Token da API4COM na URL do webhook (vai para logs).
3. O resultado do n8n pode escolher o responsável de uma aprovação.
4. `/api/push` não valida o formato do corpo.
5. Segredo do push guardado em texto no banco (necessário para o `pg_net`); revisar quais funções `privado.*` estão
   liberadas para usuários logados.
6. Sem cabeçalhos de segurança no site (CSP, HSTS, bloqueio de iframe).
7. Qualquer membro ativo lê todos os anexos (sem filtro por diretoria/negócio).
8. O acesso ao app verifica só se há sessão; membro inativo depende do RLS (conferir telas que não leem dados).
9. Sem retenção/limpeza de dados (LGPD) e envio de dados de leads ao Gemini gratuito.
10. Revisar: RLS de todas as 57 tabelas (todas ligadas), 135 funções `security definer` (todas com `search_path` vazio),
    nenhum uso de `service_role` no app.
