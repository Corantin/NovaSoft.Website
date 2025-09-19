import {unstable_setRequestLocale, getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {About} from '@/components/about';
import {ContactForm} from '@/components/contact-form';
import {Hero} from '@/components/hero';
import {Portfolio} from '@/components/portfolio';
import {Process} from '@/components/process';
import {Services} from '@/components/services';
import {getCaptchaClientConfig} from '@/lib/captcha';
import {getHomeJsonLd} from '@/lib/schema';
import {Locale, isLocale} from '@/lib/i18n';

export default async function HomePage({
  params
}: {
  params: {locale: string};
}) {
  const locale = params.locale;

  if (!isLocale(locale)) {
    notFound();
  }

  unstable_setRequestLocale(locale);

  const contactCopy = await getTranslations({locale, namespace: 'contact'});

  const captcha = getCaptchaClientConfig();

  return (
    <>
      <Hero locale={locale as Locale} />
      <Services locale={locale as Locale} />
      <Process locale={locale as Locale} />
      <Portfolio locale={locale as Locale} />
      <About />
      <section id="contact" aria-labelledby="contact-heading" className="bg-zinc-950 py-16 sm:py-24">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 text-center sm:px-6 lg:px-8">
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-light">
            {contactCopy('subtitle')}
          </span>
          <h2 id="contact-heading" className="text-3xl font-semibold text-white sm:text-4xl">
            {contactCopy('title')}
          </h2>
        </div>
        <div className="mx-auto mt-10 max-w-4xl px-4 sm:px-6 lg:px-8">
          <ContactForm locale={locale} captcha={captcha} />
        </div>
      </section>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{__html: getHomeJsonLd(locale as Locale)}}
      />
    </>
  );
}
