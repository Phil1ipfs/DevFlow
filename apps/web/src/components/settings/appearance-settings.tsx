"use client";

import { THEME_OPTIONS } from "@/components/theme/theme-toggle";
import { type Theme, useTheme } from "@/components/theme/theme-store";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <RadioGroup
      aria-label="Theme"
      value={theme}
      onValueChange={(value) => setTheme(value as Theme)}
      className="grid gap-3 sm:grid-cols-3"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <label
          key={value}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/50",
            "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-brand-soft/50",
          )}
        >
          <RadioGroupItem value={value} />
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
