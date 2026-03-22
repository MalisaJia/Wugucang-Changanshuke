"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLocale = () => {
    const next = locale === "en" ? "zh" : "en";
    // Strip current locale prefix from path
    const pathWithoutLocale = pathname.replace(/^\/(en|zh)/, "") || "/";
    // Build new path: default locale (en) has no prefix, zh gets /zh prefix
    const newPath = next === "en" ? pathWithoutLocale : `/${next}${pathWithoutLocale}`;
    router.replace(newPath);
  };

  return (
    <button
      onClick={toggleLocale}
      className="inline-flex items-center justify-center rounded-md px-3 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      aria-label="Switch language"
    >
      {locale === "en" ? "中文" : "EN"}
    </button>
  );
}
