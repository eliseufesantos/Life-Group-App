import { useMemo, useState } from "react";
import {
  useListPhotos,
  useCreatePhoto,
  useDeletePhoto,
  useRequestUploadUrl,
  getListPhotosQueryKey,
  useListAlbums,
  useCreateAlbum,
  useDeleteAlbum,
  getListAlbumsQueryKey,
  useListCalendarEvents,
  getListCalendarEventsQueryKey,
} from "@workspace/api-client-react";
import type { Album, CurrentUser, Photo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trash2,
  Image as ImageIcon,
  Images,
  Plus,
  ExternalLink,
  ArrowLeft,
  Link2,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@workspace/object-storage-web";

const uploaderButtonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground border border-primary-border min-h-8 px-3 text-xs";

function PhotoTile({
  photo,
  canDelete,
  onDelete,
}: {
  photo: Photo;
  canDelete: boolean;
  onDelete: (id: number) => void;
}) {
  const deleteButton = canDelete && (
    <Button
      variant="destructive"
      size="icon"
      className="h-7 w-7 opacity-80 shadow-sm hover:opacity-100"
      onClick={() => onDelete(photo.id)}
      aria-label="Apagar foto"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  if (photo.sourceType === "drive") {
    // Drive items are links, not embeddable images.
    return (
      <div className="relative flex aspect-square flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <a
          href={photo.externalUrl ?? photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center transition-colors hover:bg-primary/5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ExternalLink className="h-5 w-5 text-primary" />
          </span>
          <span className="text-xs font-semibold text-primary">Ver no Drive</span>
          <span className="text-[10px] text-muted-foreground">
            {photo.uploaderName ?? "—"} • {format(parseISO(photo.createdAt), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </a>
        <div className="absolute right-2 top-2">{deleteButton}</div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
      <img
        src={photo.url}
        alt={photo.caption || "Foto do Life Group"}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-black/10 p-3">
        <div className="flex justify-end">{deleteButton}</div>
        <div className="text-white">
          <p className="truncate text-xs font-medium">{photo.uploaderName}</p>
          <p className="text-[10px] text-white/80">
            {format(parseISO(photo.createdAt), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({
  photos,
  user,
  isLeaderOrAux,
  onDelete,
}: {
  photos: Photo[];
  user: CurrentUser;
  isLeaderOrAux: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {photos.map((photo) => (
        <PhotoTile
          key={photo.id}
          photo={photo}
          canDelete={isLeaderOrAux || photo.uploadedBy === user.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export function Photos({ user }: { user: CurrentUser }) {
  const { data: photos, isLoading: isLoadingPhotos } = useListPhotos();
  const { data: albums, isLoading: isLoadingAlbums } = useListAlbums();
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();
  const createAlbum = useCreateAlbum();
  const deleteAlbum = useDeleteAlbum();
  const requestUploadUrl = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [openAlbumId, setOpenAlbumId] = useState<number | null>(null);
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumEventId, setAlbumEventId] = useState<string>("none");
  const [albumDriveUrl, setAlbumDriveUrl] = useState("");
  const [driveFormOpen, setDriveFormOpen] = useState(false);
  const [drivePhotoUrl, setDrivePhotoUrl] = useState("");

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  // Events to link an album to: from six months back to three months ahead.
  const eventsRange = useMemo(() => {
    const now = new Date();
    return {
      from: format(subMonths(now, 6), "yyyy-MM-dd"),
      to: format(addMonths(now, 3), "yyyy-MM-dd"),
    };
  }, []);
  const { data: events } = useListCalendarEvents(eventsRange, {
    query: { queryKey: getListCalendarEventsQueryKey(eventsRange), enabled: albumDialogOpen },
  });
  // Generated meeting occurrences without override have id null and can't be linked.
  const linkableEvents = (events ?? []).filter(
    (ev): ev is typeof ev & { id: number } => ev.id !== null
  );

  const photosByAlbum = useMemo(() => {
    const map = new Map<number, Photo[]>();
    for (const photo of photos ?? []) {
      if (photo.albumId === null) continue;
      const list = map.get(photo.albumId) ?? [];
      list.push(photo);
      map.set(photo.albumId, list);
    }
    return map;
  }, [photos]);

  const looseFotos = (photos ?? []).filter((p) => p.albumId === null);
  const openAlbum = openAlbumId !== null ? albums?.find((a) => a.id === openAlbumId) : undefined;

  const invalidatePhotos = () =>
    queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
  const invalidateAlbums = () =>
    queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey() });

  const handleGetUploadParams = async (file: any) => {
    const res = await requestUploadUrl.mutateAsync({
      data: {
        name: file.name,
        size: file.size,
        contentType: file.type,
      },
    });
    file.meta = { ...file.meta, objectPath: res.objectPath };
    return {
      method: "PUT" as const,
      url: res.uploadURL,
      headers: { "Content-Type": file.type },
    };
  };

  const makeUploadComplete = (albumId?: number) => (result: any) => {
    const successful = result.successful || [];
    if (successful.length === 0) return;

    successful.forEach((file: any) => {
      const objectPath = file.meta?.objectPath;
      if (objectPath) {
        createPhoto.mutate(
          { data: { objectPath, ...(albumId !== undefined ? { albumId } : {}) } },
          {
            onSuccess: () => {
              invalidatePhotos();
              invalidateAlbums();
            },
          }
        );
      }
    });

    toast({ title: "Upload concluído", description: `${successful.length} foto(s) enviada(s).` });
  };

  const handleDeletePhoto = (id: number) => {
    deletePhoto.mutate(
      { id },
      {
        onSuccess: () => {
          invalidatePhotos();
          invalidateAlbums();
          toast({ title: "Foto apagada" });
        },
      }
    );
  };

  const resetAlbumForm = () => {
    setAlbumTitle("");
    setAlbumEventId("none");
    setAlbumDriveUrl("");
  };

  const handleCreateAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (albumDriveUrl && !albumDriveUrl.startsWith("https://")) {
      toast({ variant: "destructive", title: "Link inválido", description: "O link do Drive deve começar com https://" });
      return;
    }
    createAlbum.mutate(
      {
        data: {
          title: albumTitle,
          ...(albumEventId !== "none" ? { eventId: Number(albumEventId) } : {}),
          ...(albumDriveUrl ? { driveUrl: albumDriveUrl } : {}),
        },
      },
      {
        onSuccess: (album) => {
          invalidateAlbums();
          setAlbumDialogOpen(false);
          resetAlbumForm();
          setOpenAlbumId(album.id);
          toast({ title: "Álbum criado" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar o álbum." }),
      }
    );
  };

  const handleDeleteAlbum = (id: number) => {
    deleteAlbum.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAlbums();
          invalidatePhotos();
          setOpenAlbumId((current) => (current === id ? null : current));
          toast({ title: "Álbum apagado", description: "As fotos foram mantidas em “Outras fotos”." });
        },
      }
    );
  };

  const handleAddDrivePhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openAlbum) return;
    if (!drivePhotoUrl.startsWith("https://")) {
      toast({ variant: "destructive", title: "Link inválido", description: "O link do Drive deve começar com https://" });
      return;
    }
    createPhoto.mutate(
      { data: { sourceType: "drive", externalUrl: drivePhotoUrl, albumId: openAlbum.id } },
      {
        onSuccess: () => {
          invalidatePhotos();
          invalidateAlbums();
          setDrivePhotoUrl("");
          setDriveFormOpen(false);
          toast({ title: "Link adicionado ao álbum" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível adicionar o link." }),
      }
    );
  };

  if (isLoadingPhotos || isLoadingAlbums) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="aspect-square rounded-2xl" />
        <Skeleton className="aspect-square rounded-2xl" />
      </div>
    );
  }

  // ---------- Album detail view ----------
  if (openAlbum) {
    const albumPhotos = photosByAlbum.get(openAlbum.id) ?? [];
    const canManageAlbum = isLeaderOrAux || openAlbum.createdBy === user.id;

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 h-8 w-8 shrink-0"
              onClick={() => {
                setOpenAlbumId(null);
                setDriveFormOpen(false);
              }}
              aria-label="Voltar para os álbuns"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="break-words font-serif text-lg font-bold leading-snug">{openAlbum.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {openAlbum.eventTitle && (
                  <span className="mr-2 inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {openAlbum.eventTitle}
                  </span>
                )}
                {albumPhotos.length === 1 ? "1 foto" : `${albumPhotos.length} fotos`}
              </p>
            </div>
          </div>
          {canManageAlbum && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDeleteAlbum(openAlbum.id)}
              disabled={deleteAlbum.isPending}
              aria-label="Apagar álbum"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {openAlbum.driveUrl && (
          <a
            href={openAlbum.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <ExternalLink className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-primary">Abrir no Google Drive</span>
              <span className="block truncate text-xs text-muted-foreground">{openAlbum.driveUrl}</span>
            </span>
          </a>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <ObjectUploader
            onGetUploadParameters={handleGetUploadParams}
            onComplete={makeUploadComplete(openAlbum.id)}
            maxNumberOfFiles={5}
            maxFileSize={10 * 1024 * 1024}
            buttonClassName={uploaderButtonClass}
          >
            <Plus className="h-3.5 w-3.5" /> Enviar fotos
          </ObjectUploader>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setDriveFormOpen((v) => !v)}
          >
            <Link2 className="h-3.5 w-3.5" /> Adicionar link do Drive
          </Button>
        </div>

        {driveFormOpen && (
          <form onSubmit={handleAddDrivePhoto} className="flex gap-2">
            <Input
              type="url"
              value={drivePhotoUrl}
              onChange={(e) => setDrivePhotoUrl(e.target.value)}
              required
              placeholder="https://drive.google.com/..."
              aria-label="Link do Google Drive"
            />
            <Button type="submit" size="sm" disabled={createPhoto.isPending}>
              Adicionar
            </Button>
          </form>
        )}

        {albumPhotos.length === 0 ? (
          <Card className="rounded-2xl border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <ImageIcon className="mb-4 h-10 w-10 opacity-20" />
              <p className="text-sm">Este álbum ainda não tem fotos.</p>
            </CardContent>
          </Card>
        ) : (
          <PhotoGrid photos={albumPhotos} user={user} isLeaderOrAux={isLeaderOrAux} onDelete={handleDeletePhoto} />
        )}
      </div>
    );
  }

  // ---------- Albums overview ----------
  const albumCover = (album: Album) =>
    (photosByAlbum.get(album.id) ?? []).find((p) => p.sourceType === "upload");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
          <Images className="h-5 w-5 text-primary" />
          Álbuns
        </h2>
        <Dialog
          open={albumDialogOpen}
          onOpenChange={(o) => {
            setAlbumDialogOpen(o);
            if (!o) resetAlbumForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo álbum</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Novo álbum</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAlbum} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  required
                  placeholder="Ex: Confraternização de Junho"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Evento (opcional)</label>
                <Select value={albumEventId} onValueChange={setAlbumEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem evento</SelectItem>
                    {linkableEvents.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id.toString()}>
                        {ev.title} • {format(parseISO(ev.date), "dd/MM", { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pasta do Google Drive (opcional)</label>
                <Input
                  type="url"
                  value={albumDriveUrl}
                  onChange={(e) => setAlbumDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <Button type="submit" className="w-full" disabled={createAlbum.isPending}>
                {createAlbum.isPending ? "Criando..." : "Criar álbum"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!albums?.length ? (
        <Card className="rounded-2xl border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Images className="mb-4 h-10 w-10 opacity-20" />
            <p className="text-base font-medium">Nenhum álbum ainda.</p>
            <p className="mt-1 text-sm">Crie um álbum para organizar as fotos do Life Group.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {albums.map((album) => {
            const cover = albumCover(album);
            const canManageAlbum = isLeaderOrAux || album.createdBy === user.id;
            return (
              <div
                key={album.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenAlbumId(album.id)}
                  className="block w-full text-left"
                  aria-label={`Abrir álbum ${album.title}`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-primary/5">
                    {cover ? (
                      <img
                        src={cover.url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Images className="h-8 w-8 text-primary/30" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{album.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {album.eventTitle && <span>{album.eventTitle} • </span>}
                      {album.photoCount === 1 ? "1 foto" : `${album.photoCount} fotos`}
                    </p>
                  </div>
                </button>
                {album.driveUrl && (
                  <a
                    href={album.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir no Google Drive
                  </a>
                )}
                {canManageAlbum && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7 opacity-80 shadow-sm hover:opacity-100"
                    onClick={() => handleDeleteAlbum(album.id)}
                    disabled={deleteAlbum.isPending}
                    aria-label={`Apagar álbum ${album.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-base font-bold">
            <ImageIcon className="h-4 w-4 text-primary" />
            Outras fotos
          </h3>
          <ObjectUploader
            onGetUploadParameters={handleGetUploadParams}
            onComplete={makeUploadComplete()}
            maxNumberOfFiles={5}
            maxFileSize={10 * 1024 * 1024}
            buttonClassName={uploaderButtonClass}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar fotos
          </ObjectUploader>
        </div>

        {looseFotos.length === 0 ? (
          <Card className="rounded-2xl border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center py-10 text-center text-muted-foreground">
              <ImageIcon className="mb-3 h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhuma foto fora de álbuns.</p>
            </CardContent>
          </Card>
        ) : (
          <PhotoGrid photos={looseFotos} user={user} isLeaderOrAux={isLeaderOrAux} onDelete={handleDeletePhoto} />
        )}
      </div>
    </div>
  );
}
