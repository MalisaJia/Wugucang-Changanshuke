import type { ModelInfo } from "@/lib/data/models";

export function ModelCard({ model }: { model: ModelInfo }) {
  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      {/* Provider color bar */}
      <div className="h-1" style={{ backgroundColor: model.providerColor }} />

      <div className="p-5">
        {/* Header: model name + provider */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold truncate group-hover:text-primary transition-colors">
              {model.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: model.providerColor }}
              />
              <span className="text-xs text-muted-foreground truncate">
                {model.providerName}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
          {model.description}
        </p>

        {/* Footer: context window + pricing */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {model.contextWindow}
          </span>
          <span className="text-xs font-medium text-primary truncate">
            {model.pricing}
          </span>
        </div>
      </div>
    </div>
  );
}
