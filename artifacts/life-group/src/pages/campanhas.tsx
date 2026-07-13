import { useState } from "react";
import {
  useListCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useCloseCampaign,
  useDeleteCampaign,
  useListCampaignItems,
  useAddCampaignItem,
  useDeleteCampaignItem,
  getListCampaignsQueryKey,
  getListCampaignItemsQueryKey,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import type { Campaign, CampaignInputType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { QRCodeSVG } from "qrcode.react";
import {
  Plus,
  ExternalLink,
  QrCode,
  Package,
  Trash2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";

const TYPE_LABELS: Record<string, string> = {
  money: "Financeira",
  items: "Itens",
  both: "Financeira + Itens",
};

function fmtDate(d: string) {
  return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR });
}

function CampaignForm({
  initial,
  onSubmit,
  isPending,
  submitLabel,
}: {
  initial?: Campaign;
  onSubmit: (data: {
    title: string;
    description?: string;
    type: CampaignInputType;
    startDate: string;
    endDate?: string;
    externalLink?: string;
  }) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<CampaignInputType>(initial?.type ?? "money");
  const [startDate, setStartDate] = useState(initial?.startDate ?? format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [externalLink, setExternalLink] = useState(initial?.externalLink ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !startDate) return;
        onSubmit({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startDate,
          endDate: endDate || undefined,
          externalLink: externalLink.trim() || undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="c-title">Título *</Label>
        <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Campanha do Agasalho" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-desc">Descrição</Label>
        <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Objetivo da campanha..." rows={3} />
      </div>
      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select value={type} onValueChange={(v) => setType(v as CampaignInputType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="money">Financeira</SelectItem>
            <SelectItem value="items">Arrecadação de itens</SelectItem>
            <SelectItem value="both">Financeira + Itens</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="c-start">Início *</Label>
          <Input id="c-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-end">Término</Label>
          <Input id="c-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      {(type === "money" || type === "both") && (
        <div className="space-y-2">
          <Label htmlFor="c-link">Link do ministério (doações)</Label>
          <Input id="c-link" type="url" value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="https://..." />
          <p className="text-xs text-muted-foreground">
            Contribuições financeiras são feitas diretamente no site do ministério. O app nunca registra valores nem quem doou.
          </p>
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CampaignItems({ campaign, canManage }: { campaign: Campaign; canManage: boolean }) {
  const { data: items, isLoading } = useListCampaignItems(campaign.id, {
    query: { queryKey: getListCampaignItemsQueryKey(campaign.id) },
  });
  const addItem = useAddCampaignItem();
  const deleteItem = useDeleteCampaignItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCampaignItemsQueryKey(campaign.id) });
    queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3">
      {(items ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum item registrado ainda.</p>
      )}
      {(items ?? []).map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{item.itemName}</span>
            <span className="text-muted-foreground">
              {item.quantity} {item.unit || "un."}
            </span>
          </div>
          {canManage && campaign.status === "active" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                deleteItem.mutate(
                  { id: campaign.id, itemId: item.id },
                  { onSuccess: invalidate },
                )
              }
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      {canManage && campaign.status === "active" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const qty = parseInt(quantity, 10);
            if (!itemName.trim() || !qty || qty < 1) return;
            addItem.mutate(
              { id: campaign.id, data: { itemName: itemName.trim(), quantity: qty, unit: unit.trim() || undefined } },
              {
                onSuccess: () => {
                  setItemName("");
                  setQuantity("1");
                  setUnit("");
                  invalidate();
                  toast({ title: "Item registrado" });
                },
                onError: () => toast({ variant: "destructive", title: "Erro ao registrar item" }),
              },
            );
          }}
        >
          <div className="flex-1 min-w-[120px] space-y-1">
            <Label className="text-xs">Item</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex.: Cobertor" />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Qtd.</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs">Unidade</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un., kg" />
          </div>
          <Button type="submit" size="sm" disabled={addItem.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export default function Campanhas() {
  const { data: user } = useGetCurrentUser();
  const { data: campaigns, isLoading } = useListCampaigns();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const closeCampaign = useCloseCampaign();
  const deleteCampaign = useDeleteCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [qrCampaign, setQrCampaign] = useState<Campaign | null>(null);

  const canManage = user?.role === "leader" || user?.role === "auxiliary";
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const active = (campaigns ?? []).filter((c) => c.status === "active");
  const closed = (campaigns ?? []).filter((c) => c.status === "closed");

  const renderCampaign = (c: Campaign) => (
    <Card key={c.id} className={c.status === "closed" ? "opacity-70" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{c.title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {fmtDate(c.startDate)}
              {c.endDate ? ` — ${fmtDate(c.endDate)}` : ""}
              {c.createdByName ? ` · por ${c.createdByName}` : ""}
            </p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            <Badge variant="outline">{TYPE_LABELS[c.type]}</Badge>
            <Badge variant={c.status === "active" ? "default" : "secondary"}>
              {c.status === "active" ? "Ativa" : "Encerrada"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}

        {c.externalLink && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={c.externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Doar pelo site do ministério
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQrCampaign(c)}>
              <QrCode className="h-4 w-4 mr-2" /> QR Code
            </Button>
          </div>
        )}

        {(c.type === "items" || c.type === "both") && (
          <div>
            <p className="text-sm font-medium mb-2">Itens arrecadados (total, sem identificação)</p>
            <CampaignItems campaign={c} canManage={!!canManage} />
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {c.status === "active" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    closeCampaign.mutate(
                      { id: c.id },
                      {
                        onSuccess: () => {
                          invalidate();
                          toast({ title: "Campanha encerrada" });
                        },
                      },
                    )
                  }
                >
                  <Lock className="h-4 w-4 mr-2" /> Encerrar
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A campanha "{c.title}" e seus registros de itens serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteCampaign.mutate(
                        { id: c.id },
                        {
                          onSuccess: () => {
                            invalidate();
                            toast({ title: "Campanha excluída" });
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
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Campanhas"
        subtitle="Doações e arrecadações"
        action={canManage ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
              <CampaignForm
                isPending={createCampaign.isPending}
                submitLabel="Criar campanha"
                onSubmit={(data) =>
                  createCampaign.mutate(
                    { data },
                    {
                      onSuccess: () => {
                        setCreateOpen(false);
                        invalidate();
                        toast({ title: "Campanha criada" });
                      },
                      onError: () => toast({ variant: "destructive", title: "Erro ao criar campanha" }),
                    },
                  )
                }
              />
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="flex items-start gap-2 rounded-2xl border border-card-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground shadow-sm">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span>
          Privacidade garantida: o app nunca registra quem doou nem valores individuais. Doações financeiras
          acontecem apenas no site do ministério; itens são registrados apenas como totais.
        </span>
      </div>

      {active.length === 0 && closed.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhuma campanha por enquanto.
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ativas</h2>
          {active.map(renderCampaign)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Encerradas</h2>
          {closed.map(renderCampaign)}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Campanha</DialogTitle></DialogHeader>
          {editing && (
            <CampaignForm
              initial={editing}
              isPending={updateCampaign.isPending}
              submitLabel="Salvar alterações"
              onSubmit={(data) =>
                updateCampaign.mutate(
                  { id: editing.id, data },
                  {
                    onSuccess: () => {
                      setEditing(null);
                      invalidate();
                      toast({ title: "Campanha atualizada" });
                    },
                    onError: () => toast({ variant: "destructive", title: "Erro ao atualizar" }),
                  },
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrCampaign} onOpenChange={(open) => !open && setQrCampaign(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{qrCampaign?.title}</DialogTitle></DialogHeader>
          {qrCampaign?.externalLink && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={qrCampaign.externalLink} size={200} />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">{qrCampaign.externalLink}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
