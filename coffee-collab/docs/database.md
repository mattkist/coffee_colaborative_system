# Estrutura do Banco de Dados - CAFÉ GRÃO

Este documento descreve a estrutura completa do banco de dados Firestore utilizada no sistema.

> **⚠️ IMPORTANTE**: Toda estrutura do banco de dados (nomes de collections, documentos, campos) deve estar em **INGLÊS**.

---

## 📊 Collections

### 1. `configurations`

Armazena configurações globais do sistema.

**Estrutura do Documento**:
```javascript
{
  id: string,              // ID único do documento
  name: string,            // Nome da configuração
  description: string,     // Descrição da configuração
  value: any               // Valor da configuração (pode ser string, number, etc.)
}
```

**Configurações Padrão**:
- `calculationBaseMonths`: Number (default: 6) - Quantidade de meses para base de cálculo de contribuições

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Apenas administradores (`isAdmin: true`)

---

### 2. `users`

Armazena perfis de usuários do sistema.

**Estrutura do Documento**:
```javascript
{
  id: string,              // ID único (mesmo do Firebase Auth UID)
  email: string,           // Email do usuário
  name: string,            // Nome completo
  photoURL: string | null, // URL da foto de perfil
  isAdmin: boolean,        // Indica se o usuário é administrador
  isActive: boolean,       // Indica se o usuário está ativo
  balance: number,         // Saldo atual do usuário (em kg) - default: 0
  createdAt: Timestamp,    // Data de criação do perfil
  updatedAt: Timestamp     // Data de última atualização
}
```

**Regras Especiais**:
- Se não houver nenhum admin no banco, o primeiro usuário que fizer login automaticamente se torna admin (`isAdmin: true`)
- Ao criar novo usuário, `isActive` começa como `false`
- Ao criar novo usuário, envia email para todos os admins notificando sobre o novo cadastro

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Usuário pode editar seu próprio perfil OU admins podem editar qualquer perfil

---

### 3. `contributions`

Armazena todas as contribuições (compras de café) registradas.

**Estrutura do Documento**:
```javascript
{
  id: string,                      // ID único do documento (gerado automaticamente)
  userId: string,                   // FK: ID do usuário que contribuiu (reference to users)
  purchaseDate: Timestamp,          // Data da compra
  value: number,                    // Valor gasto (R$)
  quantityKg: number,              // Quantidade comprada (em KG)
  productId: string,               // FK: ID do produto/café (reference to products)
  purchaseEvidence: string | null, // URL da imagem/comprovante da compra
  arrivalEvidence: string | null,  // URL da imagem/evidência da chegada
  arrivalDate: Timestamp | null,   // Data de chegada do café
  isDivided: boolean,               // Indica se a compra foi rachada entre colaboradores (default: false)
  createdAt: Timestamp,            // Data de criação do registro
  updatedAt: Timestamp             // Data de última atualização
}
```

**Subcollection: `contributionDetails` (Detalhe)**

Quando `isDivided: true`, cada documento na subcollection representa um participante do rachamento:
```javascript
{
  id: string,                    // ID único do documento
  userId: string,                 // FK: ID do usuário participante (reference to users)
  userName: string,               // Nome do usuário (para exibição)
  quantityKg: number,             // Quantidade de kg atribuída a este usuário
  value: number,                  // Valor atribuído a este usuário (R$)
  createdAt: Timestamp           // Data de criação
}
```

**Regras de Negócio**:
- Ao criar contribuição, `purchaseEvidence` é obrigatório
- `arrivalEvidence` e `arrivalDate` são opcionais inicialmente
- Se `arrivalEvidence` for adicionada e o produto ainda não tiver foto, essa evidência vira a foto do produto
- Ao atualizar uma contribuição de um produto existente, recalcular `averagePricePerKg` do produto
- Se `isDivided: true`:
  - A quantidade e valor são divididos igualmente entre todos os participantes (incluindo o comprador)
  - Cada participante recebe `quantityKg / totalParticipantes` e `value / totalParticipantes`
  - O saldo de cada participante é atualizado com a quantidade atribuída a ele
  - Os participantes são armazenados na subcollection `contributionDetails`
- Se `isDivided: false` (ou não definido, padrão):
  - A quantidade completa é atribuída apenas ao comprador (`userId`)
  - O saldo do comprador é atualizado com a quantidade total

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Todos usuários autenticados (admins podem criar para qualquer usuário, usuários comuns apenas para si mesmos)

---

### 4. `products`

Armazena produtos/cafés disponíveis no sistema.

**Estrutura do Documento**:
```javascript
{
  id: string,                    // ID único do documento (gerado automaticamente)
  name: string,                  // Nome do produto/café
  description: string | null,    // Descrição do produto
  photoURL: string | null,       // URL da foto do produto
  averagePricePerKg: number,     // Média de preço por KG (calculado automaticamente)
  averageRating: number          // Média de pontuação (0-5, arredondada em meia estrela)
}
```

**Regras de Negócio**:
- `averagePricePerKg`: Calculado automaticamente somando todos os valores de contribuições para este produto e dividindo pela soma de todos os KGs
- `averageRating`: Calculado automaticamente somando todas as pontuações e dividindo pelo total de votos (arredondado para meia estrela)
- Produtos criados automaticamente via modal de contribuição começam com:
  - `description: null`
  - `photoURL: null`
  - `averagePricePerKg`: valor informado / kg informado
  - `averageRating: 0`

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Todos usuários autenticados

---

### 5. `votes`

Armazena votos/avaliações dos usuários sobre os produtos.

**Estrutura do Documento**:
```javascript
{
  id: string,           // ID único do documento (gerado automaticamente)
  userId: string,       // FK: ID do usuário que votou (reference to users)
  productId: string,    // FK: ID do produto votado (reference to products)
  rating: number       // Pontuação (0-5, permitindo meia estrela: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
}
```

**Regras de Negócio**:
- Cada usuário pode votar apenas uma vez por produto
- Se usuário votar novamente no mesmo produto, atualiza o voto existente (não cria novo)
- Ao votar ou atualizar voto, recalcular `averageRating` do produto correspondente
- `averageRating` = soma de todos os ratings / total de votos (arredondado para meia estrela)

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Usuário pode votar apenas para si mesmo

---

### 6. `compensations`

Armazena compensações realizadas no sistema.

**Estrutura do Documento (Mestre)**:
```javascript
{
  id: string,                    // ID único do documento
  date: Timestamp,               // Data da compensação
  totalKg: number,               // Total de kg compensado
  createdAt: Timestamp,          // Data de criação
  updatedAt: Timestamp           // Data de atualização
}
```

**Subcollection: `compensationDetails` (Detalhe)**

Cada documento na subcollection representa um usuário que participou da compensação:
```javascript
{
  id: string,                    // ID único do documento
  userId: string,                 // FK: ID do usuário (reference to users)
  userName: string,               // Nome do usuário (para exibição)
  balanceBefore: number,         // Saldo antes da compensação
  balanceAfter: number,          // Saldo após a compensação
  compensationKg: number          // Quantidade de kg compensada para este usuário
}
```

**Regras de Negócio**:
- Compensações são criadas automaticamente quando todos os usuários ativos têm `balance > 0`
- A compensação remove o menor saldo entre todos os usuários
- Todos os usuários têm o mesmo valor reduzido (igual ao menor saldo)
- Compensações podem ser criadas manualmente por admins via CRUD

**Regras de Segurança**:
- Leitura: Todos usuários autenticados
- Escrita: Apenas administradores

---

## 🔗 Relacionamentos

```
users (1) ────< (N) contributions
products (1) ────< (N) contributions
users (1) ────< (N) votes
products (1) ────< (N) votes
```

**Regras de Integridade**:
- Ao deletar um produto, manter contribuições e votos (não deletar em cascata)
- Ao deletar um usuário, manter contribuições e votos (histórico preservado)
- Referências são armazenadas como `string` (ID do documento)

---

## 📐 Índices Recomendados

Para performance em queries, criar índices compostos:

1. `contributions`: `userId` + `purchaseDate` (desc)
2. `contributions`: `productId` + `purchaseDate` (desc)
3. `votes`: `userId` + `productId` (único)
4. `votes`: `productId` + `rating` (desc)

---

## 🔄 Cálculos Automáticos

### Average Price Per KG (produtos)

```
averagePricePerKg = 
  SUM(contributions WHERE productId = X).value / 
  SUM(contributions WHERE productId = X).quantityKg
```

**Quando recalcular**:
- Ao criar nova contribuição
- Ao atualizar valor ou quantidade de uma contribuição existente
- Ao deletar uma contribuição

### Average Rating (produtos)

```
averageRating = 
  SUM(votes WHERE productId = X).rating / 
  COUNT(votes WHERE productId = X)
```

**Arredondamento**: Sempre para meia estrela mais próxima (0, 0.5, 1, 1.5, ..., 5)

**Quando recalcular**:
- Ao criar novo voto
- Ao atualizar voto existente
- Ao deletar um voto

---

## 🔒 Regras de Segurança (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Configurations - leitura livre, escrita apenas por admins
    match /configurations/{configId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Users - leitura livre, escrita própria ou por admin
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if request.auth != null && (
        request.auth.uid == userId ||
        isAdmin()
      );
    }
    
    // Contributions - leitura livre, escrita por todos autenticados
    match /contributions/{contributionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        isAdmin()
      );
      
      // Contribution details subcollection (para contribuições rachadas)
      match /contributionDetails/{detailId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && (
          // Permite se o usuário é o dono da contribuição ou admin
          get(/databases/$(database)/documents/contributions/$(contributionId)).data.userId == request.auth.uid ||
          isAdmin()
        );
      }
    }
    
    // Products - leitura livre, escrita por todos autenticados
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Votes - leitura livre, escrita apenas própria
    match /votes/{voteId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Compensations - leitura e escrita livre para usuários autenticados
    match /compensations/{compensationId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
      
      // Compensation details subcollection
      match /compensationDetails/{detailId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
    }
  }
}
```

**⚠️ IMPORTANTE**: Estas regras devem ser atualizadas no Firebase Console. Veja a seção [Configurações de Serviços Remotos](../main.md#configurações-de-serviços-remotos) no `main.md` para instruções detalhadas.

---

**Última atualização**: Dezembro 2024




