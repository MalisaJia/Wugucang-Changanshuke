import { getRequestConfig } from "next-intl/server";
import { locales, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : "en";

  return {
    locale,
    messages: {
      ...(await import(`../../../public/locales/${locale}/common.json`)).default,
      ...(await import(`../../../public/locales/${locale}/landing.json`)).default,
      ...(await import(`../../../public/locales/${locale}/auth.json`)).default,
      ...(await import(`../../../public/locales/${locale}/models.json`)).default,
      ...(await import(`../../../public/locales/${locale}/pricing.json`)).default,
      ...(await import(`../../../public/locales/${locale}/docs.json`)).default,
      ...(await import(`../../../public/locales/${locale}/dashboard.json`)).default,
      ...(await import(`../../../public/locales/${locale}/billing.json`)).default,
      ...(await import(`../../../public/locales/${locale}/chat.json`)).default,
      ...(await import(`../../../public/locales/${locale}/providers.json`)).default,
      ...(await import(`../../../public/locales/${locale}/team.json`)).default,
      ...(await import(`../../../public/locales/${locale}/analytics.json`)).default,
      ...(await import(`../../../public/locales/${locale}/admin.json`)).default,
    },
  };
});
