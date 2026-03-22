import type { ProviderInfo } from "@/lib/data/models";

interface ProviderFilterProps {
  providers: ProviderInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  allLabel: string;
  title: string;
}

export function ProviderFilter({
  providers,
  selected,
  onToggle,
  allLabel,
  title,
}: ProviderFilterProps) {
  const allSelected = selected.size === 0;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-1.5">
        {/* All providers button */}
        <button
          onClick={() => {
            // Clear all selections (meaning "all")
            providers.forEach((p) => {
              if (selected.has(p.id)) onToggle(p.id);
            });
          }}
          className={`flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            allSelected
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {allLabel}
        </button>

        {/* Individual providers */}
        {providers.map((provider) => {
          const isSelected = selected.has(provider.id);
          return (
            <button
              key={provider.id}
              onClick={() => onToggle(provider.id)}
              className={`flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: provider.color }}
              />
              <span className="truncate">{provider.name}</span>
              <span className="ml-auto text-xs opacity-60">
                {provider.modelCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
