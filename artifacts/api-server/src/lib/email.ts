import { logger } from "./logger";
import { getUncachableResendClient } from "./resend";

function appBaseUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) {
    return `https://${domain}`;
  }
  return "http://localhost:5000";
}

export function magicLinkUrl(token: string): string {
  return `${appBaseUrl()}/verificar?token=${encodeURIComponent(token)}`;
}

export function inviteUrl(code: string): string {
  return `${appBaseUrl()}/entrar/${encodeURIComponent(code)}`;
}

const isDev = process.env.NODE_ENV !== "production";

async function trySend(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const { error } = await client.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error({ error }, "Resend returned an error");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "Could not send email (Resend not connected?)",
    );
    return false;
  }
}

function baseTemplate(title: string, body: string, ctaUrl: string, ctaLabel: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h1 style="font-size: 20px; margin-bottom: 8px;">${title}</h1>
    <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">${body}</p>
    <p style="margin: 28px 0;">
      <a href="${ctaUrl}" style="background: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; display: inline-block;">${ctaLabel}</a>
    </p>
    <p style="font-size: 13px; color: #9ca3af;">Se voce nao esperava este email, pode ignora-lo.</p>
  </div>`;
}

export async function sendMagicLinkEmail(
  to: string,
  name: string,
  token: string,
): Promise<boolean> {
  const url = magicLinkUrl(token);
  return trySend(
    to,
    "Seu link de acesso - Life Group",
    baseTemplate(
      `Ola, ${name}`,
      "Use o botao abaixo para acessar sua celula. O link expira em 30 minutos.",
      url,
      "Acessar minha celula",
    ),
  );
}

export async function sendInviteEmail(
  to: string,
  code: string,
): Promise<boolean> {
  const url = inviteUrl(code);
  return trySend(
    to,
    "Voce foi convidado para a celula - Life Group",
    baseTemplate(
      "Voce foi convidado",
      "Voce recebeu um convite para participar de uma celula. O convite expira em 24 horas.",
      url,
      "Aceitar convite",
    ),
  );
}

export const includeDevLink = isDev;
