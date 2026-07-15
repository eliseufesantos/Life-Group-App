import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMembers,
  useListRegistroActivities,
  getListRegistroActivitiesQueryKey,
  useCreateRegistroActivity,
  useDeleteRegistroActivity,
  useListCampaigns,
  useListPhotos,
  getListPhotosQueryKey,
  getListAlbumsQueryKey,
  useCreateAlbum,
  useCreatePhoto,
  useDeletePhoto,
  useRequestUploadUrl,
  useListCalendarEvents,
  getListCalendarEventsQueryKey,
} from "@workspace/api-client-react";
import type {
  Member,
  RegistroActivity,
  RegistroDetail,
  RegistroInput,
  RegistroUpdate,
} from "@workspace/api-client-react";
import {
  Check,
  ExternalLink,
  ImagePlus,
  Link2,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/components/people/member-avatar";
import {
  SectionCard,
  apiErrorMessage,
  formatEventDate,
} from "@/components/registros/registro-common";

// ---------------------------------------------------------------------------
// Valor do formulário (compartilhado entre criação e edição inline)
// ---------------------------------------------------------------------------

export interface AtividadeSelecionada {
  /** Id no catálogo; ausente para entradas cujo item de catálogo foi removido */
  atividadeId?: number;
  name: string;
  responsavelId?: number;
  durationMin?: number;
}

export interface NovoConvidado {
  name: string;
  phone: string;
}

export interface ArrecadacaoLinha {
  item: string;
  quantity: string;
}

export interface RegistroAlbumRef {
  id: number;
  title: string;
  driveUrl: string | null;
}

/**
 * Foto anexada mas ainda não persistida — usada no fluxo de criação, onde o
 * álbum/foto só são gravados depois que o registro existe (evita álbum/foto
 * órfãos no mural quando a criação é cancelada ou falha).
 */
export type PendingPhoto =
  | { kind: "upload"; objectPath: string }
  | { kind: "drive"; externalUrl: string };

export interface RegistroFormValue {
  eventDate: string;
  /** Ids de membros e convidados existentes marcados como presentes */
  presentes: number[];
  novosConvidados: NovoConvidado[];
  atividades: AtividadeSelecionada[];
  album: RegistroAlbumRef | null;
  /** Foto anexada aguardando persistência junto com o salvamento (criação). */
  pendingPhoto: PendingPhoto | null;
  arrecadacao: ArrecadacaoLinha[];
  notes: string;
}

export function emptyRegistroForm(eventDate?: string): RegistroFormValue {
  return {
    eventDate: eventDate ?? format(new Date(), "yyyy-MM-dd"),
    presentes: [],
    novosConvidados: [],
    atividades: [],
    album: null,
    pendingPhoto: null,
    arrecadacao: [],
    notes: "",
  };
}

export function registroFormFromDetail(detail: RegistroDetail): RegistroFormValue {
  return {
    eventDate: detail.eventDate,
    presentes: detail.presentes.map((p) => p.userId),
    novosConvidados: [],
    atividades: detail.atividades.map((a) => ({
      atividadeId: a.atividadeId ?? undefined,
      name: a.name,
      responsavelId: a.responsavelId ?? undefined,
      durationMin: a.durationMin ?? undefined,
    })),
    album: detail.album,
    pendingPhoto: null,
    arrecadacao: detail.arrecadacao.map((i) => ({
      item: i.itemName,
      quantity: String(i.quantity),
    })),
    notes: detail.notes ?? "",
  };
}

function atividadesPayload(v: RegistroFormValue) {
  return v.atividades.map((a) => ({
    ...(a.atividadeId !== undefined ? { atividadeId: a.atividadeId } : {}),
    name: a.name,
    ...(a.responsavelId !== undefined ? { responsavelId: a.responsavelId } : {}),
    ...(a.durationMin !== undefined && a.durationMin >= 1
      ? { durationMin: a.durationMin }
      : {}),
  }));
}

function novosConvidadosPayload(v: RegistroFormValue) {
  return v.novosConvidados
    .map((g) => ({
      name: g.name.trim(),
      ...(g.phone.trim() ? { phone: g.phone.trim() } : {}),
    }))
    .filter((g) => g.name.length > 0);
}

function arrecadacaoPayload(v: RegistroFormValue) {
  return v.arrecadacao
    .map((l) => ({ item: l.item.trim(), quantity: parseInt(l.quantity, 10) }))
    .filter((l) => l.item.length > 0 && Number.isFinite(l.quantity) && l.quantity >= 1);
}

export function buildRegistroInput(v: RegistroFormValue): RegistroInput {
  const novos = novosConvidadosPayload(v);
  const arrecadacao = arrecadacaoPayload(v);
  return {
    eventDate: v.eventDate,
    presentes: v.presentes,
    ...(novos.length > 0 ? { novosConvidados: novos } : {}),
    atividades: atividadesPayload(v),
    ...(v.album ? { albumId: v.album.id } : {}),
    ...(arrecadacao.length > 0 ? { arrecadacao } : {}),
    ...(v.notes.trim() ? { notes: v.notes.trim() } : {}),
  };
}

/**
 * Persiste a foto pendente DEPOIS que o registro já existe: cria o álbum
 * "Encontro {data}" e a foto (upload ou link do Drive) e retorna o id do
 * álbum, para o chamador vinculá-lo ao registro. Como roda após a criação do
 * registro, um cancelamento/falha na criação nunca deixa álbum/foto órfãos.
 */
export async function persistPendingPhoto(opts: {
  pending: PendingPhoto;
  eventDate: string;
  createAlbumAsync: (args: {
    data: { title: string; eventId?: number; driveUrl?: string };
  }) => Promise<{ id: number }>;
  createPhotoAsync: (args: {
    data: {
      objectPath?: string;
      sourceType?: "upload" | "drive";
      externalUrl?: string;
      albumId?: number;
    };
  }) => Promise<unknown>;
}): Promise<number> {
  const album = await opts.createAlbumAsync({
    data: { title: `Encontro ${formatEventDate(opts.eventDate)}` },
  });
  if (opts.pending.kind === "upload") {
    await opts.createPhotoAsync({
      data: { objectPath: opts.pending.objectPath, albumId: album.id },
    });
  } else {
    await opts.createPhotoAsync({
      data: {
        sourceType: "drive",
        externalUrl: opts.pending.externalUrl,
        albumId: album.id,
      },
    });
  }
  return album.id;
}

/** PATCH: arrays completos — o backend substitui as listas enviadas. */
export function buildRegistroUpdate(v: RegistroFormValue): RegistroUpdate {
  const novos = novosConvidadosPayload(v);
  return {
    eventDate: v.eventDate,
    presentes: v.presentes,
    ...(novos.length > 0 ? { novosConvidados: novos } : {}),
    atividades: atividadesPayload(v),
    albumId: v.album ? v.album.id : null,
    arrecadacao: arrecadacaoPayload(v),
    notes: v.notes.trim() ? v.notes.trim() : null,
  };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const uploaderButtonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground border border-primary-border min-h-8 px-3 text-xs";

function PersonToggleRow({
  person,
  checked,
  onToggle,
}: {
  person: Member;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors active:bg-muted/60"
    >
      <MemberAvatar name={person.name} avatarPath={person.avatarPath} className="h-9 w-9 text-xs" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {person.name}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-transparent",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
    </button>
  );
}

/**
 * Seções editáveis do registro de encontro. Usadas tanto na criação quanto
 * na edição inline do detalhe (mesmos controles, na própria tela).
 */
export function RegistroFormSections({
  value,
  onChange,
  deferPhotoPersistence = false,
}: {
  value: RegistroFormValue;
  onChange: (next: RegistroFormValue) => void;
  /**
   * Na criação, a foto do dia é guardada como pendente e persistida pelo
   * chamador após o registro existir (via {@link persistPendingPhoto}), em vez
   * de criar álbum/foto imediatamente.
   */
  deferPhotoPersistence?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const patch = (p: Partial<RegistroFormValue>) => onChange({ ...value, ...p });

  // --- Dados ---
  const { data: people, isLoading: isLoadingPeople } = useListMembers();
  const members = useMemo(
    () => (people ?? []).filter((p) => p.status === "member" && p.active),
    [people],
  );
  const guests = useMemo(
    () => (people ?? []).filter((p) => p.status === "guest" && p.active),
    [people],
  );

  const { data: catalogo, isLoading: isLoadingCatalogo } = useListRegistroActivities();
  const { data: campaigns } = useListCampaigns();
  const activeCampaign = (campaigns ?? []).find((c) => c.status === "active");

  const { data: photos } = useListPhotos();
  const albumPhotos = value.album
    ? (photos ?? []).filter((p) => p.albumId === value.album!.id)
    : [];
  const attachedPhoto = albumPhotos[0];

  const validDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.eventDate);
  const eventsRange = { from: value.eventDate, to: value.eventDate };
  const { data: dayEvents } = useListCalendarEvents(eventsRange, {
    query: {
      queryKey: getListCalendarEventsQueryKey(eventsRange),
      enabled: validDate,
    },
  });

  const createActivity = useCreateRegistroActivity();
  const deleteActivity = useDeleteRegistroActivity();
  const createAlbum = useCreateAlbum();
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();
  const requestUploadUrl = useRequestUploadUrl();

  // --- Presença ---
  const presentesSet = new Set(value.presentes);
  const togglePresente = (id: number) =>
    patch({
      presentes: presentesSet.has(id)
        ? value.presentes.filter((p) => p !== id)
        : [...value.presentes, id],
    });
  const membersSelected = members.filter((m) => presentesSet.has(m.id)).length;
  const guestsSelected =
    guests.filter((g) => presentesSet.has(g.id)).length + value.novosConvidados.length;

  // --- Convidados novos ---
  const [addingGuest, setAddingGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const confirmNewGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    patch({
      novosConvidados: [...value.novosConvidados, { name, phone: guestPhone.trim() }],
    });
    setGuestName("");
    setGuestPhone("");
    setAddingGuest(false);
  };

  // --- Atividades ---
  const catalogIds = new Set((catalogo ?? []).map((c) => c.id));
  const orphanAtividades = (catalogo ?? []).length
    ? value.atividades
        .map((a, index) => ({ a, index }))
        .filter(({ a }) => a.atividadeId === undefined || !catalogIds.has(a.atividadeId))
    : [];

  const toggleAtividade = (cat: RegistroActivity) => {
    const selected = value.atividades.some((a) => a.atividadeId === cat.id);
    patch({
      atividades: selected
        ? value.atividades.filter((a) => a.atividadeId !== cat.id)
        : [...value.atividades, { atividadeId: cat.id, name: cat.name }],
    });
  };

  const updateAtividadeAt = (index: number, p: Partial<AtividadeSelecionada>) =>
    patch({
      atividades: value.atividades.map((a, i) => (i === index ? { ...a, ...p } : a)),
    });

  const removeAtividadeAt = (index: number) =>
    patch({ atividades: value.atividades.filter((_, i) => i !== index) });

  const [newActivityName, setNewActivityName] = useState("");
  const invalidateCatalogo = () =>
    queryClient.invalidateQueries({ queryKey: getListRegistroActivitiesQueryKey() });

  const handleCreateActivity = () => {
    const name = newActivityName.trim();
    if (!name) return;
    createActivity.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          invalidateCatalogo();
          setNewActivityName("");
          toast({ title: "Atividade adicionada ao catálogo" });
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao criar atividade",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  const handleDeleteActivity = (cat: RegistroActivity) => {
    deleteActivity.mutate(
      { id: cat.id },
      {
        onSuccess: () => {
          invalidateCatalogo();
          // Evita manter uma seleção apontando para um id removido do catálogo
          onChange({
            ...value,
            atividades: value.atividades.filter((a) => a.atividadeId !== cat.id),
          });
          toast({ title: "Atividade removida do catálogo" });
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao remover atividade",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  const renderAtividadeControls = (
    sel: AtividadeSelecionada,
    index: number,
    showDuration: boolean,
  ) => (
    <div className="mt-2 flex gap-2 pl-1">
      <div className="min-w-0 flex-1">
        <Select
          value={sel.responsavelId !== undefined ? String(sel.responsavelId) : "none"}
          onValueChange={(v) =>
            updateAtividadeAt(index, {
              responsavelId: v === "none" ? undefined : Number(v),
            })
          }
        >
          <SelectTrigger className="h-9" aria-label="Responsável">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem responsável</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDuration && (
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="min"
          aria-label="Duração em minutos"
          className="h-9 w-20"
          value={sel.durationMin ?? ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            updateAtividadeAt(index, {
              durationMin: Number.isFinite(n) && n >= 1 ? n : undefined,
            });
          }}
        />
      )}
    </div>
  );

  // --- Foto do dia ---
  const [driveFormOpen, setDriveFormOpen] = useState(false);
  const [driveUrl, setDriveUrl] = useState("");

  const handleGetUploadParams = async (file: any) => {
    const res = await requestUploadUrl.mutateAsync({
      data: { name: file.name, size: file.size, contentType: file.type },
    });
    file.meta = { ...file.meta, objectPath: res.objectPath };
    return {
      method: "PUT" as const,
      url: res.uploadURL,
      headers: { "Content-Type": file.type },
    };
  };

  const ensureAlbum = async (): Promise<RegistroAlbumRef> => {
    if (value.album) return value.album;
    const linkedEvent =
      (dayEvents ?? []).find((e) => e.id !== null && e.type === "meeting") ??
      (dayEvents ?? []).find((e) => e.id !== null);
    const created = await createAlbum.mutateAsync({
      data: {
        title: `Encontro ${formatEventDate(value.eventDate)}`,
        ...(linkedEvent?.id ? { eventId: linkedEvent.id } : {}),
      },
    });
    queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
    const ref: RegistroAlbumRef = {
      id: created.id,
      title: created.title,
      driveUrl: created.driveUrl ?? null,
    };
    onChange({ ...value, album: ref });
    return ref;
  };

  const invalidatePhotos = () =>
    queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });

  const handlePhotoUploadComplete = async (result: any) => {
    const objectPath = result?.successful?.[0]?.meta?.objectPath;
    if (!objectPath) return;
    if (deferPhotoPersistence) {
      patch({ pendingPhoto: { kind: "upload", objectPath } });
      toast({
        title: "Foto anexada",
        description: "Será salva junto com o registro.",
      });
      return;
    }
    try {
      const album = await ensureAlbum();
      await createPhoto.mutateAsync({ data: { objectPath, albumId: album.id } });
      invalidatePhotos();
      toast({ title: "Foto do dia anexada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao anexar a foto",
        description: apiErrorMessage(err, "Tente novamente."),
      });
    }
  };

  const handleAddDrivePhoto = async () => {
    if (!driveUrl.startsWith("https://")) {
      toast({
        variant: "destructive",
        title: "Link inválido",
        description: "O link do Drive deve começar com https://",
      });
      return;
    }
    if (deferPhotoPersistence) {
      patch({ pendingPhoto: { kind: "drive", externalUrl: driveUrl } });
      setDriveUrl("");
      setDriveFormOpen(false);
      toast({
        title: "Link anexado",
        description: "Será salvo junto com o registro.",
      });
      return;
    }
    try {
      const album = await ensureAlbum();
      await createPhoto.mutateAsync({
        data: { sourceType: "drive", externalUrl: driveUrl, albumId: album.id },
      });
      invalidatePhotos();
      setDriveUrl("");
      setDriveFormOpen(false);
      toast({ title: "Link do Drive anexado" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao anexar o link",
        description: apiErrorMessage(err, "Tente novamente."),
      });
    }
  };

  const handleRemovePhoto = (photoId: number) => {
    deletePhoto.mutate(
      { id: photoId },
      {
        onSuccess: () => {
          invalidatePhotos();
          toast({ title: "Foto removida" });
        },
      },
    );
  };

  // --- Arrecadação ---
  const showArrecadacao = !!activeCampaign || value.arrecadacao.length > 0;
  const updateArrecadacaoAt = (index: number, p: Partial<ArrecadacaoLinha>) =>
    patch({
      arrecadacao: value.arrecadacao.map((l, i) => (i === index ? { ...l, ...p } : l)),
    });

  return (
    <div className="space-y-5">
      {/* Data */}
      <SectionCard title="Data" subtitle="Dia do encontro">
        <Input
          type="date"
          value={value.eventDate}
          onChange={(e) => patch({ eventDate: e.target.value })}
          aria-label="Data do encontro"
        />
      </SectionCard>

      {/* Presença */}
      <SectionCard
        title="Presença"
        subtitle="Membros do Life Group"
        badge={`${membersSelected} selecionado${membersSelected === 1 ? "" : "s"}`}
      >
        {isLoadingPeople ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {members.map((m) => (
              <PersonToggleRow
                key={m.id}
                person={m}
                checked={presentesSet.has(m.id)}
                onToggle={() => togglePresente(m.id)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Convidados presentes */}
      <SectionCard
        title="Convidados presentes"
        subtitle="Convidados existentes e novos"
        badge={`${guestsSelected} selecionado${guestsSelected === 1 ? "" : "s"}`}
      >
        <div className="space-y-3">
          {guests.length > 0 && (
            <div className="divide-y divide-border/60">
              {guests.map((g) => (
                <PersonToggleRow
                  key={g.id}
                  person={g}
                  checked={presentesSet.has(g.id)}
                  onToggle={() => togglePresente(g.id)}
                />
              ))}
            </div>
          )}

          {value.novosConvidados.map((g, index) => (
            <div key={`${g.name}-${index}`} className="flex items-center gap-3 px-1">
              <MemberAvatar name={g.name} className="h-9 w-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {g.name}
                </span>
                {g.phone && (
                  <span className="block truncate text-xs text-muted-foreground">{g.phone}</span>
                )}
              </span>
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-primary">
                Novo
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remover convidado ${g.name}`}
                onClick={() =>
                  patch({
                    novosConvidados: value.novosConvidados.filter((_, i) => i !== index),
                  })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {addingGuest ? (
            <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nome do convidado"
                aria-label="Nome do convidado"
              />
              <Input
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="Telefone (opcional)"
                aria-label="Telefone do convidado"
                inputMode="tel"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={confirmNewGuest} disabled={!guestName.trim()}>
                  Adicionar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAddingGuest(false);
                    setGuestName("");
                    setGuestPhone("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setAddingGuest(true)}
            >
              <UserPlus className="h-3.5 w-3.5" /> Adicionar convidado
            </Button>
          )}
        </div>
      </SectionCard>

      {/* Atividades */}
      <SectionCard title="Atividades" subtitle="O que aconteceu no encontro">
        {isLoadingCatalogo ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <div className="space-y-1">
            {(catalogo ?? []).map((cat) => {
              const index = value.atividades.findIndex((a) => a.atividadeId === cat.id);
              const sel = index >= 0 ? value.atividades[index] : undefined;
              return (
                <div key={cat.id} className="border-b border-border/60 py-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={!!sel}
                      onCheckedChange={() => toggleAtividade(cat)}
                      aria-label={`Atividade ${cat.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {cat.name}
                    </span>
                    {!cat.builtin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remover ${cat.name} do catálogo`}
                        onClick={() => handleDeleteActivity(cat)}
                        disabled={deleteActivity.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {sel && renderAtividadeControls(sel, index, cat.hasDuration)}
                </div>
              );
            })}

            {orphanAtividades.map(({ a, index }) => (
              <div key={`orfa-${index}`} className="border-b border-border/60 py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {a.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover atividade ${a.name}`}
                    onClick={() => removeAtividadeAt(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {renderAtividadeControls(a, index, true)}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Input
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                placeholder="Nova atividade"
                aria-label="Nome da nova atividade"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={handleCreateActivity}
                disabled={!newActivityName.trim() || createActivity.isPending}
              >
                <Plus className="h-3.5 w-3.5" /> Criar
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Foto do dia */}
      <SectionCard title="Foto do dia" subtitle="Opcional — uma foto ou um link do Drive">
        <div className="space-y-3">
          {value.album && (
            <p className="text-xs text-muted-foreground">
              Álbum:{" "}
              <span className="font-semibold text-foreground">{value.album.title}</span>
            </p>
          )}

          {deferPhotoPersistence && value.pendingPhoto ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {value.pendingPhoto.kind === "drive" ? (
                  <ExternalLink className="h-4 w-4 text-primary" />
                ) : (
                  <ImagePlus className="h-4 w-4 text-primary" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {value.pendingPhoto.kind === "drive"
                  ? "Link do Drive anexado"
                  : "Foto anexada"}
                <span className="block text-xs font-normal text-muted-foreground">
                  Será salva ao salvar o registro
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover foto anexada"
                onClick={() => patch({ pendingPhoto: null })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : attachedPhoto ? (
            attachedPhoto.sourceType === "drive" ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </span>
                <a
                  href={attachedPhoto.externalUrl ?? attachedPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-primary"
                >
                  Ver foto no Drive
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remover foto do Drive"
                  onClick={() => handleRemovePhoto(attachedPhoto.id)}
                  disabled={deletePhoto.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative w-36">
                <img
                  src={attachedPhoto.url}
                  alt="Foto do dia"
                  className="aspect-square w-36 rounded-xl border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1.5 top-1.5 h-7 w-7 opacity-90 shadow-sm"
                  aria-label="Remover foto"
                  onClick={() => handleRemovePhoto(attachedPhoto.id)}
                  disabled={deletePhoto.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <ObjectUploader
                  onGetUploadParameters={handleGetUploadParams}
                  onComplete={handlePhotoUploadComplete}
                  maxNumberOfFiles={1}
                  maxFileSize={10 * 1024 * 1024}
                  buttonClassName={uploaderButtonClass}
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Enviar foto
                </ObjectUploader>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setDriveFormOpen((v) => !v)}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link do Drive
                </Button>
              </div>
              {driveFormOpen && (
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    aria-label="Link do Google Drive"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={handleAddDrivePhoto}
                    disabled={!driveUrl.trim() || createPhoto.isPending || createAlbum.isPending}
                  >
                    Anexar
                  </Button>
                </div>
              )}
            </>
          )}

          {value.album && (
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => patch({ album: null })}
            >
              Desvincular álbum deste registro
            </button>
          )}
        </div>
      </SectionCard>

      {/* Arrecadação — só com campanha ativa (ou itens já lançados) */}
      {showArrecadacao && (
        <SectionCard
          title="Arrecadação"
          subtitle={
            activeCampaign
              ? `Campanha ativa: ${activeCampaign.title}`
              : "Itens deste registro"
          }
        >
          <div className="space-y-2">
            {value.arrecadacao.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={row.item}
                  onChange={(e) => updateArrecadacaoAt(index, { item: e.target.value })}
                  placeholder="Item (ex.: Cobertor)"
                  aria-label="Item arrecadado"
                  className="min-w-0 flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) => updateArrecadacaoAt(index, { quantity: e.target.value })}
                  aria-label="Quantidade"
                  className="w-20"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remover item"
                  onClick={() =>
                    patch({ arrecadacao: value.arrecadacao.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                patch({ arrecadacao: [...value.arrecadacao, { item: "", quantity: "1" }] })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Observações */}
      <SectionCard title="Observações" subtitle="Opcional">
        <Textarea
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Observações do encontro..."
          rows={3}
        />
      </SectionCard>
    </div>
  );
}
