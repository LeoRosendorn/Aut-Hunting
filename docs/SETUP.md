# Puesta en marcha (todo en planes gratuitos, sin tarjeta)

Orden recomendado: Supabase → Google OAuth → variables locales → Vercel → SMTP.

## 1. Supabase (base de datos + login)

1. Crear cuenta en <https://supabase.com> (se puede entrar con GitHub) → **New project**.
   - Nombre: `aut-hunting` · Región: la más cercana (ej. *South America (São Paulo)*) · Plan **Free**.
   - Guardar la contraseña de la base en un gestor de contraseñas.
2. **SQL Editor → New query** → pegar el contenido de `supabase/migrations/20261001000000_init.sql` → **Run**.
3. **Project Settings → API Keys**: copiar
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (**nunca** en el navegador ni en git)
4. **Authentication → Sign In / Providers → Email**: dejar activo **Confirm email** (criterio 1).
5. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (después se cambia por la URL de Vercel)
   - Redirect URLs: `http://localhost:3000/auth/callback`, y luego `https://<tu-app>.vercel.app/auth/callback`

## 2. Google OAuth ("Continuar con Google")

1. <https://console.cloud.google.com> → crear proyecto `aut-hunting`.
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

1. <https://vercel.com> → entrar con GitHub → **Add New → Project** → importar `Aut-Hunting` → plan **Hobby**.
2. En **Environment Variables** cargar las mismas de `.env.local`, más:
   - `NEXT_PUBLIC_SITE_URL` = `https://<tu-app>.vercel.app`
   - `CRON_SECRET` = un texto aleatorio largo
3. Deploy. Después, volver a Supabase → URL Configuration y agregar la URL de Vercel (paso 1.5).
4. El cron diario de `vercel.json` mantiene activo el proyecto de Supabase (se pausa tras 7 días sin uso).

## 5. SMTP gratuito para los emails de confirmación

El SMTP incluido en Supabase tiene un límite por hora muy bajo. Para uso real:

1. Crear cuenta en <https://www.brevo.com> (plan Free) y verificar el email remitente.
2. **SMTP & API → SMTP**: copiar host, puerto, usuario y clave SMTP.
3. Supabase → **Authentication → Emails → SMTP Settings** → activar *Custom SMTP* y pegar los datos.

## Verificación

```bash
npm run check   # i18n + lint + tipos + tests
```
