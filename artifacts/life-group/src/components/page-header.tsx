import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export function PageHeader({
  title,
  subtitle,
  backHref = "/perfil",
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={backHref}
        aria-label="Voltar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border bg-card text-foreground shadow-sm"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-serif text-xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
