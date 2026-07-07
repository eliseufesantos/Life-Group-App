import { useEffect, useState } from "react";
import {
  useGetCellConfig,
  useUpdateCellConfig,
  useGetRecurrence,
  useSetRecurrence,
  useRequestUploadUrl,
  getGetCellConfigQueryKey,
  getGetRecurrenceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Home, ArrowLeft, CalendarClock, ImageIcon } from "lucide-react";
import { Link } from "wouter";

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function photoSrc(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage${photoUrl}`;
}

export default function CelulaConfig() {
  const { data: config, isLoading: loadingConfig } = useGetCellConfig();
  const { data: recurrence, isLoading: loadingRec } = useGetRecurrence();
  const updateConfig = useUpdateCellConfig();
  const setRecurrence = useSetRecurrence();
  const requestUploadUrl = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [weekday, setWeekday] = useState("3");
  const [time, setTime] = useState("19:30");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (config) {
      setName(config.name);
      setPhotoUrl(config.photoUrl);
    }
  }, [config]);

  useEffect(() => {
    if (recurrence?.configured) {
      if (recurrence.weekday !== null) setWeekday(String(recurrence.weekday));
      if (recurrence.time) setTime(recurrence.time);
      setLocation(recurrence.location ?? "");
    }
  }, [recurrence]);

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

  const handleUploadComplete = (result: any) => {
    const successful = result.successful || [];
    const objectPath = successful[0]?.meta?.objectPath;
    if (!objectPath) return;
    setPhotoUrl(objectPath);
    updateConfig.mutate(
      { data: { name: name.trim() || config?.name || "Célula", photoUrl: objectPath } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCellConfigQueryKey() });
          toast({ title: "Foto da célula atualizada" });
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao salvar foto" }),
      },
    );
  };

  if (loadingConfig || loadingRec) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const src = photoSrc(photoUrl);

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/perfil"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Home className="h-6 w-6 text-primary" /> Configurações da Célula
        </h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Identidade</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden flex items-center justify-center border">
              {src ? (
                <img src={src} alt="Foto da célula" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <ObjectUploader
              onGetUploadParameters={handleGetUploadParams}
              onComplete={handleUploadComplete}
              maxNumberOfFiles={1}
              maxFileSize={10 * 1024 * 1024}
              buttonClassName="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              Alterar foto
            </ObjectUploader>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              updateConfig.mutate(
                { data: { name: name.trim(), photoUrl } },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getGetCellConfigQueryKey() });
                    toast({ title: "Nome da célula salvo" });
                  },
                  onError: () => toast({ variant: "destructive", title: "Erro ao salvar" }),
                },
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cell-name">Nome da célula *</Label>
              <Input id="cell-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Célula Vida Nova" required />
            </div>
            <Button type="submit" disabled={updateConfig.isPending}>Salvar nome</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Reunião semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setRecurrence.mutate(
                {
                  data: {
                    weekday: parseInt(weekday, 10),
                    time,
                    location: location.trim() || undefined,
                  },
                },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getGetRecurrenceQueryKey() });
                    toast({ title: "Recorrência salva" });
                  },
                  onError: () => toast({ variant: "destructive", title: "Erro ao salvar recorrência" }),
                },
              );
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dia da semana *</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-time">Horário *</Label>
                <Input id="rec-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-loc">Local</Label>
              <Input id="rec-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Casa do líder" />
            </div>
            <Button type="submit" disabled={setRecurrence.isPending}>Salvar recorrência</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
