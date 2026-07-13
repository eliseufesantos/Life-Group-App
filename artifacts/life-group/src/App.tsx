import { AuthGate } from "@/components/auth-gate";
import { Layout } from "@/components/layout";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Register from "@/pages/register";
import Verify from "@/pages/verify";
import Members from "@/pages/members";
import MemberDetail from "@/pages/member-detail";
import Discipleship from "@/pages/discipleship";
import Invites from "@/pages/invites";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Calendar from "@/pages/calendar";
import Board from "@/pages/board";
import Campanhas from "@/pages/campanhas";
import Relatorios from "@/pages/relatorios";
import CelulaConfig from "@/pages/celula";
import Notificacoes from "@/pages/notificacoes";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/entrar/:code" component={Register} />
      <Route path="/verificar" component={Verify} />
      <Route>
        <AuthGate>
          <Layout>
            <Switch>
              <Route path="/" component={Board} />
              <Route path="/mural" component={Board} />
              <Route path="/calendario" component={Calendar} />
              <Route path="/membros" component={Members} />
              <Route path="/membros/:id" component={MemberDetail} />
              <Route path="/discipulado" component={Discipleship} />
              <Route path="/convites" component={Invites} />
              <Route path="/perfil" component={Profile} />
              <Route path="/configuracoes" component={Settings} />
              <Route path="/campanhas" component={Campanhas} />
              <Route path="/relatorios" component={Relatorios} />
              <Route path="/celula" component={CelulaConfig} />
              <Route path="/notificacoes" component={Notificacoes} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </AuthGate>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
