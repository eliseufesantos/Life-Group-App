import { Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Data do encontro formatada em pt-BR (ex.: "12 de maio de 2026"). */
export function formatEventDate(date: string): string {
  try {
    return format(parseISO(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

/** Extrai a mensagem de erro da API ({ error }) com fallback amigável. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown } } | null | undefined)?.data;
  const msg = data && typeof data.error === "string" ? data.error : undefined;
  return msg ?? fallback;
}

/** Badge de status do registro: Publicado (primário) ou Pendente (âmbar). */
export function StatusBadge({
  status,
  className,
}: {
  status: "pending" | "published";
  className?: string;
}) {
  if (status === "published") {
    return (
      <span
        className={cn(
          "rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground",
          className,
        )}
      >
        Publicado
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        className,
      )}
    >
      Pendente
    </span>
  );
}

/** Card de seção padrão das telas de registro. */
export function SectionCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-card-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-serif text-base font-extrabold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {badge && (
          <span className="mt-0.5 shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Guard de acesso das páginas de registros: enquanto o papel carrega mostra
 * skeleton; para quem não é líder/auxiliar renderiza um estado vazio
 * (a API já responde 403 — as queries internas nem chegam a montar).
 */
export function LeadershipOnly({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-5 px-5 pt-6">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const allowed = user?.role === "leader" || user?.role === "auxiliary";
  if (!allowed) {
    return (
      <div className="space-y-5 px-5 pt-6">
        <PageHeader title={title} />
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <Lock className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">Acesso restrito à liderança</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Somente líderes e auxiliares do Life Group podem acessar os registros de encontro.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
