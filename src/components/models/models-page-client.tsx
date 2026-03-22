"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { models, providers } from "@/lib/data/models";
import { ModelCard } from "./model-card";
import { ProviderFilter } from "./provider-filter";

export function ModelsPageClient() {
  const t = useTranslations("models");
  const [search, setSearch] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set()
  );

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // Provider filter
      if (selectedProviders.size > 0 && !selectedProviders.has(model.provider)) {
        return false;
      }
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return (
          model.name.toLowerCase().includes(q) ||
          model.id.toLowerCase().includes(q) ||
          model.providerName.toLowerCase().includes(q) ||
          model.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, selectedProviders]);

  return (
    <div className="container py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-6">
            <ProviderFilter
              providers={providers}
              selected={selectedProviders}
              onToggle={toggleProvider}
              allLabel={t("allProviders")}
              title={t("providers")}
            />

            {selectedProviders.size > 0 && (
              <button
                onClick={() => setSelectedProviders(new Set())}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {t("clearFilters")}
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search bar + count */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredModels.length} {t("modelsCount")}
            </span>
          </div>

          {/* Mobile provider filter pills */}
          <div className="lg:hidden flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedProviders(new Set())}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                selectedProviders.size === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {t("allProviders")}
            </button>
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProvider(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  selectedProviders.has(p.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </button>
            ))}
          </div>

          {/* Model grid */}
          {filteredModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredModels.map((model) => (
                <ModelCard key={model.id} model={model} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              {t("noResults")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
