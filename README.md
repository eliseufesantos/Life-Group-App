# Life Group App

Aplicativo para gestão de um **Life Group** (grupo pequeno / célula de igreja): comunicação, agenda, pessoas, fotos, doações e registros dos encontros — tudo em um só lugar, instalável no celular.

Este README tem duas partes: a primeira explica **o que o app faz**, para qualquer pessoa do grupo; a segunda é a **documentação técnica**, para quem desenvolve.

---

## Parte 1 — O que é o Life Group App

Se você participa de um Life Group, sabe como a organização se espalha: aviso num grupo de mensagens, escala de lanche numa planilha, fotos perdidas no celular de alguém, presença anotada num caderno. O Life Group App junta tudo isso num aplicativo simples, pensado para o dia a dia de **um** grupo.

Ele é um **PWA** — um app que você instala direto do navegador na tela inicial do celular, sem loja de aplicativos, e que envia notificações como qualquer outro app.

### As 3 abas

O app inteiro cabe em três abas fixas no rodapé:

| Aba | O que você encontra |
|---|---|
| **Mural** | O coração do app: avisos (manuais e automáticos), enquetes, a escala de tarefas da semana, as informações do próximo encontro (local, dia e horário) e os álbuns de fotos. |
| **Agenda** | O calendário do grupo: o encontro semanal aparece automaticamente toda semana, e o líder ou auxiliar pode criar outros eventos (confraternização, ação social, o que for). |
| **Perfil** | Seus dados e tudo que é "do grupo": lista de Pessoas, Registros dos encontros, Doações/Campanhas, Relatórios e Configurações (tema, notificações). |

### Quem é quem (papéis)

| Papel | O que pode fazer |
|---|---|
| **Líder** | Administra tudo: nomeia auxiliares e anfitriões, aprova registros de encontro, cria vínculos de discipulado, gera convites e relatórios. |
| **Auxiliar** | Apoia o líder: publica avisos, cria eventos e campanhas, cadastra convidados, monta a escala de tarefas e cria registros de encontro (que ficam aguardando a aprovação do líder). |
| **Membro** | Participa: vê o mural e a agenda, vota em enquetes, marca a própria tarefa como feita, posta fotos e vê quem é quem no grupo. |
| **Convidado** | **Não tem acesso ao app.** É apenas um cadastro (nome, telefone, quem convidou) feito pelo líder ou auxiliar, para que a presença dele nos encontros conte nos relatórios. Quando o convidado vira membro de fato, o mesmo cadastro é promovido — sem recomeçar do zero. |

### O que o app faz, em uma frase cada

- **Avisos** — líder e auxiliar publicam recados no mural, e o próprio app publica avisos automáticos (aniversário de alguém, campanha nova, registro aguardando aprovação).
- **Enquetes** — votações no estilo dos grupos de mensagem, com opção de enquete **anônima** e **prazo de encerramento**.
- **Tarefas da semana** — cada tarefa (lanche, louvor, palavra...) é sempre atribuída a **uma pessoa específica**, que recebe notificação e marca quando concluir.
- **Calendário** — o encontro semanal é configurado uma única vez e aparece sozinho toda semana; outros eventos são criados livremente.
- **Álbuns de fotos** — as fotos ficam organizadas por evento, seja por upload direto, seja por link de pasta do Google Drive.
- **Campanhas de doação** — o grupo organiza arrecadações (itens, dinheiro ou ambos) registrando apenas o que foi arrecadado; o app **nunca movimenta dinheiro e nunca identifica quem doou**.
- **Discipulado** — o vínculo discipulador/discípulo vive no perfil de cada pessoa, inclusive quando um dos lados é de **outro** Life Group.
- **Aniversários** — no dia do aniversário de um membro, o mural ganha um aviso automático e todo mundo recebe notificação.
- **Registro de Encontro** — depois de cada encontro, líder ou auxiliar registra quem esteve presente (membros e convidados), as atividades realizadas e sua duração, a foto do dia e os itens arrecadados; registros feitos pelo auxiliar passam pela aprovação do líder.
- **Relatórios** — todo mês o app gera sozinho um relatório com frequência, discipulado e arrecadações (e dá para gerar na hora, quando quiser).
- **Notificações** — avisos importantes chegam como notificação no celular, e cada pessoa escolhe se quer recebê-las.
- **Entrar sem senha** — o acesso é por **link mágico**: você informa seu e-mail, recebe um link e pronto — não existe senha para esquecer.

---

## Parte 2 — Documentação técnica

> Fonte da verdade do produto: [`attached_assets/PRD_LifeGroupApp_v1_1783402129430.md`](attached_assets/PRD_LifeGroupApp_v1_1783402129430.md) (PRD v1.1). Notas operacionais do repositório: [`replit.md`](replit.md).

### Stack

| Camada | Escolha |
|---|---|
| Workspace | **pnpm workspaces** + Node.js 24 + TypeScript 5.9 (project references, `tsc --build`) |
| API | **Express 5** (bundle CJS via esbuild, logs com pino) |
| Banco | **PostgreSQL** + **Drizzle ORM** (`drizzle-kit push` em dev) |
| Validação | **Zod v4** (`zod/v4`) + **drizzle-zod** nos schemas do banco |
| Contrato de API | **OpenAPI-first**: `lib/api-spec/openapi.yaml` é o contrato; **Orval** gera cliente React (TanStack Query) em `lib/api-client-react` e schemas Zod em `lib/api-zod` |
| Frontend | **Vite + React 19** + **Tailwind v4** + shadcn/ui (Radix) + roteamento com **wouter** |
| PWA | `manifest.webmanifest` + service worker (`sw.js`) em `artifacts/life-group/public` |
| Push | **Web Push com VAPID** (`web-push`; chaves persistidas no banco) |
| E-mail | **Resend** (transacional: magic link e convite). Em dev (`NODE_ENV !== "production"`), a API devolve o link no campo `devLink` da resposta — dá para testar sem e-mail configurado |
| Uploads | Object storage (Google Cloud Storage via `@google-cloud/storage`; Uppy no frontend) |
| Hospedagem alvo | **Replit** (Postgres nativo, HTTPS automático no deploy) |

### Estrutura do monorepo

| Pasta | Responsabilidade |
|---|---|
| `lib/db` | Schema Drizzle do Postgres (`src/schema/*.ts`, uma tabela por arquivo) + schemas de insert via drizzle-zod. Fonte editada à mão. |
| `lib/api-spec` | `openapi.yaml` — o **contrato** da API, editado à mão — e a configuração do Orval (`orval.config.ts`, script `codegen`). |
| `lib/api-client-react` | Hooks TanStack Query do cliente React. **GERADO pelo Orval — nunca editar à mão** (exceção: `custom-fetch.ts`). |
| `lib/api-zod` | Schemas Zod dos tipos da API (usados pelo servidor para validar request/response). **GERADO pelo Orval — nunca editar à mão.** |
| `lib/object-storage-web` | Helper de upload para object storage no browser. |
| `artifacts/api-server` | Servidor Express: rotas em `src/routes/*`, automações/push/e-mail/relatórios em `src/lib/*`, montado sob `/api`. |
| `artifacts/life-group` | Frontend PWA (Vite + React). Design system em `src/index.css`; layout de 3 abas em `src/components/layout.tsx`. |
| `scripts` | Scripts utilitários do workspace (ex.: `post-merge.sh`). |
| `attached_assets` | PRD e anexos de produto. |

### Fluxo de desenvolvimento

Mudança na API (contrato primeiro, sempre):

```bash
# 1. Edite o contrato
#    lib/api-spec/openapi.yaml

# 2. Regenere cliente + schemas Zod (também roda o typecheck das libs)
pnpm --filter @workspace/api-spec run codegen

# 3. Implemente a rota em artifacts/api-server/src/routes/

# 4. Typecheck completo do workspace
pnpm run typecheck
```

Mudança no schema do banco (dev):

```bash
# Edite lib/db/src/schema/*.ts e aplique direto no banco:
pnpm --filter @workspace/db run push
```

Rodar e buildar:

```bash
pnpm --filter @workspace/api-server run dev   # build + start da API (porta via PORT; padrão do projeto: 5000)
pnpm --filter @workspace/life-group run dev   # dev server do frontend (Vite)
pnpm run build                                # typecheck + build de todos os pacotes
```

Variáveis de ambiente:

| Variável | Obrigatória? | Uso |
|---|---|---|
| `DATABASE_URL` | **Sim** | String de conexão Postgres. |
| `PORT` | Sim (API e Vite) | Porta do servidor; o `index.ts` da API falha sem ela. |
| `SEED_LEADER_NAME` / `SEED_LEADER_EMAIL` | Opcional | No boot, se não existir nenhum líder, semeia (ou promove) o líder inicial. |
| `RESEND_API_KEY` | Opcional | Envio real de e-mail via Resend; sem ela, em dev, use o `devLink` retornado pela API. |
| `REPLIT_DEV_DOMAIN` | Opcional | Base dos links de magic link/convite (fallback: `http://localhost:5000`). |
| `BASE_PATH` | Opcional (Vite) | Base path do frontend em dev (`/` localmente). |

#### Nota para Windows

O repo foi criado para Replit/Linux. Localmente no Windows: use `corepack enable pnpm` (pnpm 11) e prefixe o `PATH` com `C:\Program Files\Git\usr\bin` antes de `pnpm install` — o script `preinstall` da raiz usa `sh`.

### Modelo de dados (tabelas)

| Tabela | O que guarda |
|---|---|
| `usuarios` | Todas as pessoas — membros **e** convidados (`status: member \| guest`), com papel (`role`), categorias/tags, trilha, nascimento, avatar. |
| `sessoes` | Sessões de login (token em cookie). |
| `magic_links` | Tokens de login de uso único, com expiração. |
| `convites` | Convites gerados pelo líder (nome obrigatório, código, expiração). |
| `relacoes_discipulado` | Vínculos discipulador ↔ discípulo; cada lado é FK interna **ou** nome externo em texto livre. |
| `eventos` | Eventos do calendário (categoria em texto livre) e overrides pontuais do encontro semanal. |
| `configuracao_recorrencia` | Dia da semana + horário do encontro semanal recorrente. |
| `configuracao_celula` | Configurações gerais do Life Group. |
| `tarefas` | Escala semanal; responsável (pessoa) obrigatório, status pendente/aprovada/feita. |
| `avisos` | Avisos do mural, manuais e automáticos (`origin: manual \| birthday \| campaign \| registro_pending` + `refId`). |
| `enquetes`, `opcoes_enquete`, `votos_enquete` | Enquetes com `endsAt` e flag `anonymous`; voto único por usuário (unique index). |
| `albuns`, `fotos` | Álbuns vinculados a evento; foto por upload ou link do Drive (`source_type: upload \| drive`). |
| `campanhas` | Campanhas de doação (tipo dinheiro/itens/ambos, período, link/QR externo). |
| `itens_arrecadados` | Itens e quantidades agregadas por campanha (opcionalmente ligados a um registro de encontro). Nunca referencia o doador. |
| `registros_encontro`, `presencas_registro`, `atividades_catalogo`, `atividades_registro` | Registro de Encontro: numeração sequencial (`seq`), status `pending \| published`, presenças (membros e convidados), catálogo de atividades (7 padrão; Comunhão sem duração) e atividades realizadas com responsável/duração. |
| `notificacoes` | Notificações in-app por usuário. |
| `subscricoes_push` | Subscriptions Web Push por dispositivo. |
| `chaves_vapid` | Par de chaves VAPID persistido. |
| `relatorios` | Relatórios gerados (mensais e sob demanda), dados em JSON + export CSV. |

### API

Todas as rotas ficam sob `/api` (montagem em `artifacts/api-server/src/app.ts`; agregação em `src/routes/index.ts`). Grupos:

`/healthz` · `/auth/*` (convites, registro, magic link, verify, logout) · `/members/*` (CRUD, import CSV, promoção de convidado, stats) · `/discipleship/*` · `/calendar/*` (recorrência, próximo encontro, eventos, overrides de ocorrência) · `/board/*` (avisos, enquetes + voto/encerramento, tarefas + aprovação/conclusão, fotos, álbuns) · `/registros/*` (+ catálogo de atividades, aprovação) · `/storage/*` (URLs de upload e objetos) · `/campaigns/*` (+ itens, encerramento) · `/reports/*` (+ geração, CSV) · `/push/*` (chave pública, subscribe/unsubscribe) · `/notifications/*` · `/cell`

### Domínio — regras que não são óbvias

- **Convidado é bloqueado na API, não só na UI**: usuário com `status = "guest"` não tem login, não recebe notificação e a API rejeita atribuição de papel, categoria ou trilha (ver `routes/members.ts`). Tags só passam a ser possíveis após a promoção a membro.
- **Fluxo do Registro de Encontro**: registro criado pelo **líder** é publicado direto; criado pelo **auxiliar** entra como `pending` até o líder aprovar. **Edição de auxiliar em registro já publicado devolve o registro a `pending`** e exige nova aprovação. A numeração é sequencial (`seq = max + 1`), exibida como "Life Group N".
- **Automações de aviso** (`api-server/src/lib/automations.ts` + `reportScheduler.ts`):
  - **Aniversário**: verificado por um scheduler **horário** no servidor e também de forma **lazy** no `GET /board/announcements` — se o job não rodou, o aviso sai no primeiro acesso ao mural do dia. Dedupe por `origin='birthday'` + `refId=userId` + data (America/Sao_Paulo).
  - **Campanha ativada**: aviso no mural + broadcast, uma única vez (dedupe por `origin='campaign'` + `refId`).
  - **Registro pendente**: aviso no mural (atualizado in-place se já existir) + notificação **pessoal** a todos os líderes; o aviso é removido quando o registro é aprovado/excluído.
  - **Regra de roteamento**: responsabilidade pessoal (tarefa atribuída, "seu registro está pendente") → notificação pessoal; informação geral (aniversário, campanha aberta) → aviso no mural + broadcast. Um mesmo evento pode acionar os dois canais.
- **Enquete expirada é DELETADA**: a listagem de enquetes executa `DELETE` das enquetes com `endsAt` no passado (votos caem em cascata). **Não existe histórico de enquetes** — decisão de produto documentada no PRD (RF-4.2.1).
- **Enquete anônima é anonimato de exibição**: a API/UI omitem os votantes, mas o voto continua associado ao usuário no banco (antifraude — unique index impede voto duplicado).
- **Fotos do Google Drive nunca são embed**: `source_type = "drive"` vira um card de link externo que abre o Drive fora do app (embed do Drive é instável — decisão de produto, RF-4.5).
- **Discipulado cruzado**: um lado do vínculo pode ser nome em texto livre (pessoa de outro Life Group, sem cadastro); pelo menos um lado precisa ser membro interno. Discipulado não tem tela própria — vive no perfil da pessoa.
- **Edição inline é a diretriz de UX do app**: "Editar" transforma os campos na própria tela/card, sem modal e sem navegação (perfil, avisos, registros — e qualquer edição futura).
- **Navegação é sempre 3 abas** (Mural / Agenda / Perfil): funcionalidade nova nunca ganha aba — entra como seção do Mural ou sub-página do Perfil.

### Segurança e privacidade

- Autenticação **sem senha**: convite (1º acesso) + magic link por e-mail (retorno); o link é de uso único e **expira em 30 minutos** (`MAGIC_LINK_TTL_MIN`).
- Sessões por **cookie** (tabela `sessoes`, `cookie-parser`).
- **Doações**: o app nunca processa transação financeira e nunca coleta/armazena a identidade de quem doou — `itens_arrecadados.registrado_por` referencia quem registrou (líder/auxiliar), nunca o doador.
- **Visibilidade de dados**: nome, tags e vínculo de discipulado são visíveis a todos os membros; **contato, data de nascimento e trilha de formação são restritos a líder/auxiliar**. A idade exibida é sempre derivada da data de nascimento (nunca armazenada).

### Deploy (Replit)

- Alvo de hospedagem é o **Replit** (Postgres nativo + Deployments com HTTPS automático).
- **Web Push exige HTTPS** — portanto push só funciona de fato após o deploy, não no ambiente local sem TLS.
- **iOS**: push em PWA só funciona com o app **instalado na tela de início** (no Safari aberto, não). Por isso o mural in-app é a fonte confiável de aviso, com o push como complemento.
