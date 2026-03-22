"use client";

export const runtime = 'edge';

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Key, Code, Zap, AlertTriangle, BookOpen, Rocket, Shield, FileCode } from "lucide-react";

const errorCodes = ["400", "401", "404", "429", "500", "502"] as const;

export default function DocsPage() {
  const t = useTranslations("docs");

  const tocItems = [
    { id: "quick-start", label: t("quickStart.title"), icon: Rocket },
    { id: "authentication", label: t("authentication.title"), icon: Key },
    { id: "api-reference", label: t("apiReference.title"), icon: FileCode },
    { id: "rate-limits", label: t("rateLimits.title"), icon: Zap },
    { id: "error-codes", label: t("errorCodes.title"), icon: AlertTriangle },
  ];

  return (
    <div className="py-12 md:py-20">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Sidebar - Table of Contents */}
          <aside className="lg:w-64 shrink-0">
            <nav className="lg:sticky lg:top-24 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
                <BookOpen className="w-4 h-4" />
                <span>On this page</span>
              </div>
              <ul className="space-y-2">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Quick Start Section */}
            <section id="quick-start" className="scroll-mt-24 mb-16">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Rocket className="w-6 h-6 text-primary" />
                {t("quickStart.title")}
              </h2>
              <p className="text-muted-foreground mb-6">{t("quickStart.description")}</p>

              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mb-3">
                      {step}
                    </div>
                    <h3 className="font-semibold mb-1">
                      {t(`quickStart.step${step}Title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`quickStart.step${step}Desc`)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Authentication Section */}
            <section id="authentication" className="scroll-mt-24 mb-16">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Key className="w-6 h-6 text-primary" />
                {t("authentication.title")}
              </h2>
              <p className="text-muted-foreground mb-4">{t("authentication.description")}</p>

              <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4 font-mono text-sm overflow-x-auto">
                <code>{t("authentication.headerExample")}</code>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
                <Shield className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-muted-foreground">{t("authentication.note")}</p>
              </div>
            </section>

            {/* API Reference Section */}
            <section id="api-reference" className="scroll-mt-24 mb-16">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileCode className="w-6 h-6 text-primary" />
                {t("apiReference.title")}
              </h2>

              {/* Chat Completions Endpoint */}
              <div className="rounded-xl border border-border bg-card p-5 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 ring-1 ring-inset ring-green-500/20">
                    POST
                  </span>
                  <code className="text-sm font-mono">/v1/chat/completions</code>
                </div>
                <h3 className="font-semibold mb-1">{t("apiReference.chatCompletions.title")}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("apiReference.chatCompletions.description")}
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Parameters:</strong> {t("apiReference.chatCompletions.parameters")}
                </p>
              </div>

              {/* Models Endpoint */}
              <div className="rounded-xl border border-border bg-card p-5 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20">
                    GET
                  </span>
                  <code className="text-sm font-mono">/v1/models</code>
                </div>
                <h3 className="font-semibold mb-1">{t("apiReference.models.title")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("apiReference.models.description")}
                </p>
              </div>

              {/* Code Example Terminal */}
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs text-muted-foreground">Terminal</span>
                </div>
                <pre className="p-4 text-sm overflow-x-auto">
                  <code className="text-muted-foreground">
                    <span className="text-green-500">curl</span>{" "}
                    <span className="text-yellow-500">https://api.wuguhub.com/v1/chat/completions</span>{" "}
                    \{"\n"}
                    {"  "}-H <span className="text-blue-400">&quot;Authorization: Bearer hiai-xxx&quot;</span> \{"\n"}
                    {"  "}-H <span className="text-blue-400">&quot;Content-Type: application/json&quot;</span> \{"\n"}
                    {"  "}-d <span className="text-blue-400">&apos;{"{"}</span>{"\n"}
                    {"    "}<span className="text-blue-400">&quot;model&quot;: &quot;gpt-4o&quot;,</span>{"\n"}
                    {"    "}<span className="text-blue-400">&quot;messages&quot;: [</span>{"\n"}
                    {"      "}<span className="text-blue-400">{"{"}&quot;role&quot;: &quot;user&quot;, &quot;content&quot;: &quot;Hello!&quot;{"}"}</span>{"\n"}
                    {"    "}<span className="text-blue-400">]</span>{"\n"}
                    {"  "}<span className="text-blue-400">{"}"}&apos;</span>
                  </code>
                </pre>
              </div>
            </section>

            {/* Rate Limits Section */}
            <section id="rate-limits" className="scroll-mt-24 mb-16">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                {t("rateLimits.title")}
              </h2>
              <p className="text-muted-foreground mb-4">{t("rateLimits.description")}</p>
              <div className="rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm text-muted-foreground overflow-x-auto">
                {t("rateLimits.headers")}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                See{" "}
                <Link href="/pricing" className="text-primary hover:underline">
                  Pricing
                </Link>{" "}
                for rate limit details by plan.
              </p>
            </section>

            {/* Error Codes Section */}
            <section id="error-codes" className="scroll-mt-24">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-primary" />
                {t("errorCodes.title")}
              </h2>
              <p className="text-muted-foreground mb-6">{t("errorCodes.description")}</p>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-4 font-semibold">Status Code</th>
                      <th className="text-left p-4 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorCodes.map((code, idx) => (
                      <tr
                        key={code}
                        className={idx !== errorCodes.length - 1 ? "border-b border-border" : ""}
                      >
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              code.startsWith("4")
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20"
                            }`}
                          >
                            {code}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {t(`errorCodes.codes.${code}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
