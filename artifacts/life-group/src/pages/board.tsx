import { useGetCurrentUser } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Announcements } from "@/components/board/announcements";
import { Polls } from "@/components/board/polls";
import { Tasks } from "@/components/board/tasks";
import { Photos } from "@/components/board/photos";
import { MessageSquare, ListTodo, Image as ImageIcon, BarChart2 } from "lucide-react";

export default function Board() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-[400px] w-full rounded-xl mt-4" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Mural da Célula</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Avisos, enquetes, tarefas e fotos do nosso grupo.
        </p>
      </div>

      <Tabs defaultValue="avisos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
          <TabsTrigger value="avisos" className="data-[state=active]:bg-background flex flex-col sm:flex-row items-center gap-2 py-2 sm:py-1.5 h-auto">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">Avisos</span>
          </TabsTrigger>
          <TabsTrigger value="enquetes" className="data-[state=active]:bg-background flex flex-col sm:flex-row items-center gap-2 py-2 sm:py-1.5 h-auto">
            <BarChart2 className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">Enquetes</span>
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="data-[state=active]:bg-background flex flex-col sm:flex-row items-center gap-2 py-2 sm:py-1.5 h-auto">
            <ListTodo className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">Tarefas</span>
          </TabsTrigger>
          <TabsTrigger value="fotos" className="data-[state=active]:bg-background flex flex-col sm:flex-row items-center gap-2 py-2 sm:py-1.5 h-auto">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">Fotos</span>
          </TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="avisos" className="m-0 focus-visible:outline-none">
            <Announcements user={user!} />
          </TabsContent>
          <TabsContent value="enquetes" className="m-0 focus-visible:outline-none">
            <Polls user={user!} />
          </TabsContent>
          <TabsContent value="tarefas" className="m-0 focus-visible:outline-none">
            <Tasks user={user!} />
          </TabsContent>
          <TabsContent value="fotos" className="m-0 focus-visible:outline-none">
            <Photos user={user!} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}