import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export function CTASection() {
  const t = useTranslations("cta");

  return (
    <section className="py-20 md:py-28">
      <div className="container text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t("title")}
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
          {t("subtitle")}
        </p>
        <Link
          href="/register"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 h-12 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 gap-2"
        >
          {t("button")}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </Link>
      </div>
    </section>
  );
}
