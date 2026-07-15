import { useParams, useLocation } from "wouter";
import {
  useGetMember,
  useGetCurrentUser,
  useUpdateMember,
  useDeleteMember,
  useRequestUploadUrl,
  usePromoteGuest,
  getGetMemberQueryKey,
  getListMembersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Trash, UserCheck, Pencil, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { roleLabel, categoryLabel } from "@/lib/labels";
import { calcAge, formatBirthday } from "@/lib/people";
import { MemberAvatar } from "@/components/people/member-avatar";
import { DiscipleshipSection } from "@/components/people/discipleship-section";

const updateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  formationTrack: z.string().optional(),
  role: z.enum(["leader", "auxiliary", "member"]).optional(),
  categories: z.array(z.enum(["host", "discipler", "disciple"])),
  birthDate: z.string().optional(),
});

export default function MemberDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";
  const isLeader = user?.role === "leader";

  const { data: member, isLoading } = useGetMember(Number(id), {
    query: { enabled: !!id, queryKey: getGetMemberQueryKey(Number(id)) }
  });

  const { mutate: updateMember, isPending: updating } = useUpdateMember();
  const { mutate: deleteMember } = useDeleteMember();
  const { mutate: promoteGuest, isPending: promoting } = usePromoteGuest();
  const requestUploadUrl = useRequestUploadUrl();

  const [editing, setEditing] = useState(false);
  // undefined = foto não alterada; string = nova foto; null = foto removida
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);

  const editForm = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      formationTrack: "",
      role: "member",
      categories: [],
      birthDate: "",
    },
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!member) return <div className="p-6 text-center text-muted-foreground">Membro não encontrado</div>;

  const isGuest = member.status === "guest";
  const age = calcAge(member.birthDate);
  const editedBirthDate = editForm.watch("birthDate");
  const editedAge = calcAge(editedBirthDate || null);

  const startEditing = () => {
    editForm.reset({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      formationTrack: member.formationTrack || "",
      role: (member.role as "leader" | "auxiliary" | "member" | undefined) || "member",
      categories: member.categories,
      birthDate: member.birthDate || "",
    });
    setAvatarDraft(undefined);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setAvatarDraft(undefined);
  };

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
    const objectPath = result.successful?.[0]?.meta?.objectPath;
    if (objectPath) setAvatarDraft(objectPath);
  };

  const onUpdate = (data: z.infer<typeof updateSchema>) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone,
      birthDate: data.birthDate || null,
    };
    if (!isGuest) {
      payload.formationTrack = data.formationTrack;
      payload.categories = data.categories;
      // Só o líder nomeia funções (RF-1.4); enviar o campo como auxiliar seria
      // recusado pela API e bloquearia a edição dos demais dados.
      if (member.status === "member" && isLeader) payload.role = data.role;
    }
    if (avatarDraft !== undefined) payload.avatarPath = avatarDraft;

    updateMember(
      { id: member.id, data: payload as any },
      {
        onSuccess: () => {
          toast({ title: "Atualizado com sucesso" });
          queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(member.id) });
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setEditing(false);
          setAvatarDraft(undefined);
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao atualizar" })
      }
    );
  };

  const onDelete = () => {
    if (confirm("Tem certeza que deseja remover esta pessoa?")) {
      deleteMember({ id: member.id }, {
        onSuccess: () => {
          toast({ title: "Removido com sucesso" });
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setLocation("/membros");
        }
      });
    }
  };

  const onPromote = () => {
    if (!promoteEmail) return;
    promoteGuest(
      { id: member.id, data: { email: promoteEmail } },
      {
        onSuccess: () => {
          toast({ title: "Promovido a membro!" });
          queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(member.id) });
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          setPromoteOpen(false);
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao promover" })
      }
    );
  };

  // Foto exibida no modo de edição (respeita alteração/remoção pendente)
  const previewAvatarPath = avatarDraft === undefined ? member.avatarPath : avatarDraft;

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title={member.name}
        subtitle={isGuest ? "Convidado" : "Membro"}
        backHref="/membros"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Perfil</CardTitle>
          <div className="flex gap-2">
            {isLeaderOrAux && isGuest && !editing && (
              <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <UserCheck className="h-4 w-4 mr-2" /> Promover
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Promover a Membro</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <FormLabel>E-mail do membro</FormLabel>
                      <Input value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} type="email" placeholder="email@exemplo.com" />
                    </div>
                    <Button onClick={onPromote} className="w-full" disabled={promoting || !promoteEmail}>Promover</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {isLeaderOrAux && !editing && (
              <Button variant="secondary" size="sm" className="rounded-full" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
            )}
          </div>
        </CardHeader>

        {!editing ? (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <MemberAvatar name={member.name} avatarPath={member.avatarPath} className="h-16 w-16 text-lg" />
              <div className="flex flex-wrap gap-2">
                <Badge variant={isGuest ? "secondary" : "default"}>
                  {isGuest ? "Convidado" : "Membro"}
                </Badge>
                {member.role && <Badge variant="outline" className="border-primary/50 text-primary">{roleLabel(member.role)}</Badge>}
                {member.categories.map((c) => <Badge key={c} variant="outline">{categoryLabel(c)}</Badge>)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {member.email && <div><p className="text-sm font-medium text-muted-foreground">E-mail</p><p className="break-all">{member.email}</p></div>}
              {member.phone && <div><p className="text-sm font-medium text-muted-foreground">Telefone</p><p>{member.phone}</p></div>}
              {member.birthDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nascimento</p>
                  <p>
                    {formatBirthday(member.birthDate)}
                    {age !== null && <span className="text-muted-foreground"> · {age} anos</span>}
                  </p>
                </div>
              )}
              {member.formationTrack && <div><p className="text-sm font-medium text-muted-foreground">Trilha de Formação</p><p>{member.formationTrack}</p></div>}
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
                {/* Foto de perfil */}
                <div className="flex items-center gap-4">
                  <MemberAvatar name={member.name} avatarPath={previewAvatarPath} className="h-16 w-16 text-lg" />
                  <div className="flex flex-wrap items-center gap-2">
                    <ObjectUploader
                      onGetUploadParameters={handleGetUploadParams}
                      onComplete={handleUploadComplete}
                      maxNumberOfFiles={1}
                      maxFileSize={10 * 1024 * 1024}
                      buttonClassName="inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                    >
                      Alterar foto
                    </ObjectUploader>
                    {previewAvatarPath && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-muted-foreground"
                        onClick={() => setAvatarDraft(null)}
                      >
                        <X className="h-4 w-4 mr-1" /> Remover foto
                      </Button>
                    )}
                  </div>
                </div>

                <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" disabled={!isLeader} />
                    </FormControl>
                    {!isLeader && (
                      <p className="text-xs text-muted-foreground">
                        Só o líder altera o e-mail — é o canal de acesso ao app.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="birthDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data de nascimento
                      {editedAge !== null && (
                        <span className="ml-2 font-normal text-muted-foreground">({editedAge} anos)</span>
                      )}
                    </FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {!isGuest && (
                  <FormField control={editForm.control} name="formationTrack" render={({ field }) => (
                    <FormItem><FormLabel>Trilha de Formação</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}

                {member.status === "member" && isLeader && (
                  <FormField control={editForm.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="auxiliary">Auxiliar</SelectItem>
                          <SelectItem value="leader">Líder</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {!isGuest && (
                  <FormField control={editForm.control} name="categories" render={() => (
                    <FormItem>
                      <FormLabel>Categorias</FormLabel>
                      <div className="space-y-2">
                        {["host", "discipler", "disciple"].map((item) => (
                          <FormField key={item} control={editForm.control} name="categories" render={({ field }) => {
                            return (
                              <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item as any)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), item])
                                        : field.onChange(field.value?.filter((value) => value !== item))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {categoryLabel(item)}
                                </FormLabel>
                              </FormItem>
                            )
                          }} />
                        ))}
                      </div>
                    </FormItem>
                  )} />
                )}

                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button type="button" variant="destructive" size="sm" className="rounded-full" onClick={onDelete}>
                    <Trash className="h-4 w-4 mr-2" /> Remover
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" className="rounded-full" onClick={cancelEditing}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="rounded-full" disabled={updating}>
                      {updating ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        )}
      </Card>

      {/* Convidados não participam de discipulado (bloqueado pela API) */}
      {!isGuest && <DiscipleshipSection memberId={member.id} isLeader={isLeader} />}
    </div>
  );
}
