import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export function HeroSection() {
  const t = useTranslations("hero");

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,hsl(var(--primary)/0.08),transparent)]" />
      <div className="container text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          {t("title")}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 h-12 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/models"
            className="inline-flex items-center justify-center rounded-lg border border-border px-8 h-12 text-base font-medium hover:bg-accent hover:text-accent-foreground transition-colors gap-2"
          >
            {t("ctaSecondary")}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

        {/* Code preview */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-muted-foreground">Terminal</span>
            </div>
            <pre className="p-4 text-sm text-left overflow-x-auto">
              <code className="text-muted-foreground">
                <span className="text-green-500">curl</span>{" "}
                <span className="text-yellow-500">https://api.wuguhub.com/v1/chat/completions</span>{" "}
                \{"\n"}
                {"  "}-H <span className="text-blue-400">&quot;Authorization: Bearer hiai-xxx&quot;</span> \{"\n"}
                {"  "}-H <span className="text-blue-400">&quot;Content-Type: application/json&quot;</span> \{"\n"}
                {"  "}-d <span className="text-blue-400">&apos;{"{"}&quot;model&quot;: &quot;gpt-4o&quot;, &quot;messages&quot;: [...]{"}"}&apos;</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
