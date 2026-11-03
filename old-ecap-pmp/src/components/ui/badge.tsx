import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        "status-active":
          "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
        "status-warning":
          "border-amber-200 bg-amber-50 text-amber-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
        "status-danger":
          "border-red-200 bg-red-50 text-red-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

const statusDotColors = {
  "status-active": "bg-emerald-500",
  "status-warning": "bg-amber-500",
  "status-danger": "bg-red-500",
} as const;

type StatusVariant = "status-active" | "status-warning" | "status-danger";

function StatusBadge({
  variant,
  className,
  children,
  ...props
}: BadgeProps & { variant: StatusVariant }) {
  return (
    <Badge variant={variant} className={cn("gap-1.5", className)} {...props}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", statusDotColors[variant])}
      />
      {children}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusBadge };
