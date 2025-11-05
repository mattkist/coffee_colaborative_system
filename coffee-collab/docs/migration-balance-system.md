# Migração para Sistema de Saldo e Compensações

## 📋 Resumo da Mudança

Esta migração substitui o sistema atual baseado em "Quantidade de Meses para Base de Cálculo" por um novo sistema de **Saldo** e **Compensações**, tornando a fila de compra mais justa para novos usuários.

---

## 🎯 Objetivos

1. **Remover** a variável `calculationBaseMonths` do sistema
2. **Adicionar** campo `balance` (saldo) em cada usuário
3. **Criar** sistema de Compensações (mestre-detalhe)
4. **Implementar** lógica automática de compensação quando ninguém tem saldo 0
5. **Atualizar** gráficos e cálculos para usar saldo em vez de período
6. **Criar** endpoint para migração inicial de saldos
7. **Adicionar** CRUD de compensações
8. **Adicionar** tooltips explicativos

---

## 📊 Estrutura de Dados

### Collection: `users` (Atualização)

**Novo campo adicionado:**
```javascript
{
  // ... campos existentes
  balance: number,  // Saldo atual do usuário (em kg) - default: 0
}
```

### Collection: `compensations` (Nova)

**Estrutura do Documento (Mestre):**
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
  userId: string,                 // FK: ID do usuário
  userName: string,               // Nome do usuário (para exibição)
  balanceBefore: number,         // Saldo antes da compensação
  balanceAfter: number,          // Saldo após a compensação
  compensationKg: number          // Quantidade de kg compensada para este usuário
}
```

---

## 🔄 Lógica de Funcionamento

### Como o Saldo Funciona

1. **Saldo Inicial**: Todo usuário começa com `balance: 0`
2. **Ao Comprar Café**: O saldo aumenta com a quantidade comprada (`quantityKg`)
   - Exemplo: User compra 1kg → `balance += 1`
3. **Compensação Automática**: Quando **todos os usuários ativos têm saldo > 0**, uma compensação é disparada automaticamente
4. **Após Compensação**: O saldo de cada usuário é reduzido proporcionalmente

### Exemplo de Funcionamento

```
Estado inicial:
User 1: balance = 0
User 2: balance = 0
User 3: balance = 0

User 1 compra 1kg:
User 1: balance = 1
User 2: balance = 0
User 3: balance = 0

User 2 compra 0.5kg:
User 1: balance = 1
User 2: balance = 0.5
User 3: balance = 0

User 3 compra 1kg:
User 1: balance = 1
User 2: balance = 0.5
User 3: balance = 1

[Nenhum usuário tem saldo 0 → Dispara compensação automática]

Compensação executada (total: 0.5kg - menor saldo):
User 1: balance = 0.5 (era 1, reduziu 0.5)
User 2: balance = 0 (era 0.5, reduziu 0.5)
User 3: balance = 0.5 (era 1, reduziu 0.5)

Agora User 2 é o próximo da fila (tem saldo 0)
```

### Regras de Compensação

1. **Trigger**: Quando todos os usuários ativos têm `balance > 0`
2. **Quantidade**: A compensação remove o menor saldo entre todos os usuários
3. **Proporcional**: Todos os usuários têm o mesmo valor reduzido (igual ao menor saldo)
4. **Histórico**: Toda compensação é registrada em `compensations` com detalhes

---

## 📝 Tarefas de Implementação

### 1. Atualização do Banco de Dados

- [x] Adicionar campo `balance` na collection `users` (default: 0)
- [x] Criar collection `compensations` com subcollection `compensationDetails`
- [x] Atualizar regras de segurança do Firestore

### 2. Serviços (Services)

- [x] Criar `compensationService.js` com funções:
  - `createCompensation(date, totalKg, details)`
  - `getAllCompensations()`
  - `getCompensationById(id)`
  - `getCompensationDetails(compensationId)`
  - `checkAndTriggerCompensation()` - verifica se deve disparar compensação
  - `executeCompensation()` - executa a compensação automática

- [x] Atualizar `userService.js`:
  - Adicionar `balance` ao criar usuário (default: 0)
  - Função `updateUserBalance(userId, newBalance)`
  - Função `getAllUsersWithBalance()` - retorna usuários com saldo

- [x] Atualizar `contributionService.js`:
  - Ao criar contribuição: aumentar `balance` do usuário
  - Ao atualizar contribuição: recalcular `balance` do usuário
  - Ao deletar contribuição: reduzir `balance` do usuário
  - Verificar se deve disparar compensação após criar/atualizar contribuição

- [x] Remover referências a `calculationBaseMonths`:
  - Remover de `configurationService.js`
  - Remover de `Settings.jsx`
  - Remover de `Home.jsx`

### 3. Endpoint de Migração

- [x] Criar endpoint `/api/migrate-balances` ou função `migrateAllUserBalances()` em `userService.js`
- [x] Lógica:
  1. Buscar todas as contribuições
  2. Buscar todas as compensações
  3. Para cada usuário:
     - Calcular total de contribuições (soma de `quantityKg`)
     - Calcular total de compensações (soma de `compensationKg` do usuário)
     - `balance = totalContributions - totalCompensations`
  4. Atualizar `balance` de todos os usuários

### 4. Componentes

- [x] Criar `Compensations.jsx` - página CRUD de compensações
- [x] Criar `CompensationModal.jsx` - modal para criar/editar compensação
- [x] Atualizar `CollaboratorsChart.jsx`:
  - Usar `balance` em vez de cálculo por período
  - Mudar título para "Saldo dos Colaboradores"
  - Adicionar tooltip explicativo sobre saldo
- [x] Atualizar `Home.jsx`:
  - Usar `balance` para calcular próximo na fila
  - Remover referências a `calculationBaseMonths`
  - Atualizar alerta de "menor contribuição" para usar saldo
- [x] Atualizar `Settings.jsx`:
  - Remover seção de "Quantidade de Meses para Base de Cálculo"

### 5. Lógica de Compensação Automática

- [x] Ao criar/atualizar contribuição:
  1. Atualizar saldo do usuário
  2. Verificar se todos os usuários ativos têm `balance > 0`
  3. Se sim, disparar compensação automática:
     - Encontrar menor saldo
     - Criar registro de compensação
     - Reduzir saldo de todos proporcionalmente
     - Criar detalhes da compensação

### 6. Tooltips e Documentação

- [x] Adicionar tooltip no gráfico de colaboradores explicando saldo
- [x] Adicionar tooltip no CRUD de compensações explicando como funciona
- [x] Atualizar documentação (`database.md`, `pages.md`)

---

## 🔐 Regras de Segurança (Firestore)

### `compensations`
```javascript
match /compensations/{compensationId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
  
  match /compensationDetails/{detailId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null && 
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
  }
}
```

---

## 🚀 Migração de Dados

### Endpoint de Migração

**Endpoint**: Função `migrateAllUserBalances()` em `userService.js`

**Como usar**:
1. Acessar a página `/settings` como administrador
2. Na seção "Configurações do Sistema", clicar no botão "Migrar Saldos de Todos os Usuários"
3. Confirmar a ação
4. A função irá:
   - Buscar todas as contribuições
   - Buscar todas as compensações existentes
   - Calcular saldo de cada usuário
   - Atualizar campo `balance` em todos os usuários
5. A página será recarregada automaticamente após a conclusão

**Lógica de Cálculo**:
```javascript
balance = SUM(contributions.quantityKg) - SUM(compensations.compensationKg)
```

Se não houver compensações, `balance = total de contribuições`.

**Nota**: Esta função está disponível na página Settings (`/settings`) apenas para administradores.

---

## 📊 Mudanças no Dashboard

### Gráfico de Colaboradores

**Antes**: Mostrava total de KGs nos últimos X meses
**Depois**: Mostra saldo atual de cada colaborador

**Título**: "Saldo dos Colaboradores"

### Próximo na Fila

**Antes**: Usuário com menor total de KGs no período
**Depois**: Usuário com menor saldo (ou saldo = 0)

### Alerta de Menor Contribuição

**Antes**: Alerta baseado em ranking dos últimos X meses
**Depois**: Alerta baseado em saldo atual

---

## ✅ Checklist de Implementação

- [ ] 1. Atualizar estrutura do banco de dados
- [ ] 2. Criar `compensationService.js`
- [ ] 3. Atualizar `userService.js` com campo balance
- [ ] 4. Atualizar `contributionService.js` para gerenciar saldo
- [ ] 5. Criar função de migração `migrateAllUserBalances()`
- [ ] 6. Criar página `Compensations.jsx`
- [ ] 7. Criar modal `CompensationModal.jsx`
- [ ] 8. Atualizar `CollaboratorsChart.jsx`
- [ ] 9. Atualizar `Home.jsx`
- [ ] 10. Atualizar `Settings.jsx`
- [ ] 11. Implementar lógica de compensação automática
- [ ] 12. Adicionar tooltips explicativos
- [ ] 13. Atualizar regras de segurança do Firestore
- [ ] 14. Atualizar documentação
- [ ] 15. Testar migração de dados

---

## 📝 Notas Importantes

1. **Compatibilidade**: Usuários existentes sem `balance` devem ter `balance: 0` por padrão
2. **Compensações Manuais**: Admins podem criar compensações manuais via CRUD
3. **Histórico**: Todas as compensações ficam registradas para consulta histórica
4. **Novos Usuários**: Começam com `balance: 0` e só participam do ciclo atual
5. **Performance**: Compensação automática é executada após criar/atualizar contribuição

---

**Data de Criação**: Dezembro 2024
**Status**: Em Planejamento

