import { useState } from "react";
import {
  useListReports,
  useGenerateReport,
  useDeleteReport,
  useGetReport,
  getListReportsQueryKey,
  getGetReportQueryKey,
  exportReportCsv,
} from "@workspace/api-client-react";
import type { ReportSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, CalendarClock } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";

function fmtDate(d: string) {
  return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
}

function ReportDetail({ id }: { id: number }) {
  const { data: report, isLoading } = useGetReport(id, {
    query: { queryKey: getGetReportQueryKey(id) },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!report) return null;

  const d = report.data;
  const rows: Array<[string, string | number]> = [
    ["Membros (total)", d.membersTotal],
    ["Novos membros no período", d.membersNew],
    ["Convidados (total)", d.guestsTotal],
    ["Novos convidados no período", d.guestsNew],
    ["Reuniões realizadas", d.meetingsHeld],
    ["Eventos no período", d.eventsCount],
    ["Tarefas no período", d.tasksTotal],
    ["Tarefas concluídas", d.tasksDone],
    ["Discipulados (total)", d.discipleshipTotal],
    ["Discipulados ativos", d.discipleshipActive],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {d.campaigns.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Campanhas no período</p>
          {d.campaigns.map((c) => (
            <div key={c.campaignId} className="rounded-md border px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.title}</p>
                <Badge variant={c.status === "active" ? "default" : "secondary"}>
                  {c.status === "active" ? "Ativa" : "Encerrada"}
                </Badge>
              </div>
              {c.items.length > 0 ? (
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {c.items.map((item, i) => (
                    <li key={i}>
                      {item.itemName}: {item.quantity} {item.unit || "un."}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sem itens registrados</p>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Relatórios são consolidados e nunca incluem identidade de doadores ou valores financeiros.
      </p>
    </div>
  );
}

export default function Relatorios() {
  const { data: reports, isLoading } = useListReports();
  const generateReport = useGenerateReport();
  const deleteReport = useDeleteReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [genOpen, setGenOpen] = useState(false);
  const [viewing, setViewing] = useState<ReportSummary | null>(null);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });

  const handleDownloadCsv = async (r: ReportSummary) => {
    setDownloadingId(r.id);
    try {
      const csv = await exportReportCsv(r.id);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_${r.periodStart}_${r.periodEnd}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: "destructive", title: "Erro ao exportar CSV" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Relatórios"
        subtitle="Mensais e sob demanda"
        action={
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4" /> Gerar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar relatório sob demanda</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!periodStart || !periodEnd) return;
                if (periodEnd < periodStart) {
                  toast({ variant: "destructive", title: "Período inválido", description: "A data final deve ser após a inicial." });
                  return;
                }
                generateReport.mutate(
                  { data: { periodStart, periodEnd } },
                  {
                    onSuccess: () => {
                      setGenOpen(false);
                      invalidate();
                      toast({ title: "Relatório gerado" });
                    },
                    onError: () => toast({ variant: "destructive", title: "Erro ao gerar relatório" }),
                  },
                );
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="r-start">Início *</Label>
                  <Input id="r-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-end">Fim *</Label>
                  <Input id="r-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={generateReport.isPending} className="w-full sm:w-auto">
                  {generateReport.isPending ? "Gerando..." : "Gerar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="flex items-start gap-2 rounded-2xl border border-card-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground shadow-sm">
        <CalendarClock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span>
          Um relatório mensal é gerado automaticamente no início de cada mês com os dados do mês anterior.
          Você também pode gerar relatórios de qualquer período.
        </span>
      </div>

      {(reports ?? []).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhum relatório ainda. Gere um relatório ou aguarde o relatório mensal automático.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(reports ?? []).map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {fmtDate(r.periodStart)} — {fmtDate(r.periodEnd)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerado em {fmtDate(r.createdAt.slice(0, 10))}
                    {r.createdByName ? ` por ${r.createdByName}` : " automaticamente"}
                  </p>
                </div>
                <Badge variant={r.type === "monthly" ? "default" : "outline"}>
                  {r.type === "monthly" ? "Mensal" : "Sob demanda"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewing(r)}>
                Ver detalhes
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownloadCsv(r)} disabled={downloadingId === r.id}>
                <Download className="h-4 w-4 mr-2" />
                {downloadingId === r.id ? "Exportando..." : "CSV"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O relatório de {fmtDate(r.periodStart)} a {fmtDate(r.periodEnd)} será removido.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        deleteReport.mutate(
                          { id: r.id },
                          {
                            onSuccess: () => {
                              invalidate();
                              toast({ title: "Relatório excluído" });
                            },
                          },
                        )
                      }
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Relatório {viewing ? `${fmtDate(viewing.periodStart)} — ${fmtDate(viewing.periodEnd)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {viewing && <ReportDetail id={viewing.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
