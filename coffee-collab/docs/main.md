# CAFÉ GRÃO - Documentação Principal

> **Controle Automático de Fornecimento, Estoque Gerenciamento de Registro e Abastecimento Operacional**

## 📋 Índice

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Instruções Básicas de Desenvolvimento](#instruções-básicas-de-desenvolvimento)
3. [Estrutura da Documentação](#estrutura-da-documentação)
4. [Tecnologias Utilizadas](#tecnologias-utilizadas)
5. [Estrutura do Projeto](#estrutura-do-projeto)

---

## 🎯 Visão Geral do Sistema

O **CAFÉ GRÃO** é um sistema colaborativo desenvolvido de forma descontraída para gerenciar o compartilhamento de café em grão entre membros de uma equipe de trabalho.

### Objetivo

Registrar de forma organizada e divertida:
- **Membros da equipe** que participam do compartilhamento de café
- **Contribuições** (cafés comprados) de cada membro
- **Valores** gastos em cada compra
- **Evidências** (fotos/comprovantes) das compras
- **Acompanhamento visual** através de gráficos (charts) para:
  - Saber de quem deve ser cobrado o próximo café
  - Identificar quando o estoque está acabando
  - Visualizar histórico de contribuições

### Características Principais

- **Sistema colaborativo**: Todos os usuários autenticados veem os mesmos dados compartilhados
- **Autenticação via Google (Gmail)**: Login simples e seguro
- **Armazenamento online**: Dados persistentes no Firebase
- **Interface moderna**: Desenvolvida com React
- **Deploy gratuito**: Hospedado no GitHub Pages

### Conceito

Um sistema simples, prático e divertido que resolve o problema de "de quem é a vez de comprar café?" de forma clara e visual, mantendo um registro histórico de todas as contribuições.

---

## ⚙️ Instruções Básicas de Desenvolvimento

### Regras Obrigatórias

1. **🚫 SEM TypeScript**: O projeto deve ser desenvolvido **APENAS em JavaScript puro** (`.js` e `.jsx`)
   - Não usar `.ts` ou `.tsx`
   - Não adicionar tipagens TypeScript
   - Não instalar dependências TypeScript

2. **📁 Estrutura de Pastas**: Manter organização clara
   - `src/` - Código fonte
   - `src/components/` - Componentes React
   - `src/hooks/` - Custom hooks
   - `src/services/` - Serviços (Firebase, API, etc.)
   - `src/lib/` - Configurações e utilitários
   - `docs/` - Documentação

3. **🔧 Tecnologias**: Manter stack atual (React + Vite + React Router + Firebase + ECharts)
   - Não adicionar bibliotecas desnecessárias
   - Priorizar soluções nativas quando possível

4. **🎨 Estilo**: Por enquanto inline styles (podemos mudar depois)
   - Manter consistência visual
   - Interface limpa e responsiva

5. **📝 Commits**: Sempre fazer commits descritivos
   - Usuário tem controle total sobre commits
   - Não fazer commits automáticos

6. **🧪 Testes**: Testar localmente antes de deploy
   - Sempre validar funcionamento local
   - Deploy apenas quando tudo estiver funcionando

7. **⚠️ CONFIGURAÇÕES REMOTAS OBRIGATÓRIAS**: **SEMPRE** alertar sobre mudanças necessárias em serviços remotos
   - **Firebase Firestore Rules**: Quando alterações estruturais são feitas no banco de dados (novas collections, subcollections, campos), as regras de segurança do Firestore **DEVEM** ser atualizadas
   - **Google Cloud**: Quando necessário configurar novas APIs, permissões OAuth, etc.
   - **IMPORTANTE**: Alterações no código que afetam estrutura de dados podem não funcionar sem atualizar as regras do Firestore
   - Ver seção [Configurações de Serviços Remotos](#configurações-de-serviços-remotos) abaixo para detalhes

### Convenções de Código

- **🌐 Idioma do Código**: Todo código, variáveis, nomes de funções, estruturas de banco de dados e propriedades devem estar em **INGLÊS**
  - Variáveis: `userName`, `isAdmin`, `contributionDate`
  - Funções: `getUserProfile()`, `createContribution()`
  - Collections do Firestore: `users`, `contributions`, `products`
  - Propriedades de objetos: `userId`, `purchaseDate`, `quantityKg`
  - Apenas strings de exibição (mensagens ao usuário) podem estar em português
- Usar **ES6+** (arrow functions, destructuring, async/await)
- Nomes de arquivos em **camelCase** para componentes (`LoginButton.jsx`)
- Nomes de arquivos em **camelCase** para hooks (`useAuth.js`)
- Componentes React sempre começam com **letra maiúscula**
- Funções utilitárias em **camelCase**

---

## ⚙️ Configurações de Serviços Remotos

### ⚠️ ATENÇÃO: Leia esta seção antes de fazer alterações estruturais

Toda vez que houver alterações estruturais no sistema (novas collections, subcollections, campos, etc.), é **OBRIGATÓRIO** verificar e atualizar as configurações dos serviços remotos.

### Firebase Firestore Rules

**O que são**: Regras de segurança que controlam quem pode ler e escrever dados no Firestore.

**Quando atualizar**: 
- Criar novas collections
- Criar novas subcollections
- Adicionar campos que mudam permissões de acesso
- Mudar lógica de acesso baseada em dados

**Como atualizar**:
1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Firestore Database** → **Regras** (Rules)
4. Edite as regras conforme necessário
5. Clique em **Publicar** (Publish)

**Arquivo local**: As regras também estão no arquivo `firestore.rules` na raiz do projeto. Este arquivo deve ser mantido atualizado e sincronizado com o Firebase Console.

**⚠️ IMPORTANTE**: Sem atualizar as regras, o código pode falhar silenciosamente ou com erros de permissão. Sempre teste após atualizar as regras.

### Exemplo: Quando adicionar regras para subcollections

Se você criar uma subcollection (ex: `contributions/{contributionId}/contributionDetails`), você **DEVE** adicionar regras para ela:

```javascript
match /contributions/{contributionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null && (
    resource.data.userId == request.auth.uid ||
    isAdmin()
  );
  
  // IMPORTANTE: Adicionar regras para subcollection
  match /contributionDetails/{detailId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null && (
      // Mesma lógica da collection pai
      get(/databases/$(database)/documents/contributions/$(contributionId)).data.userId == request.auth.uid ||
      isAdmin()
    );
  }
}
```

### Google Cloud

**Quando configurar**:
- Novas APIs do Google precisam ser habilitadas
- Novas permissões OAuth são necessárias
- Novos serviços do Google são integrados

**Como configurar**: Ver documentos específicos (`FIREBASE_SETUP.md`, `GOOGLE_DRIVE_SETUP.md`)

---

## 📚 Estrutura da Documentação

A documentação está organizada da seguinte forma:

```
docs/
├── main.md                    # Este arquivo (documento principal)
├── tecnologias.md            # Tecnologias utilizadas e seus propósitos
├── arquitetura.md            # Arquitetura do sistema e decisões técnicas
├── database.md               # Estrutura completa do banco de dados
├── design-style.md           # Diretrizes de design e estilo visual
├── especificacoes/           # Especificações de telas e funcionalidades
│   ├── README.md             # Índice das especificações
│   └── pages.md              # Especificações detalhadas de todas as páginas
├── api.md                     # Documentação de serviços/APIs (quando necessário)
└── deploy.md                  # Instruções de deploy e GitHub Pages
```

### Documentos Disponíveis

- **[main.md](./main.md)** - Documento principal (este arquivo)
- **[tecnologias.md](./tecnologias.md)** - Tecnologias e suas funções no projeto
- **[arquitetura.md](./arquitetura.md)** - Arquitetura e decisões técnicas
- **[database.md](./database.md)** - Estrutura completa do banco de dados Firestore
- **[design-style.md](./design-style.md)** - Diretrizes de design e estilo visual
- **[especificacoes/pages.md](./especificacoes/pages.md)** - Especificações detalhadas de todas as páginas

### Documentos a Criar (Futuro)

- `especificacoes/` - Especificações detalhadas de cada tela/funcionalidade
- `api.md` - Documentação de endpoints e serviços Firebase
- `deploy.md` - Guia completo de deploy

---

## 🛠️ Tecnologias Utilizadas

Para detalhes completos sobre cada tecnologia, consulte: **[tecnologias.md](./tecnologias.md)**

### Stack Principal

- **React** - Biblioteca JavaScript para interfaces
- **Vite** - Build tool e dev server
- **React Router** - Roteamento client-side (múltiplas páginas)
- **Firebase** - Backend como serviço (autenticação e banco de dados)
- **Apache ECharts** - Biblioteca de gráficos e visualizações

### Principais Motivos

- **React + Vite**: Desenvolvimento rápido, hot reload, e build otimizado
- **React Router**: Navegação entre múltiplas páginas na SPA
- **Firebase**: Solução completa sem necessidade de backend próprio, gratuito para projetos pequenos
- **Apache ECharts**: Gráficos profissionais e interativos para visualização de dados
- **GitHub Pages**: Deploy gratuito e automático de apps estáticos

---

## 📁 Estrutura do Projeto

```
coffee-collab/
├── src/
│   ├── components/          # Componentes React reutilizáveis
│   │   └── LoginButton.jsx
│   ├── pages/               # Páginas/rotas da aplicação
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx
│   │   └── Charts.jsx
│   ├── hooks/               # Custom hooks
│   │   └── useAuth.js
│   ├── services/            # Serviços (Firebase, etc.)
│   │   ├── userService.js
│   │   └── contributionService.js
│   ├── lib/                 # Configurações e utilitários
│   │   └── firebase.js
│   ├── App.jsx              # Componente principal (rotas)
│   └── main.jsx             # Entry point
├── docs/                    # Documentação do projeto
├── public/                  # Arquivos estáticos
├── index.html               # HTML principal
├── vite.config.js           # Configuração do Vite
├── package.json             # Dependências do projeto
└── README.md                # README do projeto
```

---

## 🚀 Como Usar Esta Documentação

### Para Novos Desenvolvedores (ou novos contextos de chat)

1. **Leia este documento primeiro** (`main.md`) para entender o sistema
2. **Consulte `tecnologias.md`** para entender a stack técnica
3. **Veja `arquitetura.md`** para decisões de design e arquitetura
4. **Acesse `especificacoes/`** quando começar a implementar funcionalidades específicas

### Para Desenvolvimento

- Sempre seguir as [Instruções Básicas](#instruções-básicas-de-desenvolvimento)
- Consultar especificações antes de implementar novas funcionalidades
- Atualizar documentação quando necessário

---

## 📝 Notas Importantes

- As **telas atuais são temporárias** e serão refeitas
- As **especificações de funcionalidades** serão criadas posteriormente
- O sistema está em **fase inicial de desenvolvimento**
- O foco atual é ter uma **base sólida e documentada** para desenvolvimento futuro

---

**Última atualização**: Dezembro 2024  
**Versão do sistema**: 0.1.0 (Desenvolvimento inicial)

