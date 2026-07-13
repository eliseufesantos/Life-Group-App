import { useListPhotos, useCreatePhoto, useDeletePhoto, useRequestUploadUrl, getListPhotosQueryKey } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@workspace/object-storage-web";

export function Photos({ user }: { user: CurrentUser }) {
  const { data: photos, isLoading } = useListPhotos();
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();
  const requestUploadUrl = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isLeaderOrAux = user.role === "leader" || user.role === "auxiliary";

  const handleGetUploadParams = async (file: any) => {
    // 1. Request presigned URL from API
    const res = await requestUploadUrl.mutateAsync({
      data: {
        name: file.name,
        size: file.size,
        contentType: file.type,
      }
    });
    
    // Store objectPath in file meta so we can use it onComplete
    file.meta = { ...file.meta, objectPath: res.objectPath };

    // 2. Return PUT info for direct GCS upload
    return {
      method: "PUT" as const,
      url: res.uploadURL,
      headers: { "Content-Type": file.type },
    };
  };

  const handleUploadComplete = (result: any) => {
    const successful = result.successful || [];
    if (successful.length === 0) return;

    // Create a photo record for each successful upload
    successful.forEach((file: any) => {
      const objectPath = file.meta?.objectPath;
      if (objectPath) {
        createPhoto.mutate(
          { data: { objectPath } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
            }
          }
        );
      }
    });

    toast({ title: "Upload concluído", description: `${successful.length} foto(s) enviada(s).` });
  };

  const handleDelete = (id: number) => {
    deletePhoto.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
          toast({ title: "Foto apagada" });
        },
      }
    );
  };

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-4"><Skeleton className="aspect-square rounded-xl" /><Skeleton className="aspect-square rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          Galeria
        </h2>
        <ObjectUploader
          onGetUploadParameters={handleGetUploadParams}
          onComplete={handleUploadComplete}
          maxNumberOfFiles={5}
          maxFileSize={10 * 1024 * 1024} // 10MB
          buttonClassName="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          Adicionar Fotos
        </ObjectUploader>
      </div>

      {!photos?.length ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-base font-medium">Nenhuma foto na galeria.</p>
            <p className="text-sm mt-1">Compartilhe momentos da célula com o grupo.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {photos.map((photo) => {
            const canDelete = isLeaderOrAux || photo.uploadedBy === user.id;
            
            return (
              <div key={photo.id} className="group relative aspect-square bg-muted rounded-xl overflow-hidden border border-border shadow-sm">
                <img 
                  src={photo.url} 
                  alt={photo.caption || "Foto da célula"} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 flex flex-col justify-between p-3">
                  <div className="flex justify-end">
                    {canDelete && (
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-7 w-7 opacity-80 hover:opacity-100 shadow-sm"
                        onClick={() => handleDelete(photo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-medium truncate">{photo.uploaderName}</p>
                    <p className="text-[10px] text-white/80">{format(parseISO(photo.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}