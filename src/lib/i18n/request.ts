import { getRequestConfig } from "next-intl/server";
import { locales, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const validLocale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : "en";

  return {
    locale: validLocale,
    messages: {
      ...(await import(`../../../public/locales/${validLocale}/common.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/landing.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/auth.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/models.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/pricing.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/docs.json`))
        .default,
      ...(await import(`../../../public/locales/${validLocale}/dashboard.json`))
        .default,
    },
  };
});
