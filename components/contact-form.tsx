'use client';

import Script from 'next/script';
import {useTranslations} from 'next-intl';
import {FormEvent, useEffect, useMemo, useState} from 'react';
import type {CaptchaClientConfig} from '@/lib/captcha';
import siteContent from '@/content/site.json';
import {createContactSchema, MAX_MESSAGE_LENGTH} from '@/lib/validators';

interface Props {
  locale: string;
  defaultService?: string;
  captcha?: CaptchaClientConfig | null;
}

type Status = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

declare global {
  interface Window {
    novasoftOnHcaptcha?: (token: string) => void;
    novasoftOnTurnstile?: (token: string) => void;
    hcaptcha?: {reset: (widgetId?: string) => void};
    turnstile?: {reset: (element: HTMLElement) => void};
  }
}

export function ContactForm({locale, defaultService, captcha}: Props) {
  const t = useTranslations();
  const contactT = useTranslations('contact');
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();

  const captchaType = captcha?.type ?? null;

  useEffect(() => {
    if (captchaType === 'hcaptcha') {
      window.novasoftOnHcaptcha = (token: string) => setCaptchaToken(token);
    } else if (captchaType === 'turnstile') {
      window.novasoftOnTurnstile = (token: string) => setCaptchaToken(token);
    }
    return () => {
      window.novasoftOnHcaptcha = undefined;
      window.novasoftOnTurnstile = undefined;
    };
  }, [captchaType]);

  const schema = useMemo(() => createContactSchema((key) => t(key)), [t]);

  const resetCaptcha = () => {
    if (captchaType === 'hcaptcha' && window.hcaptcha) {
      window.hcaptcha.reset();
    }
    if (captchaType === 'turnstile') {
      const el = document.querySelector('.cf-turnstile') as HTMLElement | null;
      if (el && window.turnstile) {
        window.turnstile.reset(el);
      }
    }
    setCaptchaToken(undefined);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('validating');
    setErrors({});

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      company: formData.get('company') || undefined,
      message: formData.get('message'),
      service: formData.get('service'),
      token: captchaToken,
      honeypot: formData.get('company-website'),
      file: formData.get('file')
    };

    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === 'string') {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setStatus('idle');
      return;
    }

    setStatus('submitting');

    const submission = new FormData();
    submission.append('name', parsed.data.name);
    submission.append('email', parsed.data.email);
    if (parsed.data.company) submission.append('company', parsed.data.company);
    submission.append('message', parsed.data.message);
    submission.append('service', parsed.data.service);
    if (parsed.data.token) submission.append('token', parsed.data.token);
    if (parsed.data.file) submission.append('file', parsed.data.file);
    submission.append('locale', locale);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: submission
      });

      if (!response.ok) {
        throw new Error('Failed');
      }

      setStatus('success');
      formElement.reset();
      resetCaptcha();
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-8 shadow-xl shadow-black/20"
      noValidate
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-200">
            {contactT('name')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
          {errors.name ? <p className="mt-2 text-xs text-red-400">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
            {contactT('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
          {errors.email ? <p className="mt-2 text-xs text-red-400">{errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-zinc-200">
            {contactT('company')}
          </label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {errors.company ? <p className="mt-2 text-xs text-red-400">{errors.company}</p> : null}
        </div>
        <div>
          <label htmlFor="service" className="block text-sm font-medium text-zinc-200">
            {contactT('service')}
          </label>
          <select
            id="service"
            name="service"
            defaultValue={defaultService ?? ''}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            required
          >
            <option value="">{contactT('servicePlaceholder')}</option>
            {siteContent.services.map((service) => (
              <option key={service.key} value={service.key}>
                {service.title[locale as keyof typeof service.title]}
              </option>
            ))}
          </select>
          {errors.service ? <p className="mt-2 text-xs text-red-400">{errors.service}</p> : null}
        </div>
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-zinc-200">
          {contactT('message')}
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          maxLength={MAX_MESSAGE_LENGTH}
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          required
        />
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span className="text-red-400">{errors.message ?? ''}</span>
          <span>{MAX_MESSAGE_LENGTH} max</span>
        </div>
      </div>
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-zinc-200">
          {contactT('file')}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          className="mt-2 block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/30"
        />
        {errors.file ? <p className="mt-2 text-xs text-red-400">{errors.file}</p> : null}
      </div>
      <div aria-hidden="true" className="hidden">
        <label htmlFor="company-website">Company Website</label>
        <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {captchaType === 'hcaptcha' && captcha?.siteKey ? (
        <div className="flex justify-center">
          <Script src="https://js.hcaptcha.com/1/api.js" async defer />
          <div className="h-captcha" data-sitekey={captcha.siteKey} data-callback="novasoftOnHcaptcha" />
        </div>
      ) : null}
      {captchaType === 'turnstile' && captcha?.siteKey ? (
        <div className="flex justify-center">
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={captcha.siteKey} data-callback="novasoftOnTurnstile" data-theme="dark" />
        </div>
      ) : null}
      <button
        type="submit"
        className="w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        disabled={status === 'submitting' || status === 'validating'}
      >
        {status === 'validating'
          ? contactT('validating')
          : status === 'submitting'
            ? contactT('sending')
            : contactT('submit')}
      </button>
      <div role="status" aria-live="polite" className="text-sm">
        {status === 'success' ? (
          <p className="text-brand-light">{contactT('success')}</p>
        ) : null}
        {status === 'error' ? <p className="text-red-400">{contactT('error')}</p> : null}
      </div>
    </form>
  );
}
