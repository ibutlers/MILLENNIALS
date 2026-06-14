/** Represents an outbound email message. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Abstract transport for delivering emails.
 * Implementations decide how to actually send (SMTP, console log, in-memory store, etc.).
 */
export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

/** Discriminated union for email content types. */
export interface VerificationEmail {
  type: 'verification';
  token: string;
}

export interface PasswordResetEmail {
  type: 'password-reset';
  token: string;
}

export type EmailContentInput = VerificationEmail | PasswordResetEmail;

/**
 * Creates the subject, plain-text body, and HTML body for a given email type.
 *
 * @param input - The email type and token.
 * @param appBaseUrl - The application's public base URL (e.g. https://example.com).
 *                     Must not have a trailing slash.
 * @returns An object with `subject` (Spanish), `text`, and `html`.
 */
export function createEmailContent(
  input: EmailContentInput,
  appBaseUrl: string,
): { subject: string; text: string; html: string } {
  const base = appBaseUrl.replace(/\/+$/, '');
  const disclaimer = 'Este es un mensaje automático. Por favor, no respondas a este correo.';

  if (input.type === 'verification') {
    const link = `${base}/verify-email?token=${encodeURIComponent(input.token)}`;
    const subject = 'Verifica tu dirección de correo electrónico';

    const text = [
      'Gracias por registrarte.',
      '',
      `Para verificar tu dirección de correo electrónico, visita el siguiente enlace:`,
      link,
      '',
      disclaimer,
    ].join('\n');

    const html = [
      '<p>Gracias por registrarte.</p>',
      '<p>Para verificar tu dirección de correo electrónico, haz clic en el siguiente enlace:</p>',
      `<p><a href="${link}">Verificar correo electrónico</a></p>`,
      `<p style="color:#6b7280;font-size:0.875rem;">${disclaimer}</p>`,
    ].join('\n');

    return { subject, text, html };
  }

  // password-reset
  const link = `${base}/reset-password?token=${encodeURIComponent(input.token)}`;
  const subject = 'Restablece tu contraseña';

  const text = [
    'Has solicitado restablecer tu contraseña.',
    '',
    `Para continuar, visita el siguiente enlace:`,
    link,
    '',
    'Si no solicitaste este cambio, puedes ignorar este mensaje.',
    '',
    disclaimer,
  ].join('\n');

  const html = [
    '<p>Has solicitado restablecer tu contraseña.</p>',
    '<p>Para continuar, haz clic en el siguiente enlace:</p>',
    `<p><a href="${link}">Restablecer contraseña</a></p>`,
    '<p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>',
    `<p style="color:#6b7280;font-size:0.875rem;">${disclaimer}</p>`,
  ].join('\n');

  return { subject, text, html };
}

/**
 * In-memory email transport for testing.
 * Stores every sent email so tests can inspect them.
 */
export class TestEmailTransport implements EmailTransport {
  private messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push({ ...message });
  }

  /** Returns a shallow copy of all stored messages. */
  getMessages(): readonly EmailMessage[] {
    return [...this.messages];
  }

  /** Clears all stored messages. */
  clear(): void {
    this.messages = [];
  }
}

/**
 * Transport that logs emails to the console.
 * Intended for development or when EMAIL_DELIVERY_ENABLED=false.
 */
export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[EMAIL] To: ${message.to} | Subject: ${message.subject}`,
    );
    console.log(`[EMAIL] Text:\n${message.text}`);
  }
}
