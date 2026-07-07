# PRD — Life Group App
**Versão:** 1.0
**Tipo de release:** MVP funcional (single-tenant, uma célula)
**Formato:** PWA instalável
**Data:** Julho/2026

---

## 1. Objetivo do produto

Registrar e comunicar informação relevante do Life Group (célula) e automatizar dados e relatórios que hoje são geridos manualmente pelo líder e auxiliares.

A v1.0 resolve as dores operacionais de **uma única célula**. Multi-tenant (múltiplas células/igrejas), integrações externas (WhatsApp) e recursos exploratórios (mapas interativos) ficam fora de escopo — ver seção 9.

---

## 2. Escopo da v1.0

Todas as quatro frentes abaixo entram na v1.0. A ordem é de **construção**, não de prioridade — cada módulo consome dado gerado pelo anterior:

1. Cadastro, papéis e permissões (base de tudo)
2. Calendário + divisão de tarefas semanais
3. Discipulado
4. Relatórios + doações/campanhas (consome dado dos três anteriores)

---

## 3. Papéis e permissões

### 3.1 Papéis primários (mutuamente exclusivos)
| Papel | Descrição |
|---|---|
| Líder | Administrador da célula |
| Auxiliar | Apoia o líder, com permissões delegadas |
| Membro | Participante regular |
| Convidado | Registro informativo feito pelo líder/auxiliar. **Sem acesso ao app** (não loga, não recebe notificação). Existe só como dado para relatórios. |

### 3.2 Categorias adicionais (não exclusivas, aplicáveis a qualquer membro)
| Categoria | Descrição |
|---|---|
| Anfitrião | Disponibiliza o espaço para reuniões/eventos |
| Discipulador | Discipula outro(s) membro(s) |
| Discípulo | Recebe discipulado |

> Regra de negócio: 1 discipulador → 0 ou N discípulos.

### 3.3 Matriz de permissões

| Ação | Líder | Auxiliar | Membro | Convidado |
|---|:---:|:---:|:---:|:---:|
| Nomear auxiliares | ✅ | ❌ | ❌ | — |
| Nomear anfitriões | ✅ | ❌ | ❌ | — |
| Aceitar inscrição de novos membros | ✅ | ❌ | ❌ | — |
| Cadastrar convidados (registro informativo) | ✅ | ✅ | ❌ | — |
| Definir/dividir tarefas semanais | ✅ (decide) | ✅ (divide, aprovação do líder) | ❌ | — |
| Acessar dados de todos os membros | ✅ | ✅ | ❌ | — |
| Adicionar informações de membros (trilhas etc.) | ✅ | ✅ | ❌ | — |
| Nomear/relacionar discipulador ↔ discípulo | ✅ | ❌ | ❌ | — |
| Adicionar eventos no calendário | ✅ | ✅ | ❌ | — |
| Cadastrar tipo de doação/campanha atual | ✅ | ✅ | ❌ | — |
| Acessar info do life (local, eventos, horários, membros) | ✅ | ✅ | ✅ | — |
| Participar de enquetes/votações/checklists | ✅ | ✅ | ✅ | — |
| Postar fotos | ✅ | ✅ | ✅ | — |

**Convidado (—):** não tem login nem acesso ao app. É apenas um registro (nome, telefone, quem convidou, data) feito pelo líder/auxiliar, usado para compor os relatórios (nº de convidados, taxa de conversão a membro).

---

## 4. Requisitos funcionais

### RF-1 — Cadastro, papéis e permissões
- RF-1.1: Novo membro entra via **código de convite** gerado pelo líder + cadastro simples (nome, telefone) — este membro passa a ter login/acesso ao app.
- RF-1.1.1: Login de retorno (novo dispositivo/sessão expirada) é feito via **telefone + código OTP** enviado por SMS ou WhatsApp.
- RF-1.2: Líder/auxiliar cadastra **convidado** diretamente pelo menu Membros (nome, telefone, quem convidou, data) — registro informativo, **sem** login/acesso ao app.
- RF-1.3: Líder/auxiliar promove um convidado a membro a partir do próprio perfil dele — o telefone já cadastrado no registro de convidado passa a ser o canal de login (OTP), sem necessidade de novo cadastro. A partir da promoção, o perfil passa a receber tags e demais informações do app.
- RF-1.4: Líder nomeia auxiliares e anfitriões.
- RF-1.5: Líder/auxiliar edita atributos do membro (trilha de formação atual, categorias adicionais).
- RF-1.6: Import de membros via **CSV** (cadastro em lote).

### RF-2 — Calendário
- RF-2.1: Líder/auxiliar cria, edita e apaga eventos de categoria livre (texto definido por eles no momento da criação, sem lista fixa).
- RF-2.2: O encontro semanal regular é **automático** — o líder configura uma única vez o dia da semana e o horário padrão, e o sistema gera o evento recorrente toda semana, sem necessidade de criação manual.
- RF-2.3: Líder/auxiliar pode ajustar uma ocorrência pontual do encontro semanal (ex.: mudança de local numa semana específica) sem alterar a recorrência padrão.
- RF-2.4: Membros visualizam o calendário.

### RF-3 — Discipulado
> Discipulado **não é um menu próprio**. É uma tag (Discipulador/Discípulo) e um vínculo, expostos dentro do perfil do membro — ver seção 8.
- RF-3.1: Líder cria/edita relações discipulador ↔ discípulo (1:N), a partir do perfil do membro.
- RF-3.2: Discipulador registra progresso/observações do discípulo, no próprio perfil do discípulo.
- RF-3.3: Líder/auxiliar visualiza, na lista de membros, quem é discipulador de quem (filtro/coluna, não uma tela separada).

### RF-4 — Mural
- RF-4.1: Mural de avisos — líder/auxiliar publica, todos veem.
- RF-4.2: Enquetes/votações — membros participam, líder/auxiliar cria.
- RF-4.3: Escala de tarefas semanais — líder decide; auxiliar propõe divisão sujeita a aprovação do líder; membros veem e marcam sua tarefa como feita.
- RF-4.4: Informações do encontro atual (local, dia/horário) — refletem automaticamente o evento semanal recorrente do Calendário (RF-2.2), sem cadastro duplicado.
- RF-4.5: Postagem de fotos do encontro, por membros.

### RF-5 — Notificações
- RF-5.1: Notificações **in-app + push (Web Push/PWA)** para eventos, tarefas atribuídas e avisos do líder.
- RF-5.2: Membro ativa/desativa push individualmente (RF-8.3).

### RF-6 — Doações e campanhas
- RF-6.1: Líder ou auxiliar cria, mantém ou encerra campanhas (tipo — dinheiro, itens como cesta básica, ou ambos —, título, descrição, período). É comum haver uma campanha fixa/recorrente (ex.: item de cesta básica), mantida enquanto o líder decidir.
- RF-6.2: Líder/auxiliar registra os **itens obtidos e as quantidades** por campanha, de forma agregada (ex.: "12 unidades de desinfetante").
- RF-6.3: **A identidade de quem entregou é sempre anônima** — o app não coleta nem armazena essa informação em nenhuma hipótese.
- RF-6.4: **O app nunca processa transações financeiras** — se a campanha envolver dinheiro, não há registro de valores individuais nem meio de pagamento.
- RF-6.5: Campanha pode exibir um link/QR code do ministério de doação responsável, para facilitar o acesso externo (fora do app).

### RF-7 — Relatórios automatizados
- RF-7.1: Relatório consolidado contendo: frequência/participação, progresso de discipulado, atualizações relevantes de membros, e itens/quantidades arrecadados por campanha. **Nunca inclui identidade de quem doou** (ver RF-6.3) nem valores financeiros individuais (RF-6.4).
- RF-7.2: Geração automática **mensal** (dentro do app).
- RF-7.3: Geração **sob demanda**, a qualquer momento.
- RF-7.4: **Exportação em CSV** de qualquer relatório gerado.

### RF-8 — Configurações do app
- RF-8.1: Idioma (padrão pt-BR).
- RF-8.2: Tema (claro/escuro).
- RF-8.3: Preferência de notificação push (ativar/desativar).

---

## 5. Requisitos não funcionais

| Categoria | Requisito |
|---|---|
| Plataforma | PWA instalável (manifest + service worker) |
| Disponibilidade offline | Não obrigatória na v1 — cache mínimo de shell da PWA é suficiente |
| Notificações | Web Push via VAPID (nativo do browser, sem dependência de terceiro) |
| Privacidade/LGPD | Nome, tags e vínculo de discipulado são visíveis a todos os membros — contato e trilha de formação ficam restritos a líder/auxiliar. Aviso de privacidade e consentimento no cadastro precisam deixar essa exposição clara, mesmo em escala pequena |
| Exportação/Importação | CSV para relatórios (export) e membros (import) |
| Hospedagem | Replit |

---

## 6. Arquitetura técnica proposta

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (App Router) | Front + back no mesmo projeto, suporte nativo a PWA, roda bem em processo único no Replit |
| Banco de dados | PostgreSQL | Modelo relacional se beneficia de FKs bem definidas (líder → membros → discipulado → eventos) |
| ORM | Prisma | Já usado em outros projetos seus, produtividade alta com Postgres |
| Notificações | Web Push API (VAPID) | Nativo do browser, zero custo, sem infra extra |
| Autenticação | Código de convite (1º acesso) + OTP via SMS/WhatsApp (login de retorno) | Sem senha pra gerenciar; adequado a um grupo pequeno que prioriza simplicidade |

### 6.1 Validação da stack no Replit

A combinação se sustenta. Pontos confirmados e ressalvas:

- **Replit + Next.js**: o agente do Replit já lida nativamente com scaffolding de apps Next.js completos (rotas, API, deploy) — não é um caminho improvisado.
- **PostgreSQL no Replit**: banco Postgres nativo, provisionado em segundos, sem configuração de serviço externo — remove a necessidade de contratar um Postgres gerenciado à parte.
- **Prisma — atenção à versão**: a partir do Prisma 7, a URL de conexão sai do `datasource` em `schema.prisma` e vai para um `prisma.config.ts` separado, usando o adapter `@prisma/adapter-pg`. Tutoriais antigos (Prisma 5/6) mostram a sintaxe velha — ao pedir para o Replit Agent gerar isso, confirme a versão do Prisma instalada para não misturar sintaxe.
- **Web Push (VAPID) no Replit**: funciona, mas depende de o deploy ter HTTPS — o Replit fornece isso automaticamente ao publicar (Deployments), então isso só é resolvido **depois do deploy**, não no ambiente de desenvolvimento local do Replit.
- **Ressalva de plataforma, não do Replit**: push via PWA no iOS exige que o app já esteja instalado na tela de início — no navegador (Safari aberto), push não funciona. Se parte dos membros da célula usa iPhone, o mural in-app (RF-4.1) precisa ser a fonte confiável de aviso, não só o push.
- **OTP por SMS/WhatsApp é uma dependência nova, paga**: diferente do Web Push (gratuito), enviar código por SMS ou WhatsApp exige um provedor externo (ex.: Twilio, Zenvia) com custo por mensagem. Isso é uma peça de infra adicional que não existia antes desta decisão — vale considerar no orçamento do projeto.

---

## 7. Modelo de dados (entidades principais)

- **Usuario**: id, nome, telefone (contato + canal de OTP para login), papel_principal, categorias[], trilha_atual, data_ingresso, ativo
- **RelacaoDiscipulado**: discipulador_id, discipulo_id, data_inicio, status, observacoes
- **Evento**: id, titulo, tipo (**texto livre**, definido pelo líder/auxiliar na criação), data, local, anfitriao_id, criado_por, recorrente (bool, true para o encontro semanal)
- **Tarefa**: id, evento_id, descricao, responsavel_id, status
- **Campanha**: id, tipo (dinheiro/itens/ambos), titulo, descricao, periodo, ativa, link_doacao (opcional, URL/QR do ministério)
- **ItemArrecadado**: id, campanha_id, item, quantidade, data_registro, registrado_por (líder/auxiliar que registrou — **nunca** referência ao doador)
- **Enquete**: id, titulo, opcoes[], votos[]
- **Foto**: id, url, autor_id, evento_id, data
- **Relatorio**: id, tipo, periodo, gerado_em, dados_json, csv_url

---

## 8. Arquitetura de telas (menus e navegação)

Convidado não navega no app (sem login), então a IA abaixo é só para Líder, Auxiliar e Membro.

### 8.1 Navegação principal (bottom nav — igual para todos os papéis)

**Início · Calendário · Mural · Membros**

Acesso a Perfil/Administração/Configurações fica num ícone de perfil no topo da tela (não compete por espaço com a navegação do dia a dia).

### 8.2 Ícone de perfil (topo da tela)

- **Meu perfil**: dados pessoais, tags (se aplicável), vínculo de discipulado (se for discipulador/discípulo).
- **Administração** (só aparece para Líder/Auxiliar): nomeação de auxiliares/anfitriões, Doações/Campanhas, Relatórios. Fica **separada** de Configurações — é sobre o cargo, não sobre o app.
- **Configurações** (todos): idioma, tema, ativar/desativar notificação push.

### 8.3 Conteúdo de cada tela

- **Início**: compila o essencial — próximo encontro (dia/horário/local, puxado automaticamente do evento recorrente), destaques do calendário e notificações recentes.
- **Calendário**: eventos (criar, editar, apagar, múltiplas categorias); o encontro semanal é configurado uma vez pelo líder (dia + horário) e recorre automaticamente, sem recriação manual.
- **Mural**: avisos, enquetes/votações, escala de tarefas semanais, informações do encontro atual (espelha o evento recorrente do Calendário) e fotos do encontro.
- **Membros**: lista única de membros e convidados (com status/filtro Membro × Convidado). Líder/auxiliar adiciona convidado direto por aqui e, depois, promove o mesmo perfil a membro — sem cadastro duplicado. Líder/auxiliar veem tudo (contato, trilha, tags, vínculo de discipulado); membro vê **nome + todas as tags (incl. vínculo de discipulado)**, mas sem contato nem trilha de formação de outros membros.
- **Perfil do membro** (aberto a partir da lista): dados básicos, trilha atual, tags (Anfitrião/Discipulador/Discípulo) e, quando aplicável, o vínculo de discipulado — **é aqui que o discipulado vive, não em um menu à parte**. Para Membro comum visualizando o perfil de outro, só nome e tags/vínculo aparecem.

### 8.4 Ordem de construção sugerida

Sequência técnica, por dependência de dado (não por menu):

1. Autenticação: convite do líder → cadastro do membro
2. Perfil de membro (CRUD, trilha, tags, vínculo de discipulado) + cadastro/promoção de convidado
3. Lista de Membros (visão líder/auxiliar completa + visão membro básica, incluindo convidados)
4. Calendário (eventos + encontro semanal automático)
5. Mural (avisos, enquetes, escala de tarefas, info do encontro, fotos) — depende do Calendário pra puxar a info do encontro
6. Doações/Campanhas (cadastro informativo + link/QR)
7. Relatórios + exportação CSV (só faz sentido depois que 2–6 têm dado real)
8. Início — construído por último, pois só compila dado que já existe nas telas 4 e 5
9. Configurações (idioma, tema, notificações)

---

## 9. Fora de escopo (v1.0)

- Multi-tenant (múltiplas células/igrejas)
- Integração com WhatsApp
- Processamento financeiro de transações de doação — o app registra itens/quantidades arrecadados, nunca movimenta dinheiro nem identifica doador
- Mapas interativos / recursos de exploração
- App nativo (iOS/Android) — fica só PWA

---

## 10. Roadmap (referência, fora do PRD v1.0)

- **v2**: multi-tenant, múltiplos níveis de organização (rede de células)
- **v3**: mapas interativos, recursos de exploração

---

## 11. Critérios de aceite da v1.0

- Líder consegue cadastrar/gerenciar membros, papéis e categorias adicionais.
- Líder/auxiliar cadastra convidado direto na tela de Membros e promove o mesmo perfil a membro, sem cadastro duplicado.
- Encontro semanal é gerado automaticamente a partir da configuração única de dia/horário do líder.
- Membro faz login de retorno via telefone + OTP (SMS/WhatsApp), sem precisar de senha.
- Membros comuns veem nome e todas as tags (incl. vínculo de discipulado) de qualquer membro, sem acessar contato nem trilha de formação.
- Líder/auxiliar cria categorias de evento livremente, sem lista fixa pré-definida.
- Mural exibe avisos, enquetes, escala de tarefas e informações do encontro atual sem exigir cadastro paralelo ao Calendário.
- Relações de discipulado são criadas e visualizáveis dentro do perfil do membro.
- Itens e quantidades arrecadados por campanha são registrados e entram no relatório; identidade de quem doou nunca é coletada.
- Relatório consolidado gerado mensalmente e sob demanda, exportável em CSV.
- Import de membros via CSV funcional.
- Notificações push chegam para eventos/tarefas/avisos, com opção de desativar em Configurações.
- App instalável como PWA em dispositivo móvel.
