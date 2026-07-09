import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function NeuCard({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("neu-raised rounded-3xl p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function NeuInset({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("neu-pressed rounded-3xl", className)} {...rest}>
      {children}
    </div>
  );
}

type NeuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  active?: boolean;
};

export function NeuButton({
  className,
  variant = "default",
  size = "md",
  active = false,
  children,
  ...rest
}: NeuButtonProps) {
  const sizeCls =
    size === "icon"
      ? "h-12 w-12"
      : size === "sm"
        ? "h-9 px-4 text-sm"
        : size === "lg"
          ? "h-14 px-7 text-base"
          : "h-11 px-5 text-sm";

  const base = active ? "neu-pressed-sm" : "neu-raised-sm";

  const tone =
    variant === "primary"
      ? "text-[color:var(--emerald)] font-semibold"
      : variant === "ghost"
        ? "bg-transparent shadow-none text-muted-foreground hover:text-foreground"
        : "text-foreground";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-150 select-none",
        "active:neu-pressed-sm active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant !== "ghost" && base,
        tone,
        sizeCls,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function NeuToggle({
  checked,
  onToggle,
  children,
  className,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={label}
      className={cn(
        "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-200",
        checked ? "neu-pressed text-[color:var(--emerald)]" : "neu-raised-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
