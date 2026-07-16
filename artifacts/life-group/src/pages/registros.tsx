import { Link } from "wouter";
import { ClipboardList, Plus } from "lucide-react";
import { useListRegistros } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LeadershipOnly,
  StatusBadge,
  formatEventDate,
} from "@/components/registros/registro-common";

function RegistrosContent() {
  const { data: registros, isLoading } = useListRegistros();

  return (
    <div className="space-y-5 px-5 pt-6">
      <PageHeader
        title="Registros"
        subtitle="Registros dos encontros"
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/registros/novo">
              <Plus className="h-4 w-4" /> Novo registro
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (registros ?? []).length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">Nenhum registro ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Depois de cada encontro do Life Group, registre aqui a presença, as atividades
            e os demais detalhes.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {(registros ?? []).map((r) => (
            <Link
              key={r.id}
              href={`/registros/${r.id}`}
              className="block rounded-2xl border border-card-border bg-card p-4 shadow-sm transition-colors active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-serif text-base font-extrabold tracking-tight text-foreground">
                    Life Group {r.seq}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatEventDate(r.eventDate)}
                  </p>
                </div>
                <StatusBadge status={r.status} className="mt-0.5 shrink-0" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {r.presentCount === 1 ? "1 presente" : `${r.presentCount} presentes`}
                </span>
                {r.createdByName && <> · por {r.createdByName}</>}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Registros() {
  return (
    <LeadershipOnly title="Registros">
      <RegistrosContent />
    </LeadershipOnly>
  );
}
