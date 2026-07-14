import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  useGetRegistro,
  getGetRegistroQueryKey,
  getListRegistrosQueryKey,
  useUpdateRegistro,
  useDeleteRegistro,
  useApproveRegistro,
  useListMembers,
  useListPhotos,
  useListCampaigns,
} from "@workspace/api-client-react";
import {
  CheckCircle2,
  ExternalLink,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MemberAvatar } from "@/components/people/member-avatar";
import {
  LeadershipOnly,
  SectionCard,
  StatusBadge,
  apiErrorMessage,
  formatEventDate,
} from "@/components/registros/registro-common";
import {
  RegistroFormSections,
  buildRegistroUpdate,
  registroFormFromDetail,
  type RegistroFormValue,
} from "@/components/registros/registro-form";

function RegistroDetailContent() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const validId = Number.isInteger(id) && id > 0;

  const { data: user } = useGetCurrentUser();
  const isLeader = user?.role === "leader";

  const {
    data: registro,
    isLoading,
    error,
  } = useGetRegistro(id, {
    query: { enabled: validId, queryKey: getGetRegistroQueryKey(id) },
  });
  const { data: people } = useListMembers();
  const { data: photos } = useListPhotos();
  const { data: campaigns } = useListCampaigns();

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [formValue, setFormValue] = useState<RegistroFormValue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateRegistro = useUpdateRegistro();
  const deleteRegistro = useDeleteRegistro();
  const approveRegistro = useApproveRegistro();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetRegistroQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListRegistrosQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="space-y-5 px-5 pt-6">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!validId || error || !registro) {
    return (
      <div className="space-y-5 px-5 pt-6">
        <PageHeader title="Registro" backHref="/registros" />
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Registro não encontrado.
        </div>
      </div>
    );
  }

  const avatarByUserId = new Map(
    (people ?? []).map((p) => [p.id, p.avatarPath] as const),
  );
  const albumPhotos = registro.album
    ? (photos ?? []).filter((p) => p.albumId === registro.album!.id)
    : [];
  const uploadPhoto = albumPhotos.find((p) => p.sourceType === "upload");
  const drivePhoto = albumPhotos.find((p) => p.sourceType === "drive");
  const activeCampaign = (campaigns ?? []).find((c) => c.status === "active");

  const startEditing = () => {
    setFormValue(registroFormFromDetail(registro));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFormValue(null);
  };

  const handleSave = () => {
    if (!formValue) return;
    const wasPublished = registro.status === "published";
    updateRegistro.mutate(
      { id, data: buildRegistroUpdate(formValue) },
      {
        onSuccess: (updated) => {
          invalidate();
          setEditing(false);
          setFormValue(null);
          if (user?.role === "auxiliary" && wasPublished && updated.status === "pending") {
            toast({
              title: "Registro atualizado",
              description:
                "Como a edição foi feita por auxiliar, o registro voltou a ficar pendente de aprovação do líder.",
            });
          } else {
            toast({ title: "Registro atualizado" });
          }
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  const handleApprove = () => {
    approveRegistro.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Registro aprovado e publicado" });
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao aprovar",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  const handleDelete = () => {
    deleteRegistro.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRegistrosQueryKey() });
          toast({ title: "Registro excluído" });
          navigate("/registros");
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao excluir",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  return (
    <div className="space-y-5 px-5 pt-6">
      <PageHeader
        title={`Life Group ${registro.seq}`}
        subtitle={formatEventDate(registro.eventDate)}
        backHref="/registros"
        action={<StatusBadge status={registro.status} />}
      />

      {registro.status === "pending" && isLeader && !editing && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <p className="flex-1 text-sm text-amber-900 dark:text-amber-200">
            Este registro aguarda a sua aprovação.
          </p>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleApprove}
            disabled={approveRegistro.isPending}
          >
            <CheckCircle2 className="h-4 w-4" /> Aprovar registro
          </Button>
        </div>
      )}

      {editing && formValue ? (
        <>
          <RegistroFormSections value={formValue} onChange={setFormValue} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={cancelEditing}
              disabled={updateRegistro.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={updateRegistro.isPending}
            >
              {updateRegistro.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            {isLeader && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            )}
          </div>

          {/* Presença */}
          <SectionCard
            title="Presença"
            badge={
              registro.presentes.length === 1
                ? "1 presente"
                : `${registro.presentes.length} presentes`
            }
          >
            {registro.presentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma presença registrada.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {registro.presentes.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 py-2">
                    <MemberAvatar
                      name={p.name}
                      avatarPath={avatarByUserId.get(p.userId)}
                      className="h-9 w-9 text-xs"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    {p.status === "guest" && (
                      <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-primary">
                        Convidado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Atividades */}
          <SectionCard title="Atividades">
            {registro.atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {registro.atividades.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{a.name}</p>
                      {a.responsavelName && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Responsável: {a.responsavelName}
                        </p>
                      )}
                    </div>
                    {a.durationMin !== null && (
                      <span className="shrink-0 text-xs font-bold text-primary">
                        {a.durationMin} min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Foto do dia */}
          {registro.album && (
            <SectionCard title="Foto do dia" subtitle={registro.album.title}>
              {uploadPhoto ? (
                <img
                  src={uploadPhoto.url}
                  alt="Foto do encontro"
                  className="max-h-72 w-full rounded-xl border border-border object-cover"
                />
              ) : drivePhoto || registro.album.driveUrl ? (
                <a
                  href={drivePhoto?.externalUrl ?? drivePhoto?.url ?? registro.album.driveUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    Ver foto no Google Drive
                  </span>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">O álbum ainda não tem fotos.</p>
              )}
            </SectionCard>
          )}

          {/* Arrecadação */}
          {registro.arrecadacao.length > 0 && (
            <SectionCard
              title="Arrecadação"
              subtitle={activeCampaign ? `Campanha: ${activeCampaign.title}` : undefined}
            >
              <div className="divide-y divide-border/60">
                {registro.arrecadacao.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {item.itemName}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">
                      {item.quantity} un.
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Observações */}
          {registro.notes && (
            <SectionCard title="Observações">
              <p className="whitespace-pre-wrap text-sm text-foreground">{registro.notes}</p>
            </SectionCard>
          )}

          <p className="px-1 text-xs text-muted-foreground">
            {registro.createdByName && <>Criado por {registro.createdByName}</>}
            {registro.createdByName && registro.approvedByName && <> · </>}
            {registro.approvedByName && <>Aprovado por {registro.approvedByName}</>}
          </p>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro Life Group {registro.seq} e suas presenças, atividades e itens de
              arrecadação serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRegistro.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function RegistroDetail() {
  return (
    <LeadershipOnly title="Registro">
      <RegistroDetailContent />
    </LeadershipOnly>
  );
}
