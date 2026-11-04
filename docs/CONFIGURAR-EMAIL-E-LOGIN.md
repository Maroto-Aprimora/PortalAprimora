# Configurar e-mail (Google Workspace) e login no Supabase

Estes passos são feitos **uma vez**, por um diretor, no painel do Supabase e no Google Workspace da Aprimora.
Sem eles, o portal funciona, mas o Supabase só envia **poucos e-mails por hora** (servidor de testes), e os
links dos e-mails podem apontar para o endereço errado.

> Projeto Supabase: **portal-aprimora** (organização Aprimora) · região São Paulo.

---

## 1. Criar a conta que vai enviar os e-mails (Google Workspace)

1. Em [admin.google.com](https://admin.google.com) → **Diretório → Usuários → Adicionar novo usuário**,
   crie `portal@aprimoraej.com` (ou use um e-mail institucional já existente, como o da Diretoria Comercial).
2. Entre nessa conta e ative a **Verificação em duas etapas**:
   [myaccount.google.com/security](https://myaccount.google.com/security) → *Verificação em duas etapas*.
   - Se a opção estiver bloqueada: no Admin, **Segurança → Autenticação → Verificação em duas etapas →
     "Permitir que os usuários ativem a verificação em duas etapas"**.
3. Gere uma **senha de app**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → nome "Supabase Portal" → **Criar**. Copie a senha de 16 letras (ela só aparece uma vez).
   - Se a página disser que senhas de app não estão disponíveis, confira o passo 2.

Guarde a senha de app num lugar seguro da diretoria. **Nunca** coloque essa senha no código ou no GitHub.

## 2. Ligar o SMTP no Supabase

Supabase → projeto **portal-aprimora** → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*:

| Campo | Valor |
|---|---|
| Sender email | `comercial@aprimoraej.com` |
| Sender name | `Portal Aprimora` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `comercial@aprimoraej.com` |
| Password | a senha de app do passo 1.3 |
| Minimum interval between emails | `30` segundos |

Salve. Depois, em **Authentication → Rate Limits**, ajuste *Rate limit for sending emails* para **60 por hora**.
(O Google Workspace permite cerca de 2.000 envios por dia por conta.)

## 2B. Recomendado: Resend no lugar do Gmail (04/11/2026)

**Por que os convites não chegam.** Os registros do Supabase (*Authentication → Logs*) de 04/11/2026 mostram o erro
`535 5.7.8 Username and Password not accepted` (servidor `gsmtp`) toda vez que o portal tenta enviar o link de primeiro
acesso. Ou seja: o SMTP configurado é o do Gmail e o **Google está recusando o usuário ou a senha de app**. As causas
mais comuns são: senha de app revogada (ela some quando a verificação em duas etapas é desligada ou a senha da conta
é trocada), senha de app gerada em outra conta que não a do campo *Username*, ou espaços colados junto com a senha.

Há duas saídas:

- **Rápida**: gerar uma nova senha de app na conta `comercial@aprimoraej.com` (passo 1.3) e colar de novo no passo 2.
- **Recomendada**: usar o **Resend** só para os e-mails do login. Ele não depende da caixa da comercial@ (que o n8n
  usa para a cadência) e o plano gratuito basta: **100 e-mails por dia e 3.000 por mês, 1 domínio**, sem cartão.

### Passo a passo do Resend

1. Crie a conta em [resend.com](https://resend.com) com o e-mail da Diretoria.
2. **Domains → Add domain** → `aprimoraej.com`, região **São Paulo (sa-east-1)** se aparecer.
3. O Resend mostra 3 ou 4 registros DNS. Adicione-os onde o DNS do `aprimoraej.com` é administrado
   (o mesmo lugar onde estão os registros do Google Workspace):

   | Tipo | Nome | Valor |
   |---|---|---|
   | TXT | `resend._domainkey` | a chave DKIM que o Resend mostrar (`p=MIGf...`) |
   | MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` (prioridade 10; copie o valor exato do Resend) |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` (copie o valor exato do Resend) |
   | TXT | `_dmarc` (opcional, se ainda não existir) | `v=DMARC1; p=none;` |

   Os registros ficam no subdomínio `send`, então **não mexem no MX do Google Workspace**: a caixa de e-mail
   continua igual.
4. Clique em **Verify DNS records** e espere ficar *Verified* (de minutos a algumas horas).
5. **API Keys → Create API key** → nome "Supabase Auth", permissão **Sending access**, domínio `aprimoraej.com`.
   Copie a chave (começa com `re_`). Ela só aparece uma vez; guarde com a diretoria e **não** coloque no código.
6. No Supabase → **Authentication → Emails → SMTP Settings**, troque os campos:

   | Campo | Valor |
   |---|---|
   | Sender email | `portal@aprimoraej.com` (não precisa existir como caixa; qualquer endereço do domínio verificado serve) |
   | Sender name | `Portal Aprimora` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | a chave `re_...` do passo 5 |
   | Minimum interval between emails | `10` segundos |

7. Em **Authentication → Rate Limits**, deixe *Rate limit for sending emails* em **30 por hora** (cabe no plano gratuito).
8. Teste pelo passo 6 deste guia. No Resend, a aba **Emails** mostra cada envio (entregue, recusado ou na caixa de spam).

Se quiser respostas dos membros, os modelos podem dizer "dúvidas: comercial@aprimoraej.com"; o endereço do remetente
não recebe e-mails.

## 3. Endereços do portal (URL Configuration)

Supabase → **Authentication → URL Configuration**:

- **Site URL**: o endereço de produção na Vercel, por exemplo `https://portal-aprimora.vercel.app`
  (depois, o domínio próprio, como `https://portal.aprimoraej.com`).
- **Redirect URLs** (adicione as três):
  - `https://portal-aprimora.vercel.app/**`
  - `https://portal-aprimora-*.vercel.app/**` (pré-visualizações das branches de cada fase)
  - `http://localhost:3000/**` (desenvolvimento)

Ajuste os nomes acima se o projeto na Vercel tiver outro nome.

## 4. Provedor de e-mail e cadastro

Supabase → **Authentication → Sign In / Providers → Email**:

- **Enable Email provider**: ligado.
- **Confirm email**: ligado.
- **Allow new users to sign up** (em *User Signups*): **ligado**. Isso é necessário para o "Primeiro acesso".
  O cadastro continua fechado: o banco **recusa qualquer e-mail que não esteja pré-cadastrado**
  (gatilho `ao_criar_usuario`). Ninguém de fora consegue criar conta.

## 5. Modelos de e-mail em português

Supabase (projeto **portal-aprimora**) → **Authentication → Emails → Templates**. Em cada modelo, troque o
**Subject** e cole o corpo em **Message body** (aba *Source*), depois **Save**. Todos seguem o mesmo visual
(cabeçalho azul da Aprimora e botão laranja). Não altere o que está entre `{{ }}`: o Supabase troca pelo link,
código ou e-mail na hora do envio.

### Confirm sign up

Usado no **Primeiro acesso** e em **Membros → Enviar convite** (quem ainda não tem conta).

**Assunto:** `Ative seu acesso ao Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Você foi pré-cadastrado(a) no <strong>Portal Aprimora</strong>, o sistema da Diretoria Comercial da Aprimora.</p>
    <p>Clique no botão abaixo para ativar sua conta e criar sua senha.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#e8833a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Ativar meu acesso</a>
    </p>
    <p style="font-size:12px;color:#5b6573">O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu isto, ignore este e-mail.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

### Invite user

O portal hoje convida pelo "Confirm sign up"; este modelo fica pronto caso o convite passe a sair pelo painel do Supabase (*Invite user*).

**Assunto:** `Você foi convidado(a) para o Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>A Diretoria Comercial convidou você para o <strong>Portal Aprimora</strong>: funil de vendas, tarefas, agenda e indicadores do time em um só lugar.</p>
    <p>Clique no botão abaixo para aceitar o convite e criar sua senha.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#e8833a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Aceitar convite</a>
    </p>
    <p style="font-size:12px;color:#5b6573">O convite vale por 24 horas e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

### Magic link or OTP

Usado em **Esqueci minha senha** e no reenvio do acesso (quem já tem conta): o link entra no portal e abre a tela de definir senha.

**Assunto:** `Seu link de acesso ao Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Use o botão abaixo para entrar no Portal Aprimora. Em seguida, você pode definir uma nova senha.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#e8833a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Acessar o portal</a>
    </p>
    <p style="font-size:12px;color:#5b6573">O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu isto, ignore este e-mail.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

### Change email address

Enviado quando um membro troca o e-mail da conta.

**Assunto:** `Confirme seu novo e-mail no Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Recebemos um pedido para trocar o e-mail da sua conta no Portal Aprimora de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>.</p>
    <p>Clique no botão abaixo para confirmar a troca.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#e8833a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Confirmar novo e-mail</a>
    </p>
    <p style="font-size:12px;color:#5b6573">O link vale por 1 hora. Se você não pediu esta troca, ignore este e-mail e avise a Diretoria Comercial: seu e-mail atual continua valendo.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

### Reset password

O portal hoje redefine a senha pelo link de acesso (modelo acima); este fica pronto caso a redefinição passe a sair pelo Supabase (*Reset password*).

**Assunto:** `Redefinir sua senha do Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no Portal Aprimora ({{ .Email }}).</p>
    <p>Clique no botão abaixo para criar uma nova senha.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="{{ .ConfirmationURL }}" style="background:#e8833a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Criar nova senha</a>
    </p>
    <p style="font-size:12px;color:#5b6573">O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu isto, ignore este e-mail: sua senha atual continua valendo.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

### Reauthentication

Pedido pelo Supabase antes de operações sensíveis (hoje o portal não usa, mas fica pronto). Só tem código, não tem link.

**Assunto:** `Seu código de confirmação do Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Para concluir uma alteração sensível na sua conta (como trocar a senha), digite o código abaixo no portal:</p>
    <p style="text-align:center;margin:28px 0;font-size:28px;font-weight:bold;letter-spacing:6px;color:#24476f">{{ .Token }}</p>
    <p style="font-size:12px;color:#5b6573">O código vale por poucos minutos. Se você não está fazendo nenhuma alteração, ignore este e-mail e avise a Diretoria Comercial.</p>
    <p style="font-size:12px;color:#5b6573">Aprimora Consultoria · Diretoria Comercial</p>
  </div>
</div>
```

## 6. Testar

1. Abra o portal → **Primeiro acesso** → informe `maroto@aprimoraej.com`.
2. O e-mail deve chegar de `comercial@aprimoraej.com` em menos de 1 minuto.
3. O link abre o portal na tela **Definir senha**. Defina a senha e pronto.
4. Para os demais membros: tela **Membros → Enviar convite** (o diretor dispara o mesmo e-mail).

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Muitas tentativas" | Limite de envio do Supabase. Confira o passo 2 (SMTP) e os Rate Limits. |
| E-mail não chega | Veja o spam; confira usuário e senha de app no SMTP; veja *Authentication → Logs*. |
| Logs com `535 Username and Password not accepted` | Senha de app do Gmail inválida: gere outra (passo 1.3) ou use o Resend (passo 2B). |
| Link abre a página errada / "redirect not allowed" | Passo 3: adicione a URL nas Redirect URLs. |
| "Este e-mail não está pré-cadastrado" | O diretor precisa pré-cadastrar a pessoa na tela **Membros**. |
