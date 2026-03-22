import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("product")}</h3>
            <ul className="space-y-3">
              <li><Link href="/models" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("documentation")}</Link></li>
              <li><Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("apiReference")}</Link></li>
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("status")}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("resources")}</h3>
            <ul className="space-y-3">
              <li><Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("documentation")}</Link></li>
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("blog")}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("company")}</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("about")}</Link></li>
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("careers")}</Link></li>
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("contact")}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("legal")}</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("privacy")}</Link></li>
              <li><Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("terms")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">W</span>
            </div>
            <span className="font-semibold">WuguHub</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; {t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
