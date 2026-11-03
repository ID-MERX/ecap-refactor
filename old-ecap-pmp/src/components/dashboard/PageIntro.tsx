import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageIntroProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

const PageIntro = ({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageIntroProps) => {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && (
          <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground/80">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl font-medium">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
};

export default PageIntro;
