import type {Metadata} from 'next';
import {getTranslations, unstable_setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ContactForm} from '@/components/contact-form';
import {getCaptchaClientConfig} from '@/lib/captcha';
import {getContactJsonLd} from '@/lib/schema';
import {buildMetadata} from '@/lib/seo';
import {Locale, isLocale} from '@/lib/i18n';
import siteContent from '@/content/site.json';

export async function generateMetadata({
  params
}: {
  params: {locale: string};
}): Promise<Metadata> {
  const {locale} = params;

  if (!isLocale(locale)) {
    notFound();
  }

  const meta = await getTranslations({locale, namespace: 'meta'});

  return buildMetadata({
    locale,
    title: meta('contactTitle'),
    description: meta('homeDescription'),
    path: `/${locale}/contact`
  });
}

export default async function ContactPage({
  params,
  searchParams
}: {
  params: {locale: string};
  searchParams?: {service?: string};
}) {
  const locale = params.locale;

  if (!isLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  const contactCopy = await getTranslations({locale, namespace: 'contact'});
  const defaultService = siteContent.services.find((service) => service.key === searchParams?.service)?.key;

  const captcha = getCaptchaClientConfig();

  return (
    <section className="bg-zinc-950 py-20">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 text-center sm:px-6 lg:px-8">
        <span className="text-sm font-semibold uppercase tracking-wide text-brand-light">
          {contactCopy('subtitle')}
        </span>
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">{contactCopy('title')}</h1>
        <p className="text-sm text-zinc-400">{contactCopy('lead')}</p>
      </div>
      <div className="mx-auto mt-10 max-w-4xl px-4 sm:px-6 lg:px-8">
        <ContactForm locale={locale} defaultService={defaultService} captcha={captcha} />
      </div>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{__html: getContactJsonLd(locale as Locale)}}
      />
    </section>
  );
}
