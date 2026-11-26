import { workflow, node, trigger, sticky, newCredential, switchCase, ifElse, expr } from '@n8n/workflow-sdk';

const H = { parameters: [{ name: 'x-n8n-segredo', value: '={{ $env.PORTAL_N8N_SEGREDO }}' }] };

const nota = sticky('## APRIMORA | Agente | A5 Redator\nA cada 2 minutos reserva até 5 trabalhos do Redator. Card com a etiqueta **SAAS** é cancelado no portal (fora da cadência de e-mail).\n\n**redigir_email**: o Gemini gratuito preenche as {{variáveis}} da copy com os dados do lead e devolve assunto e corpo; o portal cria o "Aprovar e-mail" em Tarefas.\n\n**enviar_email** (só depois de aprovado, na janela de horário comercial): envia pela conta da **comercial@** (credencial Gmail OAuth2), no mesmo fio dos e-mails anteriores do lead, e devolve os ids do Gmail ao portal.', { width: 900, height: 230, color: 4 });

const cron = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.2, config: { name: 'A cada 2 minutos',
  parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 2 }] } } } });

const reservar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Reservar trabalhos', parameters: {
  method: 'POST', url: '={{ $env.PORTAL_URL }}/api/n8n/trabalhos/reservar', sendHeaders: true, headerParameters: H,
  sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ agente: 'redator', limite: 5 }) }}", options: { timeout: 30000 } } } });

const separar = node({ type: 'n8n-nodes-base.splitOut', version: 1, config: { name: 'Separar trabalhos',
  parameters: { fieldToSplitOut: 'trabalhos', options: {} } } });

// Etiqueta SAAS: o card não participa da cadência de e-mail. O portal já bloqueia; aqui é a segunda conferência.
const ehSaas = ifElse({ version: 2.2, config: { name: 'Tem etiqueta SAAS?', parameters: { conditions: {
  options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr("{{ ($json.etiquetas || []).map((e) => String(e).toUpperCase()).includes('SAAS') }}"), operator: { type: 'boolean', operation: 'true', singleValue: true } }],
  combinator: 'and' } } } });

const cancelarSaas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Cancelar no portal (SAAS)', parameters: {
  method: 'POST', url: '={{ $env.PORTAL_URL }}/api/n8n/trabalhos/{{ $json.id }}/cancelar', sendHeaders: true, headerParameters: H,
  sendBody: true, specifyBody: 'json',
  jsonBody: "={{ JSON.stringify({ motivo: 'Card com a etiqueta SAAS: fora da cadência de e-mail (' + $json.tipo + ')' }) }}",
  options: { timeout: 30000 } } } });

const porTipo = switchCase({ version: 3.2, config: { name: 'Redigir ou enviar?', parameters: {
  rules: { values: [{ outputKey: 'redigir', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'redigir_email' }], combinator: 'and' } }, { outputKey: 'enviar', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.tipo }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'enviar_email' }], combinator: 'and' } }] }, options: {} } } });

const montarPedido = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Montar pedido ao Gemini', onError: 'continueErrorOutput', parameters: {
  mode: 'runOnceForEachItem', jsCode: `// Monta o pedido ao Gemini: a copy (com {{variáveis}}) + tudo o que o portal sabe do lead.
const p = $json.payload || {};
const m = p.mensagem || {};
if (!m.corpo) throw new Error('Copy sem corpo');
const hora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
const contexto = {
  hoje: p.hoje, saudacao_sugerida: hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite',
  toque: p.passo ? 'D' + p.passo.dia + ' · ' + p.passo.titulo : p.uso,
  contato: p.contato || null, empresa: p.empresa || {}, servicos_do_negocio: p.servicos || [], servicos_aprimora: p.servicos_aprimora || [],
  dores_identificadas: p.dores || '', ultimas_ligacoes: p.ligacoes || [], quem_assina: p.membro || 'Equipe Aprimora', remetente: p.remetente,
};
const prompt = [
  'Você é redator comercial da Aprimora, consultoria júnior de Engenharia de Produção da UEL (Londrina-PR).',
  'Preencha a COPY abaixo para este lead, trocando TODAS as {{variáveis}} por texto final em português do Brasil.',
  'Regras:',
  '- Mantenha a estrutura, o tom e o tamanho da copy; ajuste só concordância e fluidez onde a troca exigir.',
  '- {{saudacao}}: use a saudação sugerida. {{nome_contato}}: primeiro nome do contato; sem contato, use "tudo bem" no lugar de "{{saudacao}}, {{nome_contato}}" (ex.: "Olá, tudo bem?").',
  '- {{dor}}: a dor mais provável para esta empresa, a partir das dores identificadas, das ligações e do resumo; seja específico e curto, sem afirmar o que não sabe ("costuma", "é comum").',
  '- {{servico}}: o serviço da Aprimora que melhor resolve a dor (prefira os serviços do negócio).',
  '- {{dado_segmento}}: uma frase com um benefício típico do segmento. NUNCA invente números, clientes ou casos.',
  '- {{cta}}: convite simples para uma conversa de 20 minutos nesta ou na próxima semana.',
  '- {{membro}}: quem assina. {{empresa}}, {{segmento}}, {{cidade}}: dados da empresa (sem segmento, use uma descrição genérica do ramo).',
  '- Não use markdown, emojis nem colchetes. Não deixe nenhuma {{ }} no resultado.',
  '',
  'COPY · ASSUNTO: ' + (m.assunto || ''),
  'COPY · CORPO:\\n' + m.corpo,
  '',
  'DADOS DO LEAD (JSON):\\n' + JSON.stringify(contexto, null, 1),
].join('\\n');
return { json: { corpo: {
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.5, responseMimeType: 'application/json',
    responseSchema: { type: 'OBJECT', properties: { assunto: { type: 'STRING' }, corpo: { type: 'STRING' } }, required: ['assunto', 'corpo'] } },
} } };` } } });

const gemini = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gemini: preencher a copy', onError: 'continueErrorOutput', parameters: {
  method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', sendHeaders: true,
  headerParameters: { parameters: [{ name: 'x-goog-api-key', value: '={{ $env.GEMINI_API_KEY }}' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.corpo) }}', options: { timeout: 120000 } } } });

const lerRedacao = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Ler redação', onError: 'continueErrorOutput', parameters: {
  mode: 'runOnceForEachItem', jsCode: `// Lê o e-mail redigido; recusa se sobrou alguma {{variável}}.
const t = $('Separar trabalhos').item.json;
const c = ($json.candidates || [])[0] || {};
const texto = ((c.content || {}).parts || []).map((p) => p.text || '').join('').trim();
if (!texto) throw new Error('Gemini respondeu sem texto (' + (c.finishReason || 'sem motivo') + ')');
let r;
try { r = JSON.parse(texto); } catch (err) { throw new Error('JSON inválido do Gemini: ' + err.message); }
const assunto = String(r.assunto || '').trim();
const corpo = String(r.corpo || '').trim();
if (!corpo) throw new Error('E-mail vazio');
if ((assunto + corpo).includes('{{')) throw new Error('Sobrou variável {{ }} sem preencher');
return { json: { trabalho_id: t.id, resultado: { assunto, corpo } } };` } } });

const temFio = ifElse({ version: 2.2, config: { name: 'Continua um fio?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr('{{ $json.payload.responder_a }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
  combinator: 'and' } } } });

const anterior = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gmail: e-mail anterior', onError: 'continueErrorOutput', credentials: { gmailOAuth2: newCredential('Gmail comercial@') }, parameters: {
  method: 'GET', url: "=https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ $json.payload.responder_a }}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References",
  authentication: 'predefinedCredentialType', nodeCredentialType: 'gmailOAuth2', options: { timeout: 30000 } } } });

const montarEmail = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Montar e-mail', onError: 'continueErrorOutput', parameters: {
  mode: 'runOnceForEachItem', jsCode: `// Monta a mensagem (texto puro, UTF-8) no formato do Gmail. No mesmo fio: threadId + In-Reply-To/References.
const t = $('Separar trabalhos').item.json;
const p = t.payload || {};
if (!p.para || !p.corpo) throw new Error('E-mail sem destinatário ou corpo');
const cab = {};
for (const h of (($json.payload || {}).headers || [])) cab[h.name.toLowerCase()] = h.value;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const nome = (p.remetente || 'Aprimora').replace(/"/g, '');
const linhas = [
  'From: =?UTF-8?B?' + b64(nome) + '?= <comercial@aprimoraej.com>',
  'To: ' + p.para,
  'Subject: =?UTF-8?B?' + b64(p.assunto || '') + '?=',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
];
if (cab['message-id']) {
  linhas.push('In-Reply-To: ' + cab['message-id']);
  linhas.push('References: ' + ((cab['references'] ? cab['references'] + ' ' : '') + cab['message-id']));
}
const mime = linhas.join('\\r\\n') + '\\r\\n\\r\\n' + b64(p.corpo).replace(/.{76}/g, '$&\\r\\n');
const raw = Buffer.from(mime, 'utf8').toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const corpo = { raw };
if (p.thread_id && cab['message-id']) corpo.threadId = p.thread_id;
return { json: { corpo } };` } } });

const enviar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gmail: enviar', onError: 'continueErrorOutput', credentials: { gmailOAuth2: newCredential('Gmail comercial@') }, parameters: {
  method: 'POST', url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
  authentication: 'predefinedCredentialType', nodeCredentialType: 'gmailOAuth2',
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.corpo) }}', options: { timeout: 60000 } } } });

const lerEnvio = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Ler envio', onError: 'continueErrorOutput', parameters: {
  mode: 'runOnceForEachItem', jsCode: `const t = $('Separar trabalhos').item.json;
if (!$json.id) throw new Error('Gmail não devolveu o id da mensagem');
return { json: { trabalho_id: t.id, resultado: { gmail_id: $json.id, thread_id: $json.threadId } } };` } } });

const devolver = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Devolver resultado ao portal', parameters: {
  method: 'POST', url: '={{ $env.PORTAL_URL }}/api/n8n/trabalhos/{{ $json.trabalho_id }}/resultado', sendHeaders: true, headerParameters: H,
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ resultado: $json.resultado }) }}', options: { timeout: 30000 } } } });

const falha = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Registrar falha no portal', parameters: {
  method: 'POST', url: "={{ $env.PORTAL_URL }}/api/n8n/trabalhos/{{ $('Separar trabalhos').item.json.id }}/falha", sendHeaders: true, headerParameters: H,
  sendBody: true, specifyBody: 'json',
  jsonBody: "={{ JSON.stringify({ etapa: $('Separar trabalhos').item.json.tipo, mensagem: String(($json.error && ($json.error.message || JSON.stringify($json.error))) || 'erro sem mensagem').slice(0, 1500) }) }}",
  options: { timeout: 30000 } } } });

export default workflow('a5-redator', 'APRIMORA | Agente | A5 Redator')
  .add(nota)
  .add(cron).to(reservar).to(separar).to(ehSaas
    .onTrue(cancelarSaas)
    .onFalse(porTipo
    .onCase(0, montarPedido.onError(falha).to(gemini.onError(falha).to(lerRedacao.onError(falha).to(devolver))))
    .onCase(1, temFio
      .onTrue(anterior.onError(falha).to(montarEmail))
      .onFalse(montarEmail))))
  .add(montarEmail.onError(falha).to(enviar.onError(falha).to(lerEnvio.onError(falha).to(devolver))));
