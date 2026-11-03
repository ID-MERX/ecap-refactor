import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TitleProps = {
  children: ReactNode;
  className?: string;
};

const Title = ({ children, className }: TitleProps) => {
  return (
    <h2
      className={cn(
        "text-xs font-semibold tracking-[0.3em] text-slate-500",
        className,
      )}
    >
      {children}
    </h2>
  );
};

export default Title;
