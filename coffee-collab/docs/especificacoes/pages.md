# Especificações de Páginas - CAFÉ GRÃO

Este documento detalha cada página/tela do sistema, seus componentes, comportamentos e regras de negócio.

---

## 🏠 Página Inicial (Landing) - `/`

### Acesso
- **Aberta**: Usuários não autenticados
- **Protegida**: Não (é o fallback para não logados)

### Layout e Elementos

```
┌─────────────────────────────────────┐
│                                     │
│          CAFÉ GRÃO                  │
│                                     │
│  Controle Automático de            │
│  Fornecimento, Estoque e            │
│  Gerenciamento de Registro e        │
│  Abastecimento Operacional          │
│                                     │
│  [C O N T R O L E] [A U T O M Á T I│
│  [F O R N E C I M E N T O] ...     │
│  (letras coloridas mostrando        │
│   o acrônimo)                        │
│                                     │
│  [Entrar com Google]                │
│                                     │
└─────────────────────────────────────┘
```

### Elementos Visuais
- **Logo**: Logo transparente do sistema (meuCafeGrao_logo_transparent.png) - Imagem destacada
- **Subtítulo**: Texto completo do acrônimo com letras coloridas para destacar "C A F É G R Ã O"
- **Botão de login**: Centralizado, destaque visual

### Comportamento
- Ao clicar "Entrar com Google", abre popup de autenticação
- Após login, redireciona conforme:
  - Se `isActive: false` → `/inactive`
  - Se `isActive: true` → `/home`

---

## ⏳ Página Inativo - `/inactive`

### Acesso
- **Apenas logados** com `isActive: false`
- **Redireciona** para `/home` se `isActive: true`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  ☕ Espera aí, meu chapa!            │
│                                     │
│  Mensagem descontraída e piadista   │
│  sobre café e espera com humor      │
│  sobre a situação de aguardar       │
│  ativação...                        │
│                                     │
│  [Botão Sair]                       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Administradores:             │   │
│  │                               │   │
│  │ [Foto] João Silva             │   │
│  │        joao@example.com       │   │
│  │                               │   │
│  │ [Foto] Maria Santos           │   │
│  │        maria@example.com     │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Elementos Visuais
- **Título**: "☕ Espera aí, meu chapa!" - Tom descontraído
- **Mensagem**: Texto piadista sobre café e espera, com piadas sobre:
  - Esperar como esperar para fazer café sem grãos
  - "A melhor forma de esperar é... esperando com um cafezinho na mão!"
  - Administradores como "baristas chefes"
- **Botão Sair**: Permite logout e retorno à página inicial

### Comportamento
- Exibe mensagem com tema cômico de café e piadas sobre espera
- Lista todos os usuários com `isAdmin: true`
- Card para cada admin mostra:
  - Foto (ou placeholder)
  - Nome
  - Email
- Card com estilo bonito e destaque visual
- **Botão Sair**: Faz logout e redireciona para `/`

### Regras
- Permite logout via botão "Sair"
- Usuário deve aguardar ativação por admin
- Após logout, pode fazer login novamente (mas continua inativo até ser ativado)

---

## 📊 Home/Landing (Logado) - `/home`

### Acesso
- **Apenas logados** com `isActive: true`
- **Redireciona** não autenticados para `/`
- **Redireciona** `isActive: false` para `/inactive`

### Layout e Elementos

#### Header

```
┌─────────────────────────────────────────────────────┐
│  CAFÉ GRÃO                    [Foto] João Silva   │
│  Controle Automático de Fornecimento, Estoque...   │
│  Total Contribuições: R$ 250,00                    │
│  Total KGs: 5.5 kg                                  │
│                                                     │
│  [+ Nova Contribuição | Votação | Novo Produto] [Sair] │
└─────────────────────────────────────────────────────┘
```

**Elementos do Header**:
- **Logo do sistema**: Logo transparente (meuCafeGrao_logo_transparent.png) (esquerda)
- **Slogan**: "Controle Automático de Fornecimento, Estoque e Gerenciamento de Registro de Abastecimento Operacional" (logo abaixo do logo, em itálico e tamanho menor)
- **Foto do usuário**: Circular, clicável (vai para Settings)
- **Nome do usuário**: Ao lado da foto
- **Total de Contribuições**: Valor total já contribuído pelo usuário (considera a parte do usuário em contribuições rachadas)
- **Total de KGs**: Quantidade total de café registrada pelo usuário (considera a parte do usuário em contribuições rachadas)
- **Botão + (ADD)**: Expande para três opções:
  - Nova Contribuição (abre modal)
  - Votação (vai para `/votes`)
  - Novo Produto (abre modal)
- **Botão Sair**: Faz logout

**Interações**:
- Clicar na foto/nome → `/settings`
- Clicar "Nova Contribuição" → Abre modal
- Clicar "Votação" → `/votes`
- Clicar "Novo Produto" → Abre modal
- Clicar "Sair" → Faz logout e redireciona para `/`

#### Avisos (Alerts)

**Posição**: Logo abaixo do header

**Avisos Possíveis**:

1. **"☕ Já chegou o café?!"**
   - **Condição**: Usuário possui contribuição(ões) com `arrivalEvidence: null` ou `arrivalDate: null`
   - **Exibição**: Card destacado com gradiente bege/marrom e borda laranja
   - **Ação**: Botão "Editar Contribuição" que abre modal de edição da primeira contribuição pendente
   - **Status**: ✅ Implementado
   - **Quando aparece**: Apenas quando o usuário tem contribuições criadas por ele mesmo sem evidência de chegada

2. **"⭐ Não esqueça de dar o seu voto!"**
   - **Condição**: Existe produto sem voto do usuário atual
   - **Exibição**: Card destacado com gradiente bege claro e borda dourada
   - **Ação**: Botão "Ir para Votações" que redireciona para `/votes`
   - **Status**: ✅ Implementado
   - **Quando aparece**: Quando há produtos no sistema que o usuário ainda não votou

3. **"📊 Menor saldo detectado!"**
   - **Condição**: Usuário está em última posição (ou dividindo a última) no ranking de **SALDO** (não total de contribuições)
   - **Exibição**: Card destacado com gradiente amarelo claro
   - **Ação**: Apenas informativo (sem botão de ação)
   - **Status**: ✅ Implementado
   - **Quando aparece**: Quando o saldo do usuário é igual ao menor saldo entre todos os usuários ativos (ou todos têm saldo 0)
   - **Nota importante**: Este aviso verifica o **SALDO** atual do usuário, não o total de contribuições. O saldo é calculado a partir da última compensação + contribuições após ela.

**Regras dos Avisos**:
- Aparecem apenas se as condições forem verdadeiras
- Múltiplos avisos podem aparecer simultaneamente
- Ordem de prioridade: 1. Chegada do café, 2. Voto pendente, 3. Menor contribuição
- Atualizam automaticamente quando dados mudam

#### Dashboard

**1. Lista de Colaboradores (Corrida de Barras)**

- **Formato**: Gráfico de barras horizontal (ECharts)
- **Dados**: Nome e total de KGs dos últimos X meses (baseado em `calculationBaseMonths`)
- **Base de cálculo**: Apenas contribuições dentro de `calculationBaseMonths` meses
- **Visual**: Barras horizontais com cores diferentes (cada barra tem uma cor única em tons de marrom/café do tema do sistema)
- **Ordenação**: Do maior para o menor contribuidor
- **Tooltip**: Mostra nome e quantidade em kg ao passar o mouse
- **Interatividade**: Hover mostra detalhes, labels mostram valores

**2. Indicadores de Cafeína**

```
┌─────────────────────────────────────┐
│  Indicadores                        │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Valor Total Investido          │ │
│  │ R$ 1.250,00                   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ KGs Total Consumido            │ │
│  │ 45.5 kg                        │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Média Consumo Mensal           │ │
│  │ 7.6 kg                         │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Média Investimento Mensal      │ │
│  │ R$ 208,00                      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Média Custo por Colaborador    │ │
│  │ R$ 416,00                      │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

- **Métricas** (exibidas em cards):
  - Valor total investido (soma de todas as contribuições)
  - KGs total consumido (soma de todas as quantidades)
  - Média de consumo mensal (média de KGs por mês com registro)
  - Média de investimento mensal (média de valores por mês com registro)
  - Média custo por colaborador (total investido / número de colaboradores ativos)

**3. Linha do Tempo**

- **Gráfico de barras** (ECharts)
- **Eixo X**: Meses
- **Eixo Y**: Quantidade de KGs
- **Barras**: Cada cor representa um usuário, com imagem do usuário na barra
- **Tooltip**: Mostra usuário, quantidade de KGs naquele mês
- **Interatividade**: Zoom, hover com detalhes

---

## ⚙️ Settings - `/settings`

### Acesso
- **Apenas logados** com `isActive: true`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  Settings                           │
│                                     │
│  Seus Dados:                        │
│  - Nome: João Silva                 │
│  - Email: joao@example.com          │
│  - Foto: [Atualizar]                │
│                                     │
│  (Se ADMIN)                         │
│  ┌─────────────────────────────┐   │
│  │ Configurações do Sistema    │   │
│  │                              │   │
│  │ Quantidade de Meses para     │   │
│  │ Base de Cálculo: [6] meses  │   │
│  │                              │   │
│  │ [Salvar]                    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Elementos
- **Dados do usuário**: Edição de informações básicas (nome, foto)
  - **Nome**: Editável (campo de texto)
  - **Foto**: Editável (upload de arquivo ou link do Google Drive)
  - **Email**: Apenas visualização (não editável)
- **Se Admin**: Seção adicional com configurações do sistema
  - Migração de saldos de todos os usuários

### Comportamento
- Ao clicar "Editar", campos de nome e foto tornam-se editáveis
- Foto pode ser atualizada via upload de arquivo ou link do Google Drive
- Salvar alterações atualiza Firestore
- Validações apropriadas
- Após salvar, perfil é atualizado e modal de edição é fechado

---

## 📝 Modal: Nova Contribuição

### Acesso
- Abre de `/home` ao clicar "Nova Contribuição"
- Abre de `/contributions` ao clicar "Nova Contribuição"

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  Nova Contribuição          [X]     │
│                                     │
│  Pessoa (apenas se ADMIN):          │
│  ┌─────────────────────────────┐   │
│  │ [Foto] João Silva           │   │
│  │ [Foto] Maria Santos         │   │
│  │ [Foto] Pedro Costa          │   │
│  └─────────────────────────────┘   │
│                                     │
│  Data Compra: [DD/MM/AAAA] *        │
│  Valor (R$): [______] *             │
│  Quantidade (KG): [______] *        │
│                                     │
│  Café/Produto: [____] *             │
│  (Busca com filtro em tempo real)   │
│                                     │
│  Evidência Compra: [Upload] *       │
│  Evidência Chegada: [Upload]        │
│  Data Chegada: [DD/MM/AAAA]         │
│                                     │
│  [Cancelar] [Salvar]               │
└─────────────────────────────────────┘
```

### Campos

1. **Pessoa** (apenas se ADMIN)
   - **Componente especial**: Cards selecionáveis com foto e nome
   - Se não ADMIN: Campo oculto com ID do usuário atual

2. **Data Compra** *
   - Datepicker moderno
   - Formato DD/MM/AAAA
   - Obrigatório

3. **Valor (R$)** *
   - Input numérico
   - Formato monetário brasileiro
   - Obrigatório

4. **Quantidade (KG)** *
   - Input numérico
   - Permitir decimais
   - Obrigatório

5. **Rachar compra (Vaquinha)**
   - Radio buttons: "Não" (padrão) / "Sim"
   - **Disponível para todos os usuários** (não apenas admins)
   - Se "Sim":
     - Mostra lista de usuários ativos (exceto o comprador) para seleção
     - Usuários são selecionados/deselecionados clicando nos cards
     - Mostra resumo: total de pessoas, valor por pessoa, quantidade por pessoa
     - O comprador sempre está incluído automaticamente

6. **Café/Produto** *
   - **Componente especial**: Busca com filtro em tempo real
   - Ao digitar, filtra produtos existentes
   - **Melhorias implementadas**:
     - Lista de produtos desaparece após seleção
     - Campo destaca visualmente quando produto está selecionado (borda marrom e fundo bege claro)
     - Indicador visual ✓ mostra produto selecionado
     - Badge verde mostra "Produto selecionado: [nome]" com botão "Alterar"
     - Badge laranja mostra "Novo produto será criado: [nome]" quando não há seleção
   - Pode selecionar produto existente OU digitar nome novo
   - Se digitar nome novo (sem selecionar): cria produto automaticamente ao salvar
   - **Prevenção de duplicatas**: Ao selecionar um produto, a lista é ocultada para evitar confusão

7. **Evidência Compra** *
   - Campo de texto para colar link do Google Drive OU
   - Upload de arquivo (upload automático ainda não configurado)
   - Preview da imagem selecionada ou confirmação do link
   - Obrigatório: ou link do Google Drive ou arquivo

8. **Evidência Chegada**
   - Campo de texto para colar link do Google Drive OU
   - Upload de arquivo (upload automático ainda não configurado)
   - Preview da imagem selecionada ou confirmação do link
   - Opcional

9. **Data Chegada**
   - Datepicker
   - Opcional

### Regras de Negócio

- **Ao salvar**:
  - **Atomicidade**: Todas as operações são realizadas de forma atômica usando batch do Firestore
    - Se qualquer operação falhar, todas são revertidas (all or nothing)
    - Garante que não haja dados parciais ou inconsistentes
  - Se produto novo foi digitado: Cria produto com:
    - `name`: Nome digitado
    - `description`: null
    - `photoURL`: null
    - `averagePricePerKg`: valor / quantidadeKg
    - `averageRating`: 0
  - Se produto existente: Atualiza `averagePricePerKg` do produto (após criação bem-sucedida):
    - Recalcula: soma todos os valores / soma todos os KGs
  - Cria documento em `contributions` com `isDivided` (false por padrão) **atomicamente**
  - Se `isDivided: true`:
    - Cria documentos na subcollection `contributionDetails` para cada participante **no mesmo batch**
    - Divide `quantityKg` e `value` igualmente entre todos os participantes (incluindo comprador)
    - Atualiza saldo de todos os participantes com a quantidade atribuída (após batch bem-sucedido)
  - Se `isDivided: false`:
    - Atualiza apenas o saldo do comprador com a quantidade total (após batch bem-sucedido)
  - Processamento de imagens: converte link do Google Drive para URL de imagem direta, ou permite upload manual
  - **Validações de segurança**: Usuários devem estar ativos (`isActive: true`) para criar contribuições

- **Validações**:
  - Campos obrigatórios (*)
  - Data compra não pode ser futura
  - Data chegada não pode ser anterior à data compra
  - Valor e quantidade devem ser > 0

---

## 🆕 Modal: Novo Produto

### Acesso
- Abre de `/home` ao clicar "Novo Produto"
- Abre de `/products` ao clicar "Novo Produto"

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  Novo Produto               [X]     │
│                                     │
│  Nome: [________________] *         │
│                                     │
│  Descrição:                         │
│  [________________]                 │
│  [________________]                 │
│                                     │
│  Foto: [Upload]                     │
│  [Preview da imagem]                │
│                                     │
│  [Cancelar] [Salvar]               │
└─────────────────────────────────────┘
```

### Campos

1. **Nome** *
   - Input texto
   - Obrigatório

2. **Descrição**
   - Textarea
   - Opcional

3. **Foto**
   - Upload de imagem
   - Preview
   - Opcional (mas recomendado)

### Regras de Negócio

- Ao salvar: Cria documento em `products`
- `averagePricePerKg`: 0 (atualizado quando houver contribuições)
- `averageRating`: 0

---

## ⭐ Votação - `/votes`

### Acesso
- **Apenas logados** com `isActive: true`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  Votações                           │
│                                     │
│  [Filtrar] [Ordenar]               │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Café Expresso               │   │
│  │ ⭐⭐⭐⭐⭐ (clique para votar)│   │
│  │ Média: 4.5 ⭐               │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Café Gourmet (sem voto)     │   │
│  │ ⭐⭐⭐⭐⭐ (highlight - não votou)│ │
│  │ Média: 3.0 ⭐               │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Elementos

- **Lista de produtos**: Cards com foto, nome, média de rating
- **Sistema de estrelas**: 5 estrelas clicáveis (0-5, permitindo meia estrela)
- **Média exibida**: Média geral do produto (com uma casa decimal, arredondada para baixo)
- **Highlight**: Produtos não votados pelo usuário destacados visualmente
- **Filtros**: ✅ Implementado
  - Por nome (busca em tempo real)
  - Por rating mínimo
- **Ordenação**: ✅ Implementado
  - Por nome (crescente/decrescente)
  - Por rating (crescente/decrescente)
  - Mantém produtos sem voto primeiro (destaque visual)

### Comportamento

- Ao clicar nas estrelas: Atualiza ou cria voto
- Recalcula `averageRating` do produto automaticamente
- Visualização em tempo real da média atualizada

### Regras

- Cada usuário vota apenas uma vez por produto
- Se já votou, atualiza o voto existente
- Arredondamento: Média sempre arredondada para baixo com uma casa decimal (ex: 4.12 = 4.1, 3.67 = 3.6)

---

## 📦 Contribuições - `/contributions`

### Acesso
- **Apenas logados** com `isActive: true`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  Contribuições                      │
│                                     │
│  [Nova Contribuição] [Filtrar]     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ João Silva - 15/12/2024      │   │
│  │ Café Expresso - 5.0 kg       │   │
│  │ R$ 250,00                    │   │
│  │ [Evidências] [Editar]        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Funcionalidades

- **CRUD completo**:
  - Criar (via modal)
  - Ler (listar todas)
  - Atualizar (editar contribuições via modal de edição)
  - Deletar (apenas próprias ou se admin)

- **Informações exibidas nos cards**:
  - Foto e nome do usuário
  - **Indicador de rachamento**: Para colaborações divididas (`isDivided: true`), mostra imagens circulares lado a lado de todos os colaboradores (apenas bolinhas, sem nomes). Nome aparece em tooltip ao passar o mouse sobre a imagem
  - Data da compra
  - Nome do produto
  - Preço médio por kg do produto
  - Avaliação em estrelas do produto
  - Quantidade comprada (kg)
  - Valor total da compra
  - Botão "Evidências" (mostra/oculta evidências de compra e chegada quando disponíveis)

- **Exibição de Evidências**:
  - Botão "Evidências" aparece apenas se houver evidência de compra ou chegada
  - Ao clicar, expande para mostrar imagens das evidências (se disponíveis)
  - Imagens clicáveis abrem em nova aba
  - Se imagem não carregar, mostra link clicável

- **Filtros**: ✅ Implementado
  - Por usuário (dropdown) - inclui contribuições onde o usuário é criador OU participa da rachadinha
  - Por produto (dropdown)
  - Por data inicial
  - Por data final
- **Ordenação**: ✅ Implementado
  - Por data (crescente/decrescente)
  - Por valor (crescente/decrescente)
  - Por quantidade (crescente/decrescente)

### Edição

- Ao editar e adicionar `arrivalEvidence` e `arrivalDate`:
  - Se produto não tem `photoURL`, usa `arrivalEvidence` como foto do produto
- **Contribuições já compensadas**: 
  - Se `purchaseDate <= data da última compensação`, a contribuição é considerada já compensada
  - Um aviso é exibido no modal de edição informando que edições não afetarão o saldo
  - Edições em contribuições já compensadas não atualizam os saldos dos usuários (apenas dados não relacionados ao saldo)

---

## 🏷️ Produtos - `/products`

### Acesso
- **Apenas logados** com `isActive: true`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  Produtos                           │
│                                     │
│  [Novo Produto] [Filtrar]          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Foto] Café Expresso        │   │
│  │ Média: R$ 50,00/kg          │   │
│  │ Rating: 4.5 ⭐              │   │
│  │ [Editar]                    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Funcionalidades

- **CRUD completo**:
  - Criar (via modal)
  - Ler (listar todos)
  - Atualizar (editar produtos)
  - Deletar (quando não houver contribuições vinculadas)

- **Filtros**: ✅ Implementado
  - Por nome (busca em tempo real)
  - Por rating mínimo
  - Por preço máximo (R$/kg)
- **Ordenação**: ✅ Implementado
  - Por nome (crescente/decrescente)
  - Por rating (crescente/decrescente)
  - Por preço médio (crescente/decrescente)

---

## 📋 Menu Lateral

### Estados

- **Collapsed**: Apenas logo mini visível
- **Expanded**: Logo mini + textos

### Logo

- **Ícone do menu**: Logo mini (logo_mini.png) substitui o emoji de xícara
- **Texto ao lado do logo**: "meu Café Grão" em preto quando expandido
- **Fundo**: Menu clareado com gradiente bege claro para melhor visibilidade do logo marrom

### Botões

1. **Home** → `/home`
2. **Contribuições** → `/contributions`
3. **Votações** → `/votes`
4. **Produtos** → `/products`
5. **Settings** → `/settings`
6. **Usuários** → `/users` (apenas para administradores)

### Comportamento

- Clicar no menu ou botão toggle expande/colapsa
- Transição suave
- Persiste estado (opcional: localStorage)
- Itens marcados como `adminOnly` só aparecem para usuários com `isAdmin: true`

---

## 🦶 Footer

### Elementos

O footer aparece fixo na parte inferior de todas as páginas que usam o componente `Layout`.

**Elementos do Footer**:
- **Nome e slogan**: "☕ CAFÉ GRÃO - Controle Automático de Fornecimento, Estoque e Gerenciamento de Registro de Abastecimento Operacional"
- **Créditos**: "Feito com ❤️ e muito ☕ | [Ano atual]"

### Características

- **Posição**: Fixo na parte inferior (`position: fixed`)
- **Largura**: Do menu lateral até a borda direita da tela
- **Background**: Cor marrom translúcida (`rgba(139, 69, 19, 0.95)`)
- **Texto**: Branco com opacidade variável
- **Espaçamento**: Padding adequado para não sobrepor conteúdo
- **Z-index**: 100 (fica acima do conteúdo mas abaixo de modais)

### Layout

- **Estrutura**: Flexbox com espaçamento entre elementos
- **Responsivo**: Quebra em telas menores (`flexWrap: wrap`)
- **Padding do conteúdo**: O `main` tem `paddingBottom: 80px` para evitar sobreposição com o footer

---

## 👥 Usuários - `/users`

### Acesso
- **Apenas administradores** (`isAdmin: true` e `isActive: true`)
- **Redireciona** usuários não-admin para `/home`

### Layout e Elementos

```
┌─────────────────────────────────────┐
│  [Menu Lateral]                     │
│                                     │
│  Usuários                           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Foto] João Silva            │   │
│  │ joao@example.com             │   │
│  │                              │   │
│  │ ☑ Administrador              │   │
│  │ ☑ Ativo                       │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [Foto] Maria Santos          │   │
│  │ maria@example.com            │   │
│  │                              │   │
│  │ ☐ Administrador              │   │
│  │ ☑ Ativo                       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Funcionalidades

- **Listar todos os usuários**: Exibe todos os usuários do sistema ✅ Implementado
- **Filtros**: ✅ Implementado
  - Por nome (busca em tempo real)
  - Por email (busca em tempo real)
  - Por status de administrador (todos/admin/não-admin)
  - Por status de ativo (todos/ativo/inativo)
- **Ordenação**: ✅ Implementado
  - Por nome (crescente/decrescente)
  - Por email (crescente/decrescente)
  - Por data de criação (crescente/decrescente)
- **Editar flags dos usuários**: ✅ Implementado
  - **isAdmin**: Checkbox para tornar usuário administrador ou não
  - **isActive**: Checkbox para ativar/desativar usuário
- **Deletar usuário**: ✅ Implementado
  - Botão "Deletar" em cada card de usuário
  - Confirmação obrigatória antes de deletar
  - Não permite deletar o próprio usuário
  - Apenas administradores podem deletar
- **Visualização**:
  - Foto do usuário (ou placeholder)
  - Nome do usuário
  - Email do usuário
  - Status visual diferenciado por cores

### Comportamento

- Ao alterar checkbox: Atualiza imediatamente no Firestore ✅
- Ao deletar: Remove usuário do Firestore (não remove do Firebase Auth)
- Feedback visual após salvar/deletar ✅
- Carregamento de todos os usuários ao abrir a página ✅
- Filtros e ordenação aplicados em tempo real ✅

### Regras

- Apenas administradores podem acessar esta página ✅
- Administradores podem editar qualquer flag de qualquer usuário ✅
- Administradores podem deletar qualquer usuário (exceto a si mesmo) ✅
- Não é possível deletar o próprio usuário (proteção implementada) ✅
- Mudanças são salvas imediatamente no Firestore ✅
- ⚠️ **Nota**: A função de deletar remove apenas o documento do Firestore, não remove a conta do Firebase Authentication

---

**Última atualização**: Dezembro 2024

