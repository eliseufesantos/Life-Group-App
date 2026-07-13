# PRD — Life Group App
**Versão:** 1.1
**Tipo de release:** MVP funcional (single-tenant, um Life Group)
**Formato:** PWA instalável
**Data:** Julho/2026

> **Nota de terminologia:** o termo "célula", usado em versões anteriores deste documento, foi **descontinuado**. A unidade de grupo chama-se exclusivamente **Life Group** — no produto, na UI e nesta especificação.

---

## 1. Objetivo do produto

Registrar e comunicar informação relevante do Life Group e automatizar dados e relatórios que hoje são geridos manualmente pelo líder e auxiliares.

A v1.1 resolve as dores operacionais de **um único Life Group**. Multi-tenant (múltiplos Life Groups/igrejas), integrações externas (WhatsApp) e recursos exploratórios (mapas interativos) ficam fora de escopo — ver seção 9.

---

## 2. Escopo da v1.1

Todas as cinco frentes abaixo entram na v1.1. A ordem é de **construção**, não de prioridade — cada módulo consome dado gerado pelo anterior:

1. Cadastro, papéis e permissões (base de tudo)
2. Calendário + divisão de tarefas semanais
3. Discipulado
4. Doações/campanhas + Relatórios (consome dado dos três anteriores)
5. Registro de Encontro (consome cadastro, calendário, álbuns e campanhas; alimenta os relatórios)

---

## 3. Papéis e permissões

### 3.1 Papéis primários (mutuamente exclusivos)
| Papel | Descrição |
|---|---|
| Líder | Administrador do Life Group |
| Auxiliar | Apoia o líder, com permissões delegadas |
| Membro | Participante regular |
| Convidado | Registro informativo feito pelo líder/auxiliar. **Sem acesso ao app** (não loga, não recebe notificação). Existe só como dado para relatórios. |

### 3.2 Categorias adicionais (não exclusivas, aplicáveis a Líder, Auxiliar ou Membro)
| Categoria | Descrição |
|---|---|
| Anfitrião | Disponibiliza o espaço para reuniões/eventos |
| Discipulador | Discipula outro(s) membro(s) |
| Discípulo | Recebe discipulado |

> Regra de negócio: 1 discipulador → 0 ou N discípulos.

> **Convidado nunca recebe categorias/tags nem funções.** Enquanto o status for Convidado, a atribuição de Anfitrião/Discipulador/Discípulo e a alocação em tarefas ficam **bloqueadas na UI** (controles ocultos/desabilitados) **e na API** (requisições rejeitadas). As tags só se tornam possíveis após a promoção a membro (RF-1.3).

### 3.3 Matriz de permissões

| Ação | Líder | Auxiliar | Membro | Convidado |
|---|:---:|:---:|:---:|:---:|
| Nomear auxiliares | ✅ | ❌ | ❌ | — |
| Nomear anfitriões | ✅ | ❌ | ❌ | — |
| Aceitar inscrição de novos membros | ✅ | ❌ | ❌ | — |
| Cadastrar convidados (registro informativo) | ✅ | ✅ | ❌ | — |
| Definir/dividir tarefas semanais | ✅ (decide) | ✅ (divide, aprovação do líder) | ❌ | — |
| Publicar e **editar** avisos do mural | ✅ | ✅ | ❌ | — |
| Acessar dados de todos os membros | ✅ | ✅ | ❌ | — |
| Adicionar informações de membros (trilhas etc.) | ✅ | ✅ | ❌ | — |
| Nomear/relacionar discipulador ↔ discípulo | ✅ | ❌ | ❌ | — |
| Adicionar eventos no calendário | ✅ | ✅ | ❌ | — |
| Cadastrar tipo de doação/campanha atual | ✅ | ✅ | ❌ | — |
| Criar/editar Registro de Encontro (RF-9) | ✅ (publica direto) | ✅ (fica pendente) | ❌ | — |
| Aprovar Registro de Encontro pendente | ✅ | ❌ | ❌ | — |
| Acessar info do Life Group (local, eventos, horários, membros) | ✅ | ✅ | ✅ | — |
| Participar de enquetes/votações/checklists | ✅ | ✅ | ✅ | — |
| Postar fotos | ✅ | ✅ | ✅ | — |

**Convidado (—):** não tem login nem acesso ao app. É apenas um registro (nome, telefone, quem convidou, data) feito pelo líder/auxiliar, usado para compor os relatórios (nº de convidados, taxa de conversão a membro). Não recebe tags nem funções em nenhuma hipótese enquanto for Convidado — ver nota da seção 3.2.

---

## 4. Requisitos funcionais

### RF-1 — Cadastro, papéis e permissões
- RF-1.1: Novo membro entra via **código de convite** gerado pelo líder + cadastro simples (nome, e-mail; telefone opcional como contato) — este membro passa a ter login/acesso ao app.
- RF-1.1.1: Login de retorno (novo dispositivo/sessão expirada) é feito via **e-mail + magic link**: o membro informa o e-mail cadastrado e recebe um link de acesso de uso único, com expiração. Não há senha em nenhum fluxo.
- RF-1.2: Líder/auxiliar cadastra **convidado** diretamente pela lista de Pessoas (nome, telefone, quem convidou, data) — registro informativo, **sem** login/acesso ao app.
- RF-1.3: Líder/auxiliar promove um convidado a membro a partir do próprio perfil dele — na promoção informa-se o **e-mail** do novo membro, que passa a ser o canal de login (magic link), sem necessidade de novo cadastro. A partir da promoção, o perfil passa a poder receber tags e demais informações do app.
- RF-1.3.1: Enquanto o status for Convidado, o perfil **não pode receber** categorias adicionais (Anfitrião/Discipulador/Discípulo) nem alocação em funções/tarefas. O bloqueio vale na UI **e** na API (ver seção 3.2).
- RF-1.4: Líder nomeia auxiliares e anfitriões.
- RF-1.5: Líder/auxiliar edita atributos do membro (trilha de formação atual, categorias adicionais).
- RF-1.6: Import de membros via **CSV** (cadastro em lote).
- RF-1.7: O perfil possui **data de nascimento**; o app exibe a **idade calculada** a partir dela (a idade nunca é armazenada, sempre derivada). A data de nascimento alimenta a automação de aniversário (RF-4.6).
- RF-1.8: Foto de perfil **opcional**; na ausência, o app exibe avatar de fallback com as **iniciais** do nome.
- RF-1.9: Convites — a geração de um convite **exige o nome do convidado preenchido**; convite mantém a expiração já existente. O ID do convite permanece visível, mas com **hierarquia visual secundária** — o nome é o destaque da tela e da listagem.

### RF-2 — Calendário
- RF-2.1: Líder/auxiliar cria, edita e apaga eventos de categoria livre (texto definido por eles no momento da criação, sem lista fixa).
- RF-2.2: O encontro semanal regular do Life Group é **automático** — o líder configura uma única vez o dia da semana e o horário padrão, e o sistema gera o evento recorrente toda semana, sem necessidade de criação manual.
- RF-2.3: Líder/auxiliar pode ajustar uma ocorrência pontual do encontro semanal (ex.: mudança de local numa semana específica) sem alterar a recorrência padrão.
- RF-2.4: Membros visualizam o calendário.

### RF-3 — Discipulado
> Discipulado **não é um menu, aba ou tela própria — e nunca será**. É uma tag (Discipulador/Discípulo) e um vínculo, expostos exclusivamente dentro do perfil do membro — ver seção 8.
- RF-3.1: Líder cria/edita relações discipulador ↔ discípulo (1:N), a partir do perfil do membro.
- RF-3.1.1: **Discipulado cruzado** — um dos lados do vínculo pode ser uma pessoa de **outro Life Group**, registrada por **nome em texto livre**, sem referência a cadastro (a pessoa externa não existe como usuário no app). Pelo menos um dos lados do vínculo deve ser membro interno do Life Group.
- RF-3.2: Discipulador registra progresso/observações do discípulo, no próprio perfil do discípulo.
- RF-3.3: Líder/auxiliar visualiza, na lista de Pessoas, quem é discipulador de quem (filtro/coluna, não uma tela separada).

### RF-4 — Mural
- RF-4.1: Mural de avisos — líder/auxiliar **publica e edita** avisos; todos veem. A edição segue o padrão de **edição inline** (seção 8.2): os campos do próprio aviso tornam-se editáveis no card, sem modal e sem navegação.
- RF-4.1.1: **Avisos automáticos** — o sistema publica avisos gerados por eventos do produto, sem ação manual: aniversário de membro (RF-4.6), abertura de campanha de doação (RF-6.1.1) e pendência de aprovação de Registro de Encontro (RF-9.3). Avisos automáticos identificam sua origem (ver entidade Aviso, seção 7).
- RF-4.2: Enquetes/votações — membros participam, líder/auxiliar cria. Apresentação **estilo WhatsApp**: card em destaque (maior que os demais no layout do mural), com **contagem de votantes e avatares de quem votou**; expandir o card revela a **lista de votos** (quem votou em quê).
- RF-4.2.1: **Horário de término** — a enquete pode ter `termino_em`. Ao expirar, a enquete **e todos os seus votos são excluídos definitivamente** do banco. Consequência documentada desta decisão de produto: **não existe histórico de enquetes** — resultados expirados não são recuperáveis nem alimentam relatórios.
- RF-4.2.2: **Enquete anônima** (opção na criação) — oculta a identidade dos votantes na API e na UI, mantendo apenas a contagem de votos. **Nota de privacidade:** o voto continua associado ao usuário no banco de dados, pois isso é necessário para impedir voto duplicado — o anonimato é **de exibição** (camadas de API/UI), não criptográfico. Essa limitação deve constar do aviso de privacidade.
- RF-4.3: Escala de tarefas semanais — líder decide; auxiliar propõe divisão sujeita a aprovação do líder; membros veem e marcam sua tarefa como feita. **Toda tarefa é atribuída a uma pessoa específica do Life Group (campo obrigatório)** — nunca a um cargo/papel, e não existe atribuição por filtro de papel. A alocação dispara **notificação pessoal** ao responsável (RF-5.3).
- RF-4.4: Informações do encontro atual (local, dia/horário) — refletem automaticamente o evento semanal recorrente do Calendário (RF-2.2), sem cadastro duplicado.
- RF-4.5: Fotos — organizadas em **álbuns vinculados a um evento específico** do calendário. A fonte de cada foto pode ser **upload direto** ou **link do Google Drive**. Link do Drive é exibido como **card de link externo** que abre o Drive — **nunca** renderizado inline no app (decisão de produto: confiabilidade acima de embed; a renderização inline de conteúdo do Drive é instável).
- RF-4.6: **Aniversários** — no dia do aniversário de um membro, o sistema publica **aviso automático no mural** e envia **notificação broadcast** a todos. Mecanismo em duas camadas: **job diário no servidor** + **verificação preguiçosa ao carregar o mural** — a segunda garante que o aviso nunca se perde; no pior caso (job não executou), ele atrasa até o primeiro acesso ao mural no dia.

### RF-5 — Notificações
- RF-5.1: Notificações **in-app + push (Web Push/PWA)** para eventos, tarefas atribuídas e avisos do líder.
- RF-5.2: Membro ativa/desativa push individualmente (RF-8.3).
- RF-5.3: **Regra de roteamento de comunicação** — todo evento do produto segue esta regra ao ser comunicado:
  - **Responsabilidade pessoal** (alocação em tarefa, "seu registro está pendente de aprovação") → **notificação pessoal** ao interessado.
  - **Informação geral do Life Group** (aniversário de membro, campanha aberta, pendência de aprovação aguardando o líder) → **aviso no mural** (+ notificação broadcast).
  - Um mesmo evento pode acionar os dois canais quando tem um responsável claro e interesse geral — ex.: registro pendente gera aviso no mural **e** notificação pessoal ao líder (RF-9.3).

### RF-6 — Doações e campanhas
- RF-6.1: Líder ou auxiliar cria, mantém ou encerra campanhas (tipo — dinheiro, itens como cesta básica, ou ambos —, título, descrição, período). É comum haver uma campanha fixa/recorrente (ex.: item de cesta básica), mantida enquanto o líder decidir.
- RF-6.1.1: A **abertura de uma campanha** gera automaticamente **aviso no mural + notificação broadcast** (RF-4.1.1, RF-5.3).
- RF-6.2: Líder/auxiliar registra os **itens obtidos e as quantidades** por campanha, de forma agregada (ex.: "12 unidades de desinfetante"). O registro pode ser feito diretamente ou como parte de um Registro de Encontro (RF-9.2) — neste caso o item guarda a referência ao registro de origem.
- RF-6.3: **A identidade de quem entregou é sempre anônima** — o app não coleta nem armazena essa informação em nenhuma hipótese.
- RF-6.4: **O app nunca processa transações financeiras** — se a campanha envolver dinheiro, não há registro de valores individuais nem meio de pagamento.
- RF-6.5: Campanha pode exibir um link/QR code do ministério de doação responsável, para facilitar o acesso externo (fora do app).

### RF-7 — Relatórios automatizados
- RF-7.1: Relatório consolidado contendo: frequência/participação (alimentada pelas presenças dos Registros de Encontro, RF-9), progresso de discipulado, atualizações relevantes de membros, e itens/quantidades arrecadados por campanha. **Nunca inclui identidade de quem doou** (ver RF-6.3) nem valores financeiros individuais (RF-6.4). Enquetes expiradas não entram em relatório algum — são excluídas com seus votos (RF-4.2.1).
- RF-7.2: Geração automática **mensal** (dentro do app).
- RF-7.3: Geração **sob demanda**, a qualquer momento.
- RF-7.4: **Exportação em CSV** de qualquer relatório gerado.

### RF-8 — Configurações do app
- RF-8.1: Idioma (padrão pt-BR).
- RF-8.2: Tema (claro/escuro).
- RF-8.3: Preferência de notificação push (ativar/desativar).

### RF-9 — Registro de Encontro
> Funcionalidade nova da v1.1: o líder/auxiliar documenta cada encontro do Life Group num registro estruturado, que alimenta presença, relatórios e arrecadação.

- RF-9.1: Botão **"Registro"** visível **apenas para líder/auxiliar**, exibido vinculado ao dia em que há **evento de Life Group no calendário** — o registro criado fica associado a esse evento/dia.
- RF-9.2: O registro contém:
  - **Presença de membros** — marcação de quem esteve presente;
  - **Convidados presentes** — seleção de convidado já cadastrado **ou criação de um novo ali mesmo, no fluxo do registro**; este fluxo **não** promove o convidado nem atribui tag (RF-1.3.1);
  - **Atividades realizadas**, com **responsável opcional** por atividade. Lista padrão do catálogo: **Relax, Papo Reto, Dar com Alegria, Visão, Oração, Lanche, Comunhão**. Atividades customizadas podem ser adicionadas e removidas do catálogo;
  - **Tempo estimado de duração por atividade** — exceto **Comunhão**, que não recebe duração;
  - **Uma foto do dia** — usa o sistema de álbuns por evento (RF-4.5);
  - **Itens arrecadados** (RF-6.2) para a **campanha aberta no momento**, se houver.
- RF-9.3: **Aprovação** — registro criado pelo **líder** é publicado diretamente; registro criado por **auxiliar** entra como **pendente** até o líder aprovar. A pendência gera automaticamente **aviso no mural + notificação pessoal ao líder** (RF-4.1.1, RF-5.3).
- RF-9.4: **Edição posterior** é permitida, seguindo o padrão de edição inline (seção 8.2). Edição feita por **auxiliar** em registro **já aprovado** retorna o registro ao estado **pendente**, exigindo nova aprovação do líder.
- RF-9.5: **Acesso e listagem** — Perfil → seção Life Group → subseção **"Registros"**. Cada item da lista exibe o nome com **contagem sequencial** (ex.: "Life Group 34"), a data e o número de presentes; tocar no item abre o detalhe completo do registro.

---

## 5. Requisitos não funcionais

| Categoria | Requisito |
|---|---|
| Plataforma | PWA instalável (manifest + service worker) |
| Disponibilidade offline | Não obrigatória na v1 — cache mínimo de shell da PWA é suficiente |
| Notificações | Web Push via VAPID (nativo do browser, sem dependência de terceiro) |
| Automação de avisos | Job diário no servidor + verificação preguiçosa no carregamento do mural como fallback (RF-4.6) — nenhum aviso automático depende exclusivamente do job |
| Privacidade/LGPD | Nome, tags e vínculo de discipulado são visíveis a todos os membros — contato, data de nascimento e trilha de formação ficam restritos a líder/auxiliar (a idade exibida no perfil é derivada). Voto em enquete anônima permanece associado ao usuário no banco (antifraude); o anonimato é de exibição (RF-4.2.2). Enquete expirada é excluída definitivamente com seus votos (RF-4.2.1). Aviso de privacidade e consentimento no cadastro precisam deixar essas exposições e limites claros, mesmo em escala pequena |
| Exportação/Importação | CSV para relatórios (export) e membros (import) |
| Hospedagem | Replit |

---

## 6. Arquitetura técnica proposta

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (App Router) | Front + back no mesmo projeto, suporte nativo a PWA, roda bem em processo único no Replit |
| Banco de dados | PostgreSQL | Modelo relacional se beneficia de FKs bem definidas (líder → membros → discipulado → eventos → registros) |
| ORM | Prisma | Já usado em outros projetos seus, produtividade alta com Postgres |
| Notificações | Web Push API (VAPID) | Nativo do browser, zero custo, sem infra extra |
| Autenticação | Código de convite (1º acesso) + **magic link por e-mail** (login de retorno) | Sem senha pra gerenciar; e-mail transacional tem custo zero ou marginal na escala de um Life Group |

### 6.1 Validação da stack no Replit

A combinação se sustenta. Pontos confirmados e ressalvas:

- **Replit + Next.js**: o agente do Replit já lida nativamente com scaffolding de apps Next.js completos (rotas, API, deploy) — não é um caminho improvisado.
- **PostgreSQL no Replit**: banco Postgres nativo, provisionado em segundos, sem configuração de serviço externo — remove a necessidade de contratar um Postgres gerenciado à parte.
- **Prisma — atenção à versão**: a partir do Prisma 7, a URL de conexão sai do `datasource` em `schema.prisma` e vai para um `prisma.config.ts` separado, usando o adapter `@prisma/adapter-pg`. Tutoriais antigos (Prisma 5/6) mostram a sintaxe velha — ao pedir para o Replit Agent gerar isso, confirme a versão do Prisma instalada para não misturar sintaxe.
- **Web Push (VAPID) no Replit**: funciona, mas depende de o deploy ter HTTPS — o Replit fornece isso automaticamente ao publicar (Deployments), então isso só é resolvido **depois do deploy**, não no ambiente de desenvolvimento local do Replit.
- **Ressalva de plataforma, não do Replit**: push via PWA no iOS exige que o app já esteja instalado na tela de início — no navegador (Safari aberto), push não funciona. Se parte dos membros do Life Group usa iPhone, o mural in-app (RF-4.1) precisa ser a fonte confiável de aviso, não só o push.
- **Magic link por e-mail dispensa provedor de SMS**: o login de retorno usa link de uso único enviado por e-mail (RF-1.1.1). A única dependência é um serviço de envio de e-mail transacional (SMTP ou provedor com camada gratuita, ex.: Resend), com custo zero ou marginal no volume de um Life Group — diferente do OTP por SMS/WhatsApp, que exigiria provedor pago por mensagem. Os links devem ser de uso único e com expiração curta.
- **Automação de aniversários/avisos**: implementada como job diário no servidor, complementada pela verificação preguiçosa no carregamento do mural (RF-4.6) — o fallback garante a publicação mesmo se o job não rodar (ex.: instância adormecida), atrasando no máximo até o primeiro acesso do dia.

---

## 7. Modelo de dados (entidades principais)

- **Usuario**: id, nome, email (canal de login via magic link), telefone (contato), data_nascimento (idade sempre calculada, nunca armazenada), avatar (opcional — fallback por iniciais), papel_principal, categorias[] (bloqueadas enquanto papel = Convidado), trilha_atual, data_ingresso, ativo
- **Convite**: id, **nome (obrigatório antes da geração)**, codigo, criado_por, expira_em, status
- **RelacaoDiscipulado**: cada lado do vínculo é **ou** referência a membro interno **ou** nome externo em texto livre — discipulador_id ⊕ discipulador_externo_nome, discipulo_id ⊕ discipulo_externo_nome. Restrições: cada lado preenche exatamente uma das duas formas; **pelo menos um lado deve ser interno**. Demais campos: data_inicio, status, observacoes
- **Evento**: id, titulo, tipo (**texto livre**, definido pelo líder/auxiliar na criação), data, local, anfitriao_id, criado_por, recorrente (bool, true para o encontro semanal)
- **Tarefa**: id, evento_id, descricao, **responsavel_id (obrigatório — sempre uma pessoa específica, nunca um papel)**, status
- **Campanha**: id, tipo (dinheiro/itens/ambos), titulo, descricao, periodo, ativa, link_doacao (opcional, URL/QR do ministério)
- **ItemArrecadado**: id, campanha_id, **registro_id (opcional — presente quando o item foi registrado via Registro de Encontro, RF-9.2)**, item, quantidade, data_registro, registrado_por (líder/auxiliar que registrou — **nunca** referência ao doador)
- **Enquete**: id, titulo, opcoes[], votos[] (voto sempre associado ao usuário — antifraude, ver RF-4.2.2), **termino_em** (ao expirar, enquete e votos são excluídos definitivamente — RF-4.2.1), **anonima** (bool — oculta votantes na API/UI, mantém contagem)
- **Aviso**: id, conteudo, autor_id (nulo em avisos automáticos), **origem** (manual | aniversario | campanha | registro_pendente), **ref_id** (referência à entidade que originou o aviso automático), criado_em, **editado_em**
- **Album**: id, titulo, evento_id, drive_url (opcional — link do Google Drive exibido como card externo, RF-4.5)
- **Foto**: id, **album_id**, **source_type (upload | drive)**, url (quando upload), **external_url** (quando drive — aberta fora do app, nunca embed), autor_id, data
- **RegistroEncontro**: id, evento_id, data, **seq** (contagem sequencial exibida como "Life Group N"), status (pendente | publicado), criado_por, aprovado_por, album_id (foto do dia), notas
- **PresencaRegistro**: id, registro_id, usuario_id (membro ou convidado), presente
- **AtividadeCatalogo**: id, nome, padrao (bool — as 7 padrão: Relax, Papo Reto, Dar com Alegria, Visão, Oração, Lanche, Comunhão), tem_duracao (false para Comunhão), ativa (customizadas podem ser adicionadas/removidas)
- **AtividadeRegistro**: id, registro_id, atividade_id, responsavel_id (opcional), duracao_estimada (opcional; não se aplica a atividades sem duração)
- **Relatorio**: id, tipo, periodo, gerado_em, dados_json, csv_url

---

## 8. Arquitetura de telas (menus e navegação)

Convidado não navega no app (sem login), então a IA abaixo é só para Líder, Auxiliar e Membro.

### 8.1 Navegação principal (bottom nav — igual para todos os papéis)

**Mural · Agenda · Perfil**

Três abas fixas — e somente três. Funcionalidade nova **nunca** ganha aba própria: entra como seção do Mural ou como sub-página do Perfil. Administração, Pessoas, Registros, Doações/Campanhas, Relatórios e Configurações vivem dentro do Perfil (8.3).

### 8.2 Padrão de edição inline (diretriz de UX do app)

O botão **"Editar"** transforma os campos existentes em editáveis **na própria tela** — sem modal, sem navegar para outra rota. Ao salvar (ou cancelar), a tela volta ao estado de leitura. Este padrão vale para o perfil de pessoas, para os avisos do mural e para **qualquer edição futura**, salvo indicação contrária explícita nesta especificação.

### 8.3 Conteúdo de cada aba

- **Mural**: avisos (manuais e automáticos — editáveis inline por líder/auxiliar), enquetes (card em destaque, estilo WhatsApp — RF-4.2), escala de tarefas semanais, informações do encontro atual (espelha o evento recorrente da Agenda) e álbuns de fotos por evento. O carregamento do mural também dispara a verificação preguiçosa de avisos automáticos (RF-4.6).
- **Agenda**: eventos (criar, editar, apagar, múltiplas categorias); o encontro semanal é configurado uma vez pelo líder (dia + horário) e recorre automaticamente, sem recriação manual. Nos dias com evento de Life Group, líder/auxiliar vê o botão **"Registro"** (RF-9.1).
- **Perfil**: reúne o que é da pessoa e o que é do grupo:
  - **Meu perfil**: dados pessoais, data de nascimento (com idade calculada exibida), avatar, tags (se aplicável), vínculo de discipulado (se for discipulador/discípulo). Edição inline.
  - **Seção Life Group**: Pessoas, **Registros** (RF-9.5), Doações/Campanhas e Relatórios — os dois últimos visíveis só para Líder/Auxiliar, junto com nomeação de auxiliares/anfitriões. A administração fica **separada** de Configurações — é sobre o cargo, não sobre o app.
  - **Configurações** (todos): idioma, tema, ativar/desativar notificação push.

#### Pessoas (Perfil → Life Group)

- Lista única de membros e convidados. Os **cards diferenciam visualmente** os papéis Convidado/Membro/Auxiliar/Líder — por cor, ícone ou borda, nunca apenas por texto pequeno.
- Foto de perfil opcional em cada card, com fallback de **avatar por iniciais** (RF-1.8).
- **Filtros combináveis entre si e com a busca por nome**: papel (Líder/Auxiliar/Membro/Convidado), tags (Anfitrião/Discipulador/Discípulo) e **tem/não tem vínculo de discipulado**.
- Líder/auxiliar adiciona convidado direto por aqui e, depois, promove o mesmo perfil a membro — sem cadastro duplicado. Líder/auxiliar veem tudo (contato, trilha, tags, vínculo de discipulado); membro vê **nome + todas as tags (incl. vínculo de discipulado)**, mas sem contato nem trilha de formação de outros membros.

#### Perfil de pessoa (aberto a partir da lista)

- Dados básicos, trilha atual, tags (Anfitrião/Discipulador/Discípulo) e, quando aplicável, o vínculo de discipulado — incluindo discipulado cruzado com nome externo em texto livre (RF-3.1.1). **É aqui que o discipulado vive, não em um menu à parte.** Edição via padrão inline (8.2).
- Para Membro comum visualizando o perfil de outro, só nome e tags/vínculo aparecem.
- Perfil de **Convidado** não exibe nem aceita tags ou funções — controles bloqueados (RF-1.3.1).

#### Registros (Perfil → Life Group)

- Lista dos Registros de Encontro: cada item mostra o nome com contagem sequencial ("Life Group 34"), a data e o nº de presentes; tocar abre o detalhe (RF-9.5).

### 8.4 Ordem de construção sugerida

Sequência técnica, por dependência de dado (não por menu):

1. Autenticação: convite do líder (com nome obrigatório) → cadastro do membro → magic link por e-mail
2. Perfil de pessoa (CRUD, trilha, tags, vínculo de discipulado — incl. cruzado, data de nascimento, avatar) + cadastro/promoção de convidado
3. Lista de Pessoas (cards por papel, filtros, visão líder/auxiliar completa + visão membro básica, incluindo convidados)
4. Agenda (eventos + encontro semanal automático)
5. Mural (avisos com edição inline, enquetes estilo WhatsApp, escala de tarefas, info do encontro, álbuns de fotos) — depende da Agenda pra puxar a info do encontro
6. Doações/Campanhas (cadastro informativo + link/QR + aviso automático de abertura)
7. Registro de Encontro (depende de 2–6: pessoas, agenda, álbuns e campanhas)
8. Relatórios + exportação CSV (só faz sentido depois que 2–7 têm dado real)
9. Configurações (idioma, tema, notificações)

---

## 9. Fora de escopo (v1.1)

- Multi-tenant (múltiplos Life Groups/igrejas)
- Integração com WhatsApp
- Processamento financeiro de transações de doação — o app registra itens/quantidades arrecadados, nunca movimenta dinheiro nem identifica doador
- Histórico de enquetes — decisão de produto: enquete expirada é excluída definitivamente com seus votos (RF-4.2.1)
- Renderização inline (embed) de conteúdo do Google Drive — links do Drive abrem fora do app (RF-4.5)
- Mapas interativos / recursos de exploração
- App nativo (iOS/Android) — fica só PWA

---

## 10. Roadmap (referência, fora do PRD v1.1)

- **v2**: multi-tenant, múltiplos níveis de organização (rede de Life Groups)
- **v3**: mapas interativos, recursos de exploração

---

## 11. Critérios de aceite da v1.1

**Cadastro, papéis e convites**
- Líder consegue cadastrar/gerenciar membros, papéis e categorias adicionais.
- Convite só é gerado com o nome preenchido; o nome é o destaque visual e o ID do convite aparece com hierarquia secundária; a expiração continua funcionando.
- Líder/auxiliar cadastra convidado direto na lista de Pessoas e promove o mesmo perfil a membro, sem cadastro duplicado.
- Perfil com status Convidado não recebe tag (Anfitrião/Discipulador/Discípulo) nem função: os controles ficam bloqueados na UI **e** a API rejeita a atribuição.
- Membro faz login de retorno via **e-mail + magic link** (uso único, com expiração), sem precisar de senha.
- Perfil exibe idade calculada a partir da data de nascimento; foto de perfil é opcional e o fallback por iniciais aparece quando ausente.
- Import de membros via CSV funcional.

**Pessoas e discipulado**
- Membros comuns veem nome e todas as tags (incl. vínculo de discipulado) de qualquer membro, sem acessar contato nem trilha de formação.
- Cards da lista de Pessoas diferenciam visualmente Convidado/Membro/Auxiliar/Líder (cor, ícone ou borda — não apenas texto).
- Filtros de Pessoas por papel, por tags e por tem/não tem vínculo de discipulado funcionam combinados entre si e com a busca por nome.
- Relações de discipulado são criadas e visualizáveis dentro do perfil do membro — não existe aba/menu de discipulado.
- Vínculo de discipulado cruzado aceita nome em texto livre para a pessoa do outro Life Group, exigindo pelo menos um lado interno.

**Agenda e tarefas**
- Encontro semanal é gerado automaticamente a partir da configuração única de dia/horário do líder.
- Líder/auxiliar cria categorias de evento livremente, sem lista fixa pré-definida.
- Tarefa não pode ser salva sem uma pessoa específica como responsável (nunca um cargo/papel); a atribuição dispara notificação pessoal ao responsável.

**Mural, avisos e enquetes**
- Mural exibe avisos, enquetes, escala de tarefas e informações do encontro atual sem exigir cadastro paralelo ao Calendário.
- Líder/auxiliar edita um aviso existente por edição inline (no próprio card, sem modal); o aviso registra `editado_em`.
- No dia do aniversário de um membro, o aviso automático aparece no mural e a notificação broadcast é enviada — inclusive se o job diário não rodou, via verificação no primeiro carregamento do mural do dia.
- Abertura de campanha gera aviso automático no mural + notificação broadcast.
- Roteamento correto: alocação em tarefa e registro pendente geram notificação **pessoal** ao interessado; aniversário e campanha aberta geram **aviso no mural + broadcast**.
- Enquete exibe contagem de votantes e avatares; expandir o card revela a lista de votos; o card tem destaque maior no layout do mural.
- Enquete com término é excluída definitivamente, junto com todos os votos, ao expirar — sem histórico recuperável.
- Enquete anônima oculta os votantes na UI e na API, mantém a contagem e continua impedindo voto duplicado.

**Fotos**
- Fotos são organizadas em álbuns vinculados a um evento específico; upload direto e link do Google Drive convivem no mesmo álbum.
- Link do Google Drive aparece como card de link externo que abre o Drive — nunca é renderizado inline.

**Registro de Encontro**
- Botão "Registro" aparece apenas para líder/auxiliar e apenas em dia com evento de Life Group no calendário.
- Registro captura presenças de membros, convidados (incluindo criação de convidado novo no fluxo, sem promoção nem tag), atividades com responsável e duração opcionais (Comunhão sem duração), atividades customizadas adicionáveis/removíveis, foto do dia via álbum e itens arrecadados da campanha aberta, se houver.
- Registro criado pelo líder é publicado direto; criado por auxiliar fica pendente e gera aviso no mural + notificação pessoal ao líder; a aprovação do líder publica o registro.
- Edição de auxiliar em registro já aprovado retorna o registro ao estado pendente, exigindo nova aprovação.
- Registros ficam listados em Perfil → Life Group → Registros, com nome sequencial ("Life Group N"), data e nº de presentes, e detalhe ao abrir.

**Doações e relatórios**
- Itens e quantidades arrecadados por campanha são registrados (direto ou via Registro de Encontro) e entram no relatório; identidade de quem doou nunca é coletada.
- Relatório consolidado gerado mensalmente e sob demanda, exportável em CSV.

**Plataforma e UX**
- Notificações push chegam para eventos/tarefas/avisos, com opção de desativar em Configurações.
- App instalável como PWA em dispositivo móvel.
- Padrão de edição inline aplicado em perfil de pessoas e avisos do mural: os campos tornam-se editáveis na própria tela, sem modal e sem navegação.

---

## 12. Histórico de versões

- **1.1 (Julho/2026)** — Terminologia unificada em "Life Group" (termo "célula" descontinuado). Autenticação corrigida para a realidade do app: e-mail + magic link (substitui telefone + OTP por SMS/WhatsApp). Discipulado cruzado com pessoa externa por nome em texto livre. Bloqueio explícito de tags/funções para Convidado (UI e API). Fotos em álbuns por evento, com suporte a link do Google Drive como card externo. Data de nascimento no perfil + aviso automático de aniversário (job diário + verificação preguiçosa). Avisos editáveis inline e avisos automáticos (aniversário, campanha, registro pendente) com regra de roteamento de notificações (RF-5.3). Enquetes estilo WhatsApp, com término (exclusão definitiva ao expirar) e opção anônima (anonimato de exibição). Tarefas sempre atribuídas a pessoa específica. Nova funcionalidade Registro de Encontro (RF-9) com fluxo de aprovação líder/auxiliar. Convite passa a exigir nome. Navegação consolidada em 3 abas (Mural · Agenda · Perfil) e padrão de edição inline como diretriz de UX. Modelo de dados atualizado (Usuario, Convite, Enquete, Aviso) e ampliado (Album, RegistroEncontro, PresencaRegistro, AtividadeCatalogo, AtividadeRegistro).
- **1.0 (Julho/2026)** — Versão inicial do PRD: MVP funcional single-tenant com cadastro/papéis, calendário, discipulado, mural, notificações, doações/campanhas e relatórios.
