import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRegistro,
  useCreateAlbum,
  useCreatePhoto,
  useUpdateRegistro,
  useGetCurrentUser,
  getListRegistrosQueryKey,
  getListAlbumsQueryKey,
  getListPhotosQueryKey,
} from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  LeadershipOnly,
  apiErrorMessage,
} from "@/components/registros/registro-common";
import {
  RegistroFormSections,
  buildRegistroInput,
  emptyRegistroForm,
  persistPendingPhoto,
} from "@/components/registros/registro-form";

function dateFromSearch(search: string): string {
  const date = new URLSearchParams(search).get("date");
  return date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)
    ? date
    : format(new Date(), "yyyy-MM-dd");
}

function RegistroNovoContent() {
  const search = useSearch();
  const [value, setValue] = useState(() => emptyRegistroForm(dateFromSearch(search)));

  const { data: user } = useGetCurrentUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRegistro = useCreateRegistro();
  const createAlbum = useCreateAlbum();
  const createPhoto = useCreatePhoto();
  const updateRegistro = useUpdateRegistro();

  const saving =
    createRegistro.isPending ||
    createAlbum.isPending ||
    createPhoto.isPending ||
    updateRegistro.isPending;

  const handleSubmit = async () => {
    try {
      // O registro é criado primeiro; só depois a foto pendente é persistida e
      // vinculada. Assim, uma falha na criação nunca deixa álbum/foto órfãos.
      const detail = await createRegistro.mutateAsync({
        data: buildRegistroInput(value),
      });

      if (value.pendingPhoto) {
        try {
          const albumId = await persistPendingPhoto({
            pending: value.pendingPhoto,
            eventDate: value.eventDate,
            createAlbumAsync: createAlbum.mutateAsync,
            createPhotoAsync: createPhoto.mutateAsync,
          });
          await updateRegistro.mutateAsync({
            id: detail.id,
            data: { albumId },
          });
          queryClient.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
        } catch (photoErr) {
          // O registro já foi salvo; só a foto falhou. Não bloqueia o fluxo.
          toast({
            variant: "destructive",
            title: "Registro salvo, mas a foto não foi anexada",
            description: apiErrorMessage(
              photoErr,
              "Você pode adicioná-la depois pela tela do registro.",
            ),
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: getListRegistrosQueryKey() });
      if (user?.role === "auxiliary") {
        toast({
          title: "Registro enviado",
          description:
            "Ele ficou pendente de aprovação do líder do Life Group.",
        });
      } else {
        toast({ title: "Registro publicado" });
      }
      navigate(`/registros/${detail.id}`);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar o registro",
        description: apiErrorMessage(err, "Tente novamente."),
      });
    }
  };

  return (
    <div className="space-y-5 px-5 pt-6">
      <PageHeader
        title="Novo registro"
        subtitle="Registro do encontro"
        backHref="/registros"
      />
      <RegistroFormSections
        value={value}
        onChange={setValue}
        deferPhotoPersistence
      />
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={saving || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.eventDate)}
      >
        {saving ? "Salvando..." : "Salvar registro"}
      </Button>
    </div>
  );
}

export default function RegistroNovo() {
  return (
    <LeadershipOnly title="Novo registro">
      <RegistroNovoContent />
    </LeadershipOnly>
  );
}
