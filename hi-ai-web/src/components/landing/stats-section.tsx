import { useTranslations } from "next-intl";

export function StatsSection() {
  const t = useTranslations("stats");

  const stats = [
    { value: t("models"), label: t("modelsLabel") },
    { value: t("providers"), label: t("providersLabel") },
    { value: t("routingModes"), label: t("routingModesLabel") },
    { value: t("uptime"), label: t("uptimeLabel") },
  ];

  return (
    <section className="py-16 border-y border-border bg-muted/30">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-primary">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
