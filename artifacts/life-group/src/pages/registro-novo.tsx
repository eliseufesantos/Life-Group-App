import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRegistro,
  useGetCurrentUser,
  getListRegistrosQueryKey,
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

  const handleSubmit = () => {
    createRegistro.mutate(
      { data: buildRegistroInput(value) },
      {
        onSuccess: (detail) => {
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
        },
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "Erro ao salvar o registro",
            description: apiErrorMessage(err, "Tente novamente."),
          }),
      },
    );
  };

  return (
    <div className="space-y-5 px-5 pt-6">
      <PageHeader
        title="Novo registro"
        subtitle="Registro do encontro"
        backHref="/registros"
      />
      <RegistroFormSections value={value} onChange={setValue} />
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={createRegistro.isPending || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.eventDate)}
      >
        {createRegistro.isPending ? "Salvando..." : "Salvar registro"}
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
