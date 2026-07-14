import { useState } from "react";
import { Link } from "wouter";
import {
  useListMembers,
  useListDiscipleships,
  useCreateGuest,
  useImportMembers,
  getListMembersQueryKey,
  useGetCurrentUser,
  type Member,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Search,
  Plus,
  Upload,
  Crown,
  Shield,
  User,
  UserPlus,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/labels";
import { calcAge } from "@/lib/people";
import { MemberAvatar } from "@/components/people/member-avatar";

const guestSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().optional(),
});

type PersonKind = "leader" | "auxiliary" | "member" | "guest";

function personKind(m: Member): PersonKind {
  if (m.status === "guest") return "guest";
  if (m.role === "leader") return "leader";
  if (m.role === "auxiliary") return "auxiliary";
  return "member";
}

const KIND_STYLES: Record<
  PersonKind,
  { label: string; icon: LucideIcon; card: string; chip: string; badge: string }
> = {
  leader: {
    label: "Líder",
    icon: Crown,
    card: "border-primary/60 bg-primary/[0.04]",
    chip: "bg-primary text-primary-foreground",
    badge: "border-transparent bg-primary text-primary-foreground",
  },
  auxiliary: {
    label: "Auxiliar",
    icon: Shield,
    card: "border-primary/30",
    chip: "bg-primary/15 text-primary",
    badge: "border-primary/40 bg-accent text-primary",
  },
  member: {
    label: "Membro",
    icon: User,
    card: "",
    chip: "bg-muted text-muted-foreground",
    badge: "border-card-border bg-card text-muted-foreground",
  },
  guest: {
    label: "Convidado",
    icon: UserPlus,
    card: "border-dashed border-amber-300/80 bg-amber-50/60",
    chip: "bg-amber-100 text-amber-700",
    badge: "border-amber-300/80 bg-amber-100/80 text-amber-800",
  },
};

const ROLE_FILTERS: { value: "all" | PersonKind; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "leader", label: "Líder" },
  { value: "auxiliary", label: "Auxiliar" },
  { value: "member", label: "Membro" },
  { value: "guest", label: "Convidado" },
];

const TAGS = ["host", "discipler", "disciple"] as const;
type Tag = (typeof TAGS)[number];

const LINK_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "linked", label: "Com vínculo" },
  { value: "unlinked", label: "Sem vínculo" },
] as const;
type LinkFilter = (typeof LINK_FILTERS)[number]["value"];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-card-border bg-card text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function Members() {
  const [roleFilter, setRoleFilter] = useState<"all" | PersonKind>("all");
  const [tagFilters, setTagFilters] = useState<Tag[]>([]);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [search, setSearch] = useState("");
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  const { data: user } = useGetCurrentUser();
  const { data: members, isLoading } = useListMembers();
  const { data: discipleships } = useListDiscipleships();

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

  // Ids de pessoas com algum vínculo de discipulado (lados externos não têm id)
  const linkedIds = new Set<number>();
  for (const d of discipleships ?? []) {
    if (d.disciplerId !== null) linkedIds.add(d.disciplerId);
    if (d.discipleId !== null) linkedIds.add(d.discipleId);
  }

  const toggleTag = (tag: Tag) =>
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const advancedCount = tagFilters.length + (linkFilter !== "all" ? 1 : 0);

  const filteredMembers = members?.filter((m) => {
    if (!m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter !== "all" && personKind(m) !== roleFilter) return false;
    if (tagFilters.length > 0 && !tagFilters.every((t) => m.categories.includes(t))) return false;
    if (linkFilter === "linked" && !linkedIds.has(m.id)) return false;
    if (linkFilter === "unlinked" && linkedIds.has(m.id)) return false;
    return true;
  });

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title="Pessoas"
        subtitle="Membros e convidados do Life Group"
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
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-full border-card-border bg-card pl-10 shadow-sm"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative h-11 w-11 shrink-0 rounded-full bg-card"
                aria-label="Mais filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {advancedCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {advancedCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl p-4">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TAGS.map((tag) => (
                      <Chip key={tag} active={tagFilters.includes(tag)} onClick={() => toggleTag(tag)}>
                        {categoryLabel(tag)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Vínculo de discipulado
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {LINK_FILTERS.map((f) => (
                      <Chip key={f.value} active={linkFilter === f.value} onClick={() => setLinkFilter(f.value)}>
                        {f.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                {advancedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full rounded-full"
                    onClick={() => {
                      setTagFilters([]);
                      setLinkFilter("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ROLE_FILTERS.map((f) => (
            <Chip key={f.value} active={roleFilter === f.value} onClick={() => setRoleFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredMembers?.map((member) => {
            const kind = personKind(member);
            const style = KIND_STYLES[kind];
            const RoleIcon = style.icon;
            const age = calcAge(member.birthDate);
            return (
              <Link key={member.id} href={`/membros/${member.id}`}>
                <Card className={cn("cursor-pointer transition-colors hover:border-primary/50", style.card)}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="relative shrink-0">
                      <MemberAvatar name={member.name} avatarPath={member.avatarPath} className="h-11 w-11 text-sm" />
                      <span
                        className={cn(
                          "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card",
                          style.chip,
                        )}
                        title={style.label}
                      >
                        <RoleIcon className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="truncate font-medium">{member.name}</h3>
                        {age !== null && (
                          <span className="shrink-0 text-xs text-muted-foreground">{age} anos</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge className={cn("border", style.badge)} variant="outline">
                          {style.label}
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
            );
          })}
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
