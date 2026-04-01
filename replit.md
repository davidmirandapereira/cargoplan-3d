# CargoPlan 3D - Planeamento de Carga Profissional

## Overview
Aplicacao web de planeamento de carga 3D para otimizar o carregamento de contentores, camioes e paletes. Hierarquia de dados: Produtos -> Caixas (com produtos) -> Paletes (com caixas) -> Espaco de Carga. Visualizacao 3D interativa com fullscreen, zoom e tooltips. Algoritmo de colocacao com restricoes de empilhamento, fragilidade e orientacao. Distribuicao de peso e centro de gravidade. Relatorio de carregamento passo-a-passo com impressao. Suporte multi-idioma (PT, EN, ES, FR, DE).

## Recent Changes
- 2026-02-21: Rebrand de EasyCargo para CargoPlan 3D
- 2026-02-21: Esquema de cores laranja/preto (primario: HSL 37 95% 55%)
- 2026-02-21: Visualizacao 3D melhorada - fullscreen, zoom, tooltips hover, grelha chao, sombras
- 2026-02-21: Distribuicao de peso - barras esq/dir e frente/tras, centro de gravidade, carga por eixo
- 2026-02-21: Relatorio de carregamento passo-a-passo com impressao e avisos fragil/empilhamento
- 2026-02-20: Landing page com hero, funcionalidades e precos (trial/basic/pro)
- 2026-02-20: Sidebar shadcn com navegacao, avatar, badge de licenca, logout
- 2026-02-20: Routing baseado em autenticacao: landing page (nao autenticado) vs app shell com sidebar (autenticado)
- 2026-02-20: Importacao de encomenda via CSV simples (codigos + quantidades)
- 2026-02-20: Autenticacao Replit Auth (OIDC) com sessoes e tabela de utilizadores
- 2026-02-20: Licenciamento: trial (10 produtos), basic (100), pro (ilimitado)
- 2026-02-20: Pesquisa dinamica de produtos por codigo/nome, tabela de encomenda tipo Excel com +/- quantidades
- 2026-02-20: Espacos de carga predefinidos (Contentor 20'/40'/40'HC, Camiao 7.5t/12t/TIR) com categorias
- 2026-02-20: Redesenho completo - nova hierarquia (produtos, caixas, paletes), algoritmo melhorado

## User Preferences
- Idioma: Portugues de Portugal (pt-PT)
- Design: Industrial/profissional com tons de laranja e preto escuro

## Project Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js com PostgreSQL (Drizzle ORM)
- **Routing**: wouter
- **State**: TanStack Query
- **i18n**: Sistema proprio com contexto React (client/src/i18n/)

### Data Model (shared/schema.ts)
- `products` - Produtos individuais (dimensoes, peso, fragilidade, orientacoes, empilhamento)
- `boxTypes` - Tipos de caixa (dimensoes, peso vazio, cor, restricoes)
- `boxTypeProducts` - Composicao: quais produtos vao dentro de cada caixa
- `palletTypes` - Tipos de palete (dimensoes, tara, peso max, cor, restricoes)
- `palletTypeBoxes` - Composicao: quais caixas vao em cada palete
- `cargoSpaces` - Espacos de carga (contentores, camioes)
- `loadPlans` - Planos de carga calculados
- `placedUnits` - Unidades colocadas num plano

### Key Files
- `shared/schema.ts` - Modelos de dados com Drizzle + Zod
- `shared/models/auth.ts` - Modelo de utilizadores + sessoes + licenciamento
- `shared/routes.ts` - Contrato API com Zod
- `server/routes.ts` - Rotas API + algoritmo de calculo de carga
- `server/storage.ts` - Camada de armazenamento (CRUD)
- `server/replit_integrations/auth/` - Autenticacao Replit Auth (OIDC)
- `client/src/App.tsx` - Router com auth-based routing + sidebar + provider i18n
- `client/src/pages/landing.tsx` - Landing page para utilizadores nao autenticados
- `client/src/pages/home.tsx` - Pagina de planeamento com visualizacao 3D
- `client/src/pages/products.tsx` - Gestao de produtos
- `client/src/pages/box-types.tsx` - Gestao de tipos de caixa
- `client/src/pages/pallet-types.tsx` - Gestao de tipos de palete
- `client/src/components/app-sidebar.tsx` - Sidebar com navegacao, perfil e logout
- `client/src/components/container-3d.tsx` - Visualizacao 3D (Canvas 2D com projecao 3D)
- `client/src/components/weight-distribution.tsx` - Distribuicao de peso (esq/dir, frente/tras, centro gravidade)
- `client/src/components/loading-report.tsx` - Relatorio de carregamento passo-a-passo com impressao
- `client/src/hooks/use-auth.ts` - Hook de autenticacao
- `client/src/i18n/` - Sistema de traducoes (pt, en, es, fr, de)
- `client/src/lib/types.ts` - Tipos TypeScript do frontend

### API Endpoints
- `GET /api/products` - Lista produtos
- `POST /api/products` - Cria produto
- `DELETE /api/products/:id` - Elimina produto
- `GET /api/box-types` - Lista tipos de caixa
- `POST /api/box-types` - Cria tipo de caixa
- `DELETE /api/box-types/:id` - Elimina tipo de caixa
- `GET /api/box-types/:id/products` - Lista produtos de uma caixa
- `POST /api/box-types/:id/products` - Adiciona produto a caixa
- `DELETE /api/box-types/:boxTypeId/products/:productId` - Remove produto de caixa
- `GET /api/pallet-types` - Lista tipos de palete
- `POST /api/pallet-types` - Cria tipo de palete
- `DELETE /api/pallet-types/:id` - Elimina tipo de palete
- `GET /api/pallet-types/:id/boxes` - Lista caixas de uma palete
- `POST /api/pallet-types/:id/boxes` - Adiciona caixa a palete
- `DELETE /api/pallet-types/:palletTypeId/boxes/:boxTypeId` - Remove caixa de palete
- `GET /api/cargo/spaces` - Lista espacos de carga
- `POST /api/cargo/spaces` - Cria espaco de carga
- `POST /api/cargo/calculate` - Calcula plano de carga otimizado

### Load Algorithm Features
- Respeita orientacoes permitidas (vertical, lateral, frontal, traseiro)
- Impede empilhamento em itens frageis
- Verifica limite de empilhamento (maxStackCount)
- Verifica se item suporta peso em cima (canBearWeight)
- Calcula pesos a partir das composicoes (produto -> caixa -> palete)
- Ordenacao por volume (maior primeiro)
