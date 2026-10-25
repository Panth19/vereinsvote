import nodemailer from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createMailer(smtpUrl: string | undefined, from: string): Mailer {
  if (!smtpUrl) {
    return {
      async send(mail) {
        console.info(`[mail] no SMTP configured, not sending "${mail.subject}"`);
      },
    };
  }
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(mail) {
      await transport.sendMail({ from, ...mail });
    },
  };
}
