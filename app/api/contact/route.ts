import {Buffer} from 'node:buffer';
import {NextResponse} from 'next/server';
import nodemailer from 'nodemailer';
import {createTranslator} from 'next-intl';
import {ZodError} from 'zod';
import siteContent from '@/content/site.json';
import {verifyCaptcha} from '@/lib/captcha';
import {Locale, defaultLocale, isLocale} from '@/lib/i18n';
import {parseFormData} from '@/lib/validators';

export const runtime = 'nodejs';

const brandName = siteContent.site?.name ?? 'NovaSoft';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

const formatAddress = (address: string) => `${brandName} <${address}>`;

type Attachment = {
  filename: string;
  data: Buffer;
  contentType?: string;
};

type EmailPayload = {
  name: string;
  email: string;
  company?: string;
  message: string;
  service: string;
  serviceLabel: string;
  locale: Locale;
  attachment?: Attachment;
};

async function sendEmail(payload: EmailPayload) {
  const to = process.env.CONTACT_TO_EMAIL ?? siteContent.site?.contact?.email;
  if (!to) {
    throw new Error('contact_recipient_missing');
  }

  const defaultFrom = process.env.CONTACT_FROM_EMAIL || to;
  const subject = `[${brandName}] ${payload.name} — ${payload.serviceLabel}`;
  const text = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company: ${payload.company ?? 'N/A'}`,
    `Service: ${payload.serviceLabel} (${payload.service})`,
    `Locale: ${payload.locale}`,
    '',
    payload.message,
  ].join('\n');

  const messageHtml = payload.message
    .split('\n')
    .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
    .join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#0f172a;">
      <h2 style="font-size:18px;margin:0 0 16px;">New inquiry from ${escapeHtml(payload.name)}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px;">
        <tbody>
          <tr>
            <td style="padding:4px 0;font-weight:600;width:120px;">Email</td>
            <td style="padding:4px 0;"><a href="mailto:${escapeHtml(payload.email)}" style="color:#2563eb;">${escapeHtml(payload.email)}</a></td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-weight:600;">Company</td>
            <td style="padding:4px 0;">${escapeHtml(payload.company ?? 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-weight:600;">Service</td>
            <td style="padding:4px 0;">${escapeHtml(payload.serviceLabel)} <span style="color:#64748b;">(${escapeHtml(payload.service)})</span></td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-weight:600;">Locale</td>
            <td style="padding:4px 0;">${escapeHtml(payload.locale)}</td>
          </tr>
        </tbody>
      </table>
      <hr style="margin:24px 0;border:0;border-top:1px solid #e2e8f0;" />
      <div>${messageHtml}</div>
    </div>
  `;

  const resendAttachment = payload.attachment
    ? [
        {
          filename: payload.attachment.filename,
          content: payload.attachment.data.toString('base64'),
          contentType: payload.attachment.contentType,
        },
      ]
    : undefined;

  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM_EMAIL || defaultFrom;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formatAddress(from),
        to: [to],
        reply_to: payload.email,
        subject,
        text,
        html,
        attachments: resendAttachment,
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error('Resend request failed', response.status, details);
      throw new Error('resend_request_failed');
    }
    return;
  }

  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
    });

    await transporter.sendMail({
      to,
      from: formatAddress(process.env.SMTP_FROM || defaultFrom),
      replyTo: payload.email,
      subject,
      text,
      html,
      attachments: payload.attachment
        ? [
            {
              filename: payload.attachment.filename,
              content: payload.attachment.data,
              contentType: payload.attachment.contentType,
            },
          ]
        : undefined,
    });
    return;
  }

  throw new Error('mail_provider_not_configured');
}

async function appendToSheet(data: Record<string, unknown>) {
  const webhook = process.env.SHEET_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Sheet webhook error', error);
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const localeParam = form.get('locale');
    const locale = isLocale(typeof localeParam === 'string' ? localeParam : undefined)
      ? (localeParam as Locale)
      : defaultLocale;

    const messages = (await import(`@/public/locales/${locale}/common.json`)).default;
    const translator = createTranslator({ locale, messages });
    const parsed = parseFormData(form, (key) => translator(key));

    const captchaValid = await verifyCaptcha(parsed.token);
    if (!captchaValid) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 400 });
    }

    const { file, token, honeypot, ...rest } = parsed;

    const service = siteContent.services.find((item) => item.key === rest.service);
    const serviceLabel = service?.title?.[locale] ?? rest.service;

    const attachment = file
      ? {
          filename: file.name,
          data: Buffer.from(await file.arrayBuffer()),
          contentType: file.type || undefined,
        }
      : undefined;

    await sendEmail({
      ...rest,
      locale,
      serviceLabel,
      attachment,
    });
    await appendToSheet({
      ...rest,
      service: serviceLabel,
      serviceKey: rest.service,
      locale,
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const [field] = issue.path;
        if (typeof field === 'string' && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return NextResponse.json({ error: 'validation_error', errors: fieldErrors }, { status: 422 });
    }

    if (error instanceof Error) {
      switch (error.message) {
        case 'contact_recipient_missing':
          return NextResponse.json({ error: 'contact_recipient_missing' }, { status: 500 });
        case 'mail_provider_not_configured':
          return NextResponse.json({ error: 'mail_provider_not_configured' }, { status: 500 });
        case 'resend_request_failed':
          return NextResponse.json({ error: 'email_failed' }, { status: 502 });
        default:
          break;
      }
      console.error('Contact form error', error);
      return NextResponse.json({ error: 'invalid_request' }, { status: 500 });
    }

    console.error('Unknown contact form error', error);
    return NextResponse.json({ error: 'invalid_request' }, { status: 500 });
  }
}
