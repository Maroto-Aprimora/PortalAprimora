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

Usado no **Primeiro acesso** (o membro pede o link na tela de login).

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

Usado em **Membros → Enviar convite**.

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

Usado no login por link ("Entrar com link") e no reenvio do acesso.

**Assunto:** `Seu link de acesso ao Portal Aprimora`

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1a2433">
  <div style="background:#24476f;padding:20px 24px;border-radius:8px 8px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px">APRIMORA</span>
    <span style="color:#f5a66a;font-size:12px;display:block">Portal Aprimora</span>
  </div>
  <div style="border:1px solid #dde3ea;border-top:0;padding:24px;border-radius:0 0 8px 8px">
    <p>Olá!</p>
    <p>Use o botão abaixo para entrar no Portal Aprimora.</p>
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

Usado em **Esqueci minha senha**.

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
| Link abre a página errada / "redirect not allowed" | Passo 3: adicione a URL nas Redirect URLs. |
| "Este e-mail não está pré-cadastrado" | O diretor precisa pré-cadastrar a pessoa na tela **Membros**. |
