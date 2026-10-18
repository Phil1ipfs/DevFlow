import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props that connect a control to its label, hint and error message. */
export type FieldControlProps = {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type FormFieldProps = {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Rendered next to the label, e.g. a "Forgot password?" link. */
  labelAside?: ReactNode;
  className?: string;
  /**
   * Either a single input-like element (it receives the control props by cloning), or a function
   * that receives them. Use the function form when the control is wrapped, e.g. in React Hook
   * Form's <Controller>, which would otherwise swallow the props.
   */
  children: ReactElement<Record<string, unknown>> | ((control: FieldControlProps) => ReactNode);
};

/** Label + control + hint/error, wired together for screen readers. */
export function FormField({ id, label, error, hint, labelAside, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {typeof children === "function" ? children(control) : isValidElement(children) ? cloneElement(children, control) : children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
