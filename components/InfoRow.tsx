import { cn } from "@/lib/utils";

type InfoRowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  longAnswer?: boolean;
};

const InfoRow = ({
  label,
  value,
  className,
  icon,
  longAnswer,
}: InfoRowProps) => {
  const isTextContent = typeof value === "string" || typeof value === "number";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl px-2.5 py-3.5 transition-colors hover:bg-foreground/[0.04] sm:gap-4",
        longAnswer
          ? ""
          : "sm:flex-row sm:items-center sm:justify-between md:gap-8",
      )}
    >
      <div
        className={`flex items-center gap-3 ${longAnswer ? "" : "sm:w-1/2"}`}
      >
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      {isTextContent ? (
        <p
          className={cn(
            "text-sm font-medium",
            className,
            longAnswer
              ? "whitespace-pre-line rounded-2xl bg-muted/60 px-5 py-4 text-base font-normal leading-relaxed md:text-lg"
              : "break-all sm:w-1/2 sm:break-normal sm:text-right",
          )}
        >
          {value}
        </p>
      ) : (
        <div
          className={cn(
            longAnswer
              ? "rounded-2xl bg-muted/60 px-5 py-4 text-base leading-relaxed md:text-lg"
              : "break-all text-sm font-medium sm:w-1/2 sm:break-normal sm:text-right",
            className,
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
};

export default InfoRow;
