import { useTranslations } from "next-intl";

const providers = [
  { name: "OpenAI", color: "#10A37F" },
  { name: "Anthropic", color: "#D4A574" },
  { name: "Google", color: "#4285F4" },
  { name: "Qwen", color: "#6236FF" },
  { name: "Zhipu AI", color: "#2563EB" },
  { name: "MiniMax", color: "#FF6B35" },
  { name: "Moonshot", color: "#1A1A2E" },
  { name: "Ollama", color: "#FFFFFF" },
];

export function ProvidersSection() {
  const t = useTranslations("providers");

  return (
    <section className="py-16 md:py-20 bg-muted/30 border-y border-border">
      <div className="container text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
          {t("subtitle")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: provider.color }}
              />
              <span className="text-sm font-medium">{provider.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
