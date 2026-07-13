import { useState, useRef } from "react";
import { Link } from "wouter";
import { useListMembers, useCreateGuest, useImportMembers, getListMembersQueryKey, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Plus, User, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { categoryLabel } from "@/lib/labels";

const guestSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().optional(),
});

export default function Members() {
  const [filter, setFilter] = useState<"all" | "member" | "guest">("all");
  const [search, setSearch] = useState("");
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  
  const { data: user } = useGetCurrentUser();
  const { data: members, isLoading } = useListMembers(
    filter === "all" ? undefined : { status: filter }
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: createGuest, isPending: creatingGuest } = useCreateGuest();
  const { mutate: importMembers, isPending: importing } = useImportMembers();

  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";

  const guestForm = useForm<z.infer<typeof guestSchema>>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: "", phone: "" },
  });

  const onGuestSubmit = (data: z.infer<typeof guestSchema>) => {
    createGuest(
      { data: { name: data.name, phone: data.phone } },
      {
        onSuccess: () => {
          toast({ title: "Convidado adicionado" });
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setGuestDialogOpen(false);
          guestForm.reset();
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao adicionar convidado" }),
      }
    );
  };

  const handleImport = () => {
    const lines = csvText.split("\n").filter(l => l.trim() !== "");
    const rows = lines.map(line => {
      const [name, email, phone, formationTrack] = line.split(",").map(s => s.trim());
      return { name, email, phone, formationTrack };
    }).filter(r => r.name);

    if (rows.length === 0) {
      toast({ variant: "destructive", title: "Erro", description: "Nenhuma linha válida encontrada." });
      return;
    }

    importMembers({ data: { rows } }, {
      onSuccess: (res) => {
        toast({ title: "Importação concluída", description: `${res.imported} importados, ${res.skipped} ignorados.` });
        queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        setImportDialogOpen(false);
        setCsvText("");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Erro ao importar" });
      }
    });
  };

  const filteredMembers = members?.filter((m) => 
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Pessoas"
        subtitle="Membros e convidados da célula"
        action={
          isLeaderOrAux ? (
            <div className="flex shrink-0 gap-2">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full bg-card" aria-label="Importar CSV">
                    <Upload className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Membros</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Cole os dados em formato CSV (Nome, Email, Telefone, Trilha)</p>
                    <textarea 
                      className="w-full min-h-[150px] p-3 text-sm border rounded-md" 
                      placeholder="João Silva, joao@exemplo.com, 11999999999, Trilha 1&#10;Maria Souza, maria@exemplo.com, , Trilha 2"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleImport} className="w-full" disabled={importing || !csvText.trim()}>
                    {importing ? "Importando..." : "Importar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Convidado
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Convidado</DialogTitle>
              </DialogHeader>
              <Form {...guestForm}>
                <form onSubmit={guestForm.handleSubmit(onGuestSubmit)} className="space-y-4">
                  <FormField
                    control={guestForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={guestForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (opcional)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={creatingGuest}>
                    {creatingGuest ? "Salvando..." : "Salvar"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
            </div>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-full border-card-border bg-card pl-10 shadow-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
            <TabsTrigger value="member" className="flex-1">Membros</TabsTrigger>
            <TabsTrigger value="guest" className="flex-1">Convidados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredMembers?.map((member) => (
            <Link key={member.id} href={`/membros/${member.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{member.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant={member.status === "member" ? "default" : "secondary"}>
                        {member.status === "member" ? "Membro" : "Convidado"}
                      </Badge>
                      {member.categories.map((cat) => (
                        <Badge key={cat} variant="outline">
                          {categoryLabel(cat)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {filteredMembers?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma pessoa encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
