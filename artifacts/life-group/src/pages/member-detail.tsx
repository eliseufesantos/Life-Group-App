import { useParams, Link, useLocation } from "wouter";
import { useGetMember, useGetCurrentUser, useUpdateMember, useDeleteMember, getGetMemberQueryKey, usePromoteGuest } from "@workspace/api-client-react";
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
import { Trash, UserCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { roleLabel, categoryLabel } from "@/lib/labels";

const updateSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  formationTrack: z.string().optional(),
  role: z.enum(["leader", "auxiliary", "member"]).optional(),
  categories: z.array(z.enum(["host", "discipler", "disciple"])),
});

export default function MemberDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: user } = useGetCurrentUser();
  const isLeaderOrAux = user?.role === "leader" || user?.role === "auxiliary";

  const { data: member, isLoading } = useGetMember(Number(id), {
    query: { enabled: !!id, queryKey: getGetMemberQueryKey(Number(id)) }
  });

  const { mutate: updateMember, isPending: updating } = useUpdateMember();
  const { mutate: deleteMember } = useDeleteMember();
  const { mutate: promoteGuest, isPending: promoting } = usePromoteGuest();

  const [editOpen, setEditOpen] = useState(false);
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
    },
  });

  useEffect(() => {
    if (member) {
      editForm.reset({
        name: member.name || "",
        email: member.email || "",
        phone: member.phone || "",
        formationTrack: member.formationTrack || "",
        role: (member.role as any) || "member",
        categories: member.categories as any,
      });
    }
  }, [member, editForm]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!member) return <div className="p-6 text-center text-muted-foreground">Membro não encontrado</div>;

  const onUpdate = (data: z.infer<typeof updateSchema>) => {
    updateMember(
      { id: member.id, data: { ...data, email: data.email || undefined } as any },
      {
        onSuccess: () => {
          toast({ title: "Atualizado com sucesso" });
          queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(member.id) });
          setEditOpen(false);
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
          setPromoteOpen(false);
        },
        onError: () => toast({ variant: "destructive", title: "Erro ao promover" })
      }
    );
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <PageHeader
        title={member.name}
        subtitle={member.status === "member" ? "Membro" : "Convidado"}
        backHref="/membros"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Perfil</CardTitle>
          <div className="flex gap-2">
            {isLeaderOrAux && member.status === "guest" && (
              <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><UserCheck className="h-4 w-4 mr-2" /> Promover</Button>
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
            {isLeaderOrAux && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">Editar</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4 pt-4">
                      <FormField control={editForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editForm.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editForm.control} name="formationTrack" render={({ field }) => (
                        <FormItem><FormLabel>Trilha de Formação</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      
                      {member.status === "member" && (
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
                                    <FormLabel className="font-normal capitalize">
                                      {item === "host" ? "Anfitrião" : item === "discipler" ? "Discipulador" : "Discípulo"}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }} />
                            ))}
                          </div>
                        </FormItem>
                      )} />

                      <div className="flex justify-between pt-4">
                        <Button type="button" variant="destructive" onClick={onDelete}><Trash className="h-4 w-4 mr-2"/> Remover</Button>
                        <Button type="submit" disabled={updating}>Salvar</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={member.status === "member" ? "default" : "secondary"}>
              {member.status === "member" ? "Membro" : "Convidado"}
            </Badge>
            {member.role && <Badge variant="outline" className="border-primary/50 text-primary">{roleLabel(member.role)}</Badge>}
            {member.categories.map((c) => <Badge key={c} variant="outline">{categoryLabel(c)}</Badge>)}
          </div>
          {isLeaderOrAux && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              {member.email && <div><p className="text-sm font-medium text-muted-foreground">E-mail</p><p>{member.email}</p></div>}
              {member.phone && <div><p className="text-sm font-medium text-muted-foreground">Telefone</p><p>{member.phone}</p></div>}
              {member.formationTrack && <div><p className="text-sm font-medium text-muted-foreground">Trilha de Formação</p><p>{member.formationTrack}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Discipula</CardTitle></CardHeader>
          <CardContent>
            {member.disciples.length > 0 ? (
              <ul className="space-y-2">
                {member.disciples.map(d => (
                  <li key={d.id} className="text-sm"><Link href={`/membros/${d.discipleId}`} className="hover:underline text-primary">{d.discipleName}</Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Ninguém no momento.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Discipulado por</CardTitle></CardHeader>
          <CardContent>
            {member.disciplers.length > 0 ? (
              <ul className="space-y-2">
                {member.disciplers.map(d => (
                  <li key={d.id} className="text-sm"><Link href={`/membros/${d.disciplerId}`} className="hover:underline text-primary">{d.disciplerName}</Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Ninguém no momento.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
