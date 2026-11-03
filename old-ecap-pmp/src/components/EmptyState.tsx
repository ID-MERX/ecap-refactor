import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InboxIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <span className="text-emerald-500">
          {icon || <InboxIcon className="h-7 w-7" />}
        </span>
      </div>
      <h3 className="text-sm font-bold tracking-widest text-slate-600">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-slate-400">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          size="sm"
          className="mt-4 rounded-full"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
