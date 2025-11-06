# Arquitetura do Sistema - CAFÉ GRÃO

Este documento descreve a arquitetura do sistema, decisões de design e padrões utilizados no desenvolvimento.

---

## 🏗️ Visão Geral da Arquitetura

O **CAFÉ GRÃO** é uma **Single Page Application (SPA)** que roda completamente do lado do cliente, sem necessidade de servidor backend próprio.

```
┌─────────────────────────────────────────────────┐
│            Cliente (Navegador)                  │
│                                                 │
│  ┌─────────────┐      ┌──────────────┐        │
│  │   React     │      │   Firebase   │        │
│  │   (Vite)    │◄─────┤   Services   │        │
│  └─────────────┘      └──────────────┘        │
│         │                     │                │
│         │                     │                │
│  ┌──────▼──────┐      ┌──────▼──────┐        │
│  │ Components  │      │  Auth + DB  │        │
│  │   Hooks     │      │  (Cloud)    │        │
│  └─────────────┘      └─────────────┘        │
│                                                 │
└─────────────────────────────────────────────────┘
         │                     │
         │                     │
         └─────────────────────┘
            Deploy: GitHub Pages
```

### Características Arquiteturais

1. **Frontend-only**: Toda lógica roda no navegador
2. **BaaS (Backend as a Service)**: Firebase fornece backend completo
3. **Estático**: Build gera arquivos estáticos (HTML/CSS/JS)
4. **SPA**: Roteamento client-side com React Router (múltiplas páginas)
5. **Visualizações**: Gráficos interativos com Apache ECharts

---

## 📁 Estrutura de Pastas

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── Layout.jsx       # Componente de layout com sidebar e footer
│   ├── Sidebar.jsx      # Menu lateral navegável
│   └── LoginButton.jsx  # Componente de autenticação
│
├── pages/              # Páginas/rotas da aplicação
│   ├── Home.jsx        # Página inicial
│   ├── Dashboard.jsx   # Dashboard principal
│   └── Charts.jsx      # Página de gráficos
│
├── hooks/              # Custom hooks React
│   └── useAuth.js      # Hook de autenticação
│
├── services/           # Lógica de negócio e integrações
│   ├── userService.js           # Operações de perfil de usuário
│   └── contributionService.js   # Operações de contribuições
│
├── lib/                # Configurações e utilitários
│   ├── firebase.js     # Configuração do Firebase (usa variáveis de ambiente)
│   └── googleDrive.js # Configuração do Google Drive (usa variáveis de ambiente)
│
├── App.jsx             # Componente raiz (configuração de rotas)
└── main.jsx            # Entry point (ponto de entrada)
```

### Organização por Responsabilidade

- **`components/`**: Componentes de UI reutilizáveis
- **`pages/`**: Páginas completas da aplicação (rotas)
- **`hooks/`**: Lógica compartilhada e reutilizável (custom hooks)
- **`services/`**: Lógica de negócio e comunicação com APIs/externos
- **`lib/`**: Configurações globais e inicializações

---

## 🔐 Arquitetura de Autenticação

### Fluxo de Autenticação

```
1. Usuário clica "Entrar com Google"
   ↓
2. Firebase Auth abre popup Google OAuth
   ↓
3. Usuário autentica com conta Google
   ↓
4. Firebase retorna token e dados do usuário
   ↓
5. useAuth hook armazena estado do usuário
   ↓
6. userService cria/atualiza perfil no Firestore
   ↓
7. App renderiza conteúdo autenticado
```

### Gerenciamento de Estado de Autenticação

- **`useAuth` hook**: Gerencia estado global de autenticação
- **Firebase Auth**: Fonte da verdade (validação server-side)
- **onAuthStateChanged**: Listener que atualiza estado automaticamente

---

## 💾 Arquitetura de Dados

### Modelo de Dados no Firestore

#### Collection: `users`

Armazena perfis de usuários (um documento por usuário).

```javascript
{
  uid: string,              // ID único do usuário (mesmo do Firebase Auth)
  email: string | null,     // Email do usuário
  displayName: string | null, // Nome exibido
  photoURL: string | null,  // URL da foto de perfil
  createdAt: Timestamp,     // Data de criação
  updatedAt: Timestamp      // Data de atualização
}
```

**Regras de Segurança**:
- Usuário autenticado pode **ler** qualquer perfil
- Usuário só pode **escrever** seu próprio perfil (`uid` deve coincidir)

#### Collection: `contributions`

Armazena todas as contribuições (compartilhadas entre todos os usuários).

```javascript
{
  id: string,               // ID do documento (gerado automaticamente)
  userId: string,           // ID do usuário que contribuiu
  userName: string | null,  // Nome do usuário (para exibição)
  amount: number,           // Valor da contribuição
  description: string,     // Descrição da compra
  date: Timestamp,          // Data da contribuição
  createdAt: Timestamp      // Data de criação do registro
}
```

**Regras de Segurança**:
- Qualquer usuário autenticado pode **ler** todas as contribuições
- Qualquer usuário autenticado pode **escrever** novas contribuições

### Padrão: Dados Compartilhados

**Decisão de Design**: Todos os usuários veem os mesmos dados de contribuições.

**Por quê**:
- Sistema colaborativo onde transparência é importante
- Todos precisam saber quem contribuiu e quando
- Facilita visualização coletiva em gráficos

---

## 🎣 Padrão de Custom Hooks

### `useAuth`

**Propósito**: Centralizar toda lógica de autenticação.

**Retorna**:
```javascript
{
  user: User | null,        // Objeto do usuário atual
  loading: boolean,         // Estado de carregamento
  signInWithGoogle: () => Promise,  // Função de login
  signOut: () => Promise           // Função de logout
}
```

**Benefícios**:
- Reutilizável em qualquer componente
- Estado sincronizado automaticamente
- Lógica isolada e testável

---

## 🔧 Padrão de Services

### `userService.js`

**Responsabilidade**: Operações de CRUD de perfis de usuários.

**Funções**:
- `getOrCreateUserProfile(user)`: Cria perfil se não existir, retorna se já existir

### `contributionService.js`

**Responsabilidade**: Operações de CRUD de contribuições.

**Funções**:
- `addContribution(userId, userName, amount, description)`: Adiciona nova contribuição
- `getAllContributions()`: Retorna todas as contribuições ordenadas

**Padrão**: Cada service é responsável por uma entidade específica do domínio.

---

## ⚙️ Configuração do Build (Vite)

### Base Path Condicional

**Configuração no Vite** (`vite.config.js`):

```javascript
base: mode === 'production' ? '/cafe_grao/' : '/'
```

**Configuração no React Router** (`App.jsx`):

```javascript
<BrowserRouter basename={import.meta.env.MODE === 'production' ? '/cafe_grao' : undefined}>
```

**Decisão**: Em desenvolvimento local, base é `/` (raiz). Em produção (GitHub Pages), base é `/cafe_grao/`.

**Por quê**: 
- GitHub Pages serve o app em um subpath (`/cafe_grao/`), mas localmente roda na raiz
- O Vite precisa saber o base path para gerar os links corretos dos assets
- O React Router precisa saber o basename para manter as rotas corretas durante navegação
- **IMPORTANTE**: Sem o `basename` no Router, a URL pode mudar para a raiz (`https://mattkist.github.io/`) ao navegar

---

## 🔒 Segurança

### Regras do Firestore

```javascript
// Usuários: leitura livre, escrita apenas do próprio perfil
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}

// Contribuições: leitura/escrita livre para autenticados
match /contributions/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null;
}
```

**Princípios**:
- Sempre verificar autenticação (`request.auth != null`)
- Usuários só podem modificar seus próprios perfis
- Contribuições são públicas entre usuários autenticados

---

## 🚀 Deploy

### Configuração de Variáveis de Ambiente

⚠️ **IMPORTANTE**: Antes do deploy, configure todas as variáveis de ambiente:

**Desenvolvimento Local:**
- Crie arquivo `.env` na pasta `coffee-collab/` com todas as variáveis necessárias
- Veja `.env.example` como template

**Produção (GitHub Pages):**
- Configure GitHub Secrets com todas as variáveis `VITE_*`
- Variáveis necessárias: Firebase (7 variáveis) + Google OAuth (2 variáveis)
- **CRÍTICO**: Configure domínios autorizados no Firebase (veja `FIREBASE_SETUP.md`)
  - Adicione `mattkist.github.io` em Authentication → Settings → Authorized domains
- Veja `FIREBASE_SETUP.md` e `GOOGLE_DRIVE_SETUP.md` para detalhes

### Fluxo de Deploy

```
1. Push para branch `main`
   ↓
2. GitHub Actions triggera workflow
   ↓
3. Build: `npm run build` (Vite compila para `dist/`)
   - GitHub Secrets são injetadas como variáveis de ambiente
   - Vite embute variáveis no JavaScript final
   ↓
4. Copia `index.html` para `404.html` (fallback SPA)
   ↓
5. Deploy para GitHub Pages
   ↓
6. App disponível em: https://mattkist.github.io/cafe_grao/
```

### Fallback SPA

GitHub Pages não suporta roteamento client-side nativamente. Solução: copiar `index.html` para `404.html`. Quando uma rota não existe, GitHub Pages serve `404.html`, que é nosso app React, permitindo roteamento client-side.

---

## 🔄 Fluxo de Dados

```
┌─────────────┐
│  Component  │
└──────┬──────┘
       │
       │ chama hook/service
       ↓
┌─────────────┐      ┌──────────────┐
│    Hook     │◄─────┤   Service   │
│  (useAuth)  │      │ (Firestore)  │
└──────┬──────┘      └──────────────┘
       │                     │
       │ atualiza estado     │ atualiza banco
       ↓                     ↓
┌─────────────┐      ┌──────────────┐
│   Estado    │      │   Firestore  │
│   React     │      │   (Cloud)    │
└─────────────┘      └──────────────┘
```

---

## 🗺️ Arquitetura de Rotas

### React Router

O sistema utiliza **React Router** para gerenciar múltiplas páginas dentro da SPA.

**Estrutura de Rotas**:
```
/               → Landing (página inicial)
/inactive       → Página de usuário inativo
/home           → Dashboard principal
/contributions  → Gerenciamento de contribuições
/compensations  → Gerenciamento de compensações
/votes          → Sistema de votação
/products       → Gerenciamento de produtos
/settings       → Configurações do usuário
/users          → Gerenciamento de usuários (admin)
```

**Rotas Protegidas**:
- Rotas que requerem autenticação usam `ProtectedRoute` ou verificação de `useAuth`
- Usuários não autenticados são redirecionados para login
- Rotas que requerem usuário ativo usam `ProtectedRoute` com `requireActive={true}`
- Rotas admin usam `ProtectedRouteAdmin`

**Benefícios**:
- Separação clara de funcionalidades por página
- Navegação intuitiva (URLs significativas)
- Histórico do navegador funcional
- Deep linking (acesso direto a páginas específicas)

### Prevenção de Problemas de Navegação

**Problema Identificado**: Navegação rápida entre páginas causava erros de Firestore channel termination (400 Bad Request) e loops de requisições.

**Solução Implementada**:

1. **Prevenção de Cliques Múltiplos no Sidebar**:
   - Flag `navigatingRef` previne múltiplos cliques durante navegação
   - Timeout de 500ms bloqueia cliques adicionais
   - Previne navegação se já estiver na rota ativa

2. **Proteção contra Race Conditions no ProtectedRoute**:
   - Flag `isMountedRef` verifica se componente ainda está montado antes de atualizar estado
   - Flag `loadingRef` previne múltiplas requisições simultâneas
   - Cleanup adequado no `useEffect` para evitar memory leaks

3. **Tratamento de Erros**:
   - Erros durante carregamento de perfil não causam loops
   - Estado é atualizado apenas se componente ainda está montado
   - Cleanup adequado remove listeners e flags quando componente desmonta

**Arquivos Modificados**:
- `src/components/Sidebar.jsx` - Prevenção de cliques múltiplos
- `src/components/ProtectedRoute.jsx` - Proteção contra race conditions
- `src/components/ProtectedRouteAdmin.jsx` - Mesma proteção para rotas admin

---

## 📊 Visualização de Dados

### Apache ECharts

O sistema utiliza **Apache ECharts** para criar gráficos interativos e profissionais.

**Tipos de Gráficos Utilizados**:
- **Gráfico de linha**: Evolução temporal das contribuições
- **Gráfico de barras**: Contribuições por usuário
- **Gráfico de pizza**: Distribuição de contribuições
- **Gráfico de área**: Estoque ao longo do tempo

**Características**:
- Interatividade nativa (hover, zoom, etc.)
- Responsivo por padrão
- Personalização visual completa
- Performance otimizada

**Integração**:
- ECharts é inicializado no `useEffect` dos componentes de gráficos
- Dados vêm do Firestore via services
- Atualização automática quando dados mudam

---

## 📊 Decisões de Design

### 1. Por que SPA com React Router?

- **Performance**: Carrega uma vez, navegação instantânea
- **Organização**: Separação clara de funcionalidades em páginas distintas
- **UX**: URLs significativas e histórico do navegador
- **GitHub Pages**: Ideal para SPAs estáticas com fallback SPA

### 2. Por que Firebase?

- **Sem servidor**: Não precisa de backend próprio
- **Gratuito**: Plano free suficiente para este projeto
- **Autenticação pronta**: Google Auth integrado
- **Tempo real**: Firestore atualiza automaticamente

### 3. Por que Custom Hooks?

- **Reutilização**: Lógica compartilhada facilmente
- **Testabilidade**: Hooks isolados são mais fáceis de testar
- **Organização**: Separa lógica de apresentação

---

## 🔮 Melhorias Futuras

### Arquitetura

- **Context API**: Para estado global mais complexo
- **Lazy Loading**: Code splitting por rota (carregar páginas sob demanda)
- **Error Boundaries**: Captura de erros por rota
- **Otimizações**: Performance e bundle size

### Funcionalidades com ECharts

- **Gráficos em tempo real**: Atualização automática quando novos dados chegam
- **Exportação**: Salvar gráficos como imagem
- **Filtros interativos**: Filtrar dados diretamente nos gráficos
- **Comparações**: Comparar períodos diferentes

### Funcionalidades

- **Upload de imagens**: Para evidências de compra (Google Drive - pasta compartilhada) ✅ Implementado
- **Edição de contribuições**: Modal completo para editar contribuições existentes ✅ Implementado
- **Notificações**: Alertas personalizados na página Home ✅ Implementado
  - Alerta de contribuições sem chegada
  - Alerta de produtos sem voto
  - Alerta de menor contribuição no ranking
- **Relatórios**: Gráficos e estatísticas avançadas ✅ Implementado (gráficos de colaboradores e timeline)

---

**Última atualização**: Dezembro 2024

