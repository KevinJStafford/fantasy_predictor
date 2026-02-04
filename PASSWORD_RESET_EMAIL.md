# Password reset email setup

When a user requests a password reset, the backend can send the reset link by email instead of returning it in the API response. Configure the following environment variables on your backend (e.g. in Render dashboard).

## Required

| Variable | Description |
|----------|-------------|
| `RESET_PASSWORD_BASE_URL` | Your frontend URL (no trailing slash). Example: `https://your-app.vercel.app`. Used in the reset link. |
| `MAIL_SERVER` | SMTP server hostname. Set this to enable sending; if unset, the API still returns a `reset_link` in the response (for dev). |
| `MAIL_USERNAME` | SMTP login (often your email). |
| `MAIL_PASSWORD` | SMTP password or app password. |

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `MAIL_PORT` | `587` | SMTP port. |
| `MAIL_USE_TLS` | `true` | Use STARTTLS. |
| `MAIL_DEFAULT_SENDER` | same as `MAIL_USERNAME` | From address; can be `"App Name <noreply@example.com>"`. |

---

## Gmail

1. Use an **App Password**, not your normal Gmail password:
   - Turn on 2-Step Verification for your Google account.
   - Go to [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords).
   - Create an app password and copy it.

2. Set:

   ```bash
   RESET_PASSWORD_BASE_URL=https://your-frontend.vercel.app
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USE_TLS=true
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-16-char-app-password
   MAIL_DEFAULT_SENDER=Fantasy Predictor <your-email@gmail.com>
   ```

---

## SendGrid

1. Create an API key in [SendGrid](https://sendgrid.com/) (Dashboard → Settings → API Keys).
2. Use SendGrid’s SMTP relay:

   ```bash
   RESET_PASSWORD_BASE_URL=https://your-frontend.vercel.app
   MAIL_SERVER=smtp.sendgrid.net
   MAIL_PORT=587
   MAIL_USE_TLS=true
   MAIL_USERNAME=apikey
   MAIL_PASSWORD=your-sendgrid-api-key
   MAIL_DEFAULT_SENDER=Your App <noreply@yourdomain.com>
   ```

---

## Mailgun

1. In Mailgun, open your domain and note **SMTP credentials** (hostname, port, username, password).
2. Set:

   ```bash
   RESET_PASSWORD_BASE_URL=https://your-frontend.vercel.app
   MAIL_SERVER=smtp.mailgun.org
   MAIL_PORT=587
   MAIL_USE_TLS=true
   MAIL_USERNAME=postmaster@your-domain.mailgun.org
   MAIL_PASSWORD=your-mailgun-smtp-password
   MAIL_DEFAULT_SENDER=Your App <noreply@your-domain.com>
   ```

---

## Testing

- **Without email configured:** Leave `MAIL_SERVER` unset. After submitting “Forgot password”, the app shows the reset link on the same page so you can click it to set a new password (link expires in 1 hour).
- **With email configured:** Set all variables above. Request a reset with a real email address and check the inbox (and spam). The app still shows the reset link on the page if you don’t receive the email.

## Troubleshooting

- **“Email never sends”** – If you never receive the reset email, the app always shows a **“Reset password”** link on the Forgot Password success screen when an account exists. Use that link to reset; it expires in 1 hour.
- To enable real email delivery, set `MAIL_SERVER` and the other `MAIL_*` variables in your backend environment (e.g. Render dashboard). See Gmail / SendGrid / Mailgun above.
