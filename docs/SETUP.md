# Puesta en marcha (todo en planes gratuitos, sin tarjeta)

Orden recomendado: Supabase → Google OAuth → variables locales → Vercel → SMTP.

## 1. Supabase (base de datos + login)

1. Crear cuenta en <https://supabase.com> (se puede entrar con GitHub) → **New project**.
   - Nombre: `ai-hunting` · Región: la más cercana (ej. *South America (São Paulo)*) · Plan **Free**.
   - Guardar la contraseña de la base en un gestor de contraseñas.
2. **SQL Editor → New query** → pegar y ejecutar (**Run**), en orden, cada archivo de `supabase/migrations/` (`20261001000000_init.sql`, `20261002000000_hunt_country_auto.sql`, …).
3. **Project Settings → API Keys**: copiar
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (**nunca** en el navegador ni en git)
4. **Authentication → Sign In / Providers → Email**: dejar activo **Confirm email** (criterio 1).
5. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (después se cambia por la URL de Vercel)
   - Redirect URLs: `http://localhost:3000/auth/callback`, y luego `https://<tu-app>.vercel.app/auth/callback`

## 2. Google OAuth ("Continuar con Google")

1. <https://console.cloud.google.com> → crear proyecto `ai-hunting`.
2. **APIs & Services → OAuth consent screen** → tipo *External* → nombre de la app, email de soporte → guardar.
3. **Credentials → Create credentials → OAuth client ID** → tipo *Web application*.
   - Authorized redirect URI: la que muestra Supabase en **Authentication → Providers → Google** (`https://<proyecto>.supabase.co/auth/v1/callback`).
4. Copiar *Client ID* y *Client secret* en Supabase → **Providers → Google** → activar → guardar.

## 3. Variables locales

```bash
cp .env.example .env.local   # completar con los valores de arriba
npm install
npm run dev                  # http://localhost:3000
```

## 4. Vercel (hosting)

1. <https://vercel.com> → entrar con GitHub → **Add New → Project** → importar el repo `Aut-Hunting` → plan **Hobby**.
2. En **Environment Variables** cargar las mismas de `.env.local`, más:
   - `NEXT_PUBLIC_SITE_URL` = `https://<tu-app>.vercel.app`
   - `CRON_SECRET` = un texto aleatorio largo
3. Deploy. Después, volver a Supabase → URL Configuration y agregar la URL de Vercel (paso 1.5).
4. El cron diario de `vercel.json` mantiene activo el proyecto de Supabase (se pausa tras 7 días sin uso).

## 5. Gemini (leer imágenes y PDF escaneados; luego, el puntaje de perfiles)

1. <https://aistudio.google.com/apikey> → **Create API key** (capa gratuita, sin tarjeta).
2. Cargar `GEMINI_API_KEY` en `.env.local` y en Vercel → Environment Variables. Sin esta clave, la app acepta texto, PDF con texto, Word y TXT, y rechaza imágenes con un aviso claro.

## 6. SMTP gratuito (Brevo) para los emails de la cuenta

El SMTP incluido en Supabase manda muy pocos emails por hora: con la app abierta al público no alcanza.

1. Crear cuenta en <https://www.brevo.com> (plan **Free**, 300 emails/día, sin tarjeta).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: nombre `AI-Hunting` y el email remitente. Brevo manda un código a ese email para verificarlo.
3. **SMTP & API → SMTP**: anotar *SMTP server* (`smtp-relay.brevo.com`), *Port* (`587`) y *Login*; tocar **Generate a new SMTP key** y copiar la clave (se muestra una sola vez).
4. Supabase → **Authentication → Emails → SMTP Settings** → activar **Enable Custom SMTP** y completar: sender email (el verificado en el paso 2), sender name `AI-Hunting`, host, puerto `587`, usuario (*Login*) y contraseña (la *SMTP key*). Guardar.
5. Supabase → **Authentication → Rate Limits**: subir *Rate limit for sending emails* a 30 por hora.
6. Supabase → **Authentication → Emails → Templates**: pegar las plantillas de `supabase/email-templates/` (español, inglés o portugués según el idioma de la usuaria):
   - **Confirm sign up** ← `confirm-signup.html` · asunto `AI-Hunting · Confirmá tu cuenta / Confirm your account`
   - **Reset password** ← `reset-password.html` · asunto `AI-Hunting · Elegí una contraseña nueva / Reset your password`
7. Supabase → **Authentication → URL Configuration**: *Site URL* = `https://aihunting.vercel.app` (las plantillas arman el link con esa URL) y en *Redirect URLs* tener `https://aihunting.vercel.app/auth/callback`.

> Gmail como remitente funciona, pero algunos emails pueden caer en spam porque Brevo no puede firmar con el dominio de Gmail. Con un dominio propio se corrige más adelante.

## 7. Abrir la app a todo el mundo

1. **Migraciones:** correr en el SQL Editor las que falten de `supabase/migrations/` (la última: `20261003000000_outreach_quota.sql`, cupo de mensajes de contacto).
2. **Publicar Google OAuth** (mientras esté en *Testing* solo pueden entrar las cuentas de prueba):
   1. <https://console.cloud.google.com> → proyecto `ai-hunting` → **Google Auth Platform → Branding**:
      - App name `AI-Hunting`, support email y developer contact.
      - App home page `https://aihunting.vercel.app/es`
      - Privacy policy `https://aihunting.vercel.app/es/privacy`
      - Terms of service `https://aihunting.vercel.app/es/terms`
      - Sin logo (subir un logo obliga a una verificación de marca de varios días).
   2. **Data Access**: solo `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile` (son "no sensibles": no requieren verificación de Google).
   3. **Audience → Publish app → Confirm**. El estado pasa a *In production* y cualquier cuenta de Google puede entrar.
3. **Verificar:** crear una cuenta con un email nuevo (llega el email de Brevo), entrar con otra cuenta de Google que no sea de prueba, hacer un hunting, generar un mensaje y mover un candidato de etapa.

## Verificación

```bash
npm run check   # i18n + lint + tipos + tests
```
