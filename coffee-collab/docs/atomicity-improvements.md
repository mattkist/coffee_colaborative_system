# Melhorias de Atomicidade - CAFÉ GRÃO

Este documento descreve as melhorias implementadas para garantir atomicidade nas operações de criação e edição de contribuições.

---

## 🎯 Problema Identificado

Anteriormente, as operações de criação e edição de contribuições não eram totalmente atômicas. Isso podia resultar em:

- **Dados parciais**: Contribuição criada mas detalhes não salvos
- **Totais duplicados**: Saldos e totais somados múltiplas vezes mesmo com erros
- **Inconsistências**: Produtos criados mas contribuições não vinculadas
- **Falhas silenciosas**: Erros que não revertiam operações já realizadas

---

## ✅ Solução Implementada

### Atomicidade com Batch do Firestore

Todas as operações críticas agora são realizadas usando `writeBatch` do Firestore, que garante que **todas as operações sejam aplicadas ou nenhuma** (all or nothing).

### Operações Atômicas

#### 1. Criação de Contribuição (`createContribution`)

**Antes**:
```javascript
// Operações sequenciais - se uma falhar, as anteriores já foram aplicadas
await addDoc(contributionsRef, newContribution)
await batch.commit() // Para detalhes
await updateProductAveragePrice(productId)
await reprocessAllUserBalances()
```

**Depois**:
```javascript
// Todas as operações críticas em um único batch
const batch = writeBatch(db)
batch.set(contributionRef, newContribution)
// ... adiciona todos os detalhes no mesmo batch
await batch.commit() // Tudo ou nada

// Operações não-críticas após sucesso (com tratamento de erro)
try {
  await updateProductAveragePrice(productId)
} catch (error) {
  // Não falha a operação principal
}
```

**Benefícios**:
- ✅ Contribuição e detalhes são criados atomicamente
- ✅ Se qualquer parte falhar, nada é salvo
- ✅ Previne dados parciais ou inconsistentes

#### 2. Edição de Contribuição (`updateContribution`)

**Antes**:
```javascript
// Múltiplos batches separados
await batch.commit() // Deletar detalhes antigos
await newBatch.commit() // Criar novos detalhes
await updateDoc(contributionRef, updateData)
```

**Depois**:
```javascript
// Tudo em um único batch
const batch = writeBatch(db)
batch.update(contributionRef, updateData)
// ... deleta detalhes antigos no mesmo batch
// ... cria novos detalhes no mesmo batch
await batch.commit() // Tudo ou nada
```

**Benefícios**:
- ✅ Atualização da contribuição e detalhes são atômicas
- ✅ Não há janela de inconsistência entre deletar e criar
- ✅ Previne estados intermediários inválidos

---

## 🔒 Segurança

### Regras do Firestore Atualizadas

As regras de segurança foram atualizadas para verificar `isActive`:

```javascript
allow create: if request.auth != null && isAuthenticatedAndActive();
allow update, delete: if request.auth != null && isAuthenticatedAndActive() && (
  resource.data.userId == request.auth.uid ||
  isAdmin()
);
```

**Benefícios**:
- ✅ Usuários inativos não podem criar contribuições
- ✅ Previne criação de contribuições por usuários não autorizados
- ✅ Erro 400 Bad Request resolvido para usuários não-admin ativos

---

## 📊 Fluxo de Operações

### Criação de Contribuição

```
1. Validação de dados (frontend)
   ↓
2. Preparação de dados (userProfiles, etc.)
   ↓
3. Batch único atômico:
   - Criar documento de contribuição
   - Criar detalhes (se dividida)
   ↓
4. Se sucesso: Operações não-críticas (com tratamento de erro)
   - Atualizar preço médio do produto
   - Reprocessar saldos
   - Verificar compensações
   ↓
5. Se erro: Nada é salvo (rollback automático)
```

### Edição de Contribuição

```
1. Validação de dados (frontend)
   ↓
2. Preparação de dados (userProfiles, etc.)
   ↓
3. Batch único atômico:
   - Atualizar documento de contribuição
   - Deletar detalhes antigos (se mudou)
   - Criar novos detalhes (se necessário)
   ↓
4. Se sucesso: Operações não-críticas (com tratamento de erro)
   - Atualizar preço médio do produto
   - Reprocessar saldos (se não skipBalanceUpdate)
   - Verificar compensações
   ↓
5. Se erro: Nada é alterado (rollback automático)
```

---

## 🛡️ Tratamento de Erros

### Operações Críticas vs. Não-Críticas

**Críticas** (dentro do batch):
- Criação/atualização da contribuição
- Criação/deleção de detalhes
- ✅ **Devem falhar tudo se alguma falhar**

**Não-Críticas** (após batch):
- Atualização de preço médio do produto
- Reprocessamento de saldos
- Verificação de compensações
- ✅ **Podem falhar sem afetar a operação principal**

### Estratégia de Recuperação

Operações não-críticas que falham:
- Logam o erro para diagnóstico
- Não impedem a operação principal de ser bem-sucedida
- Podem ser corrigidas em reprocessamento posterior

---

## 📝 Notas Técnicas

### Limitações do Batch

- Batch do Firestore suporta até **500 operações**
- Para contribuições com muitos participantes, garantir que não exceda o limite
- Se necessário, considerar transações para casos mais complexos

### Performance

- Batch é mais eficiente que operações sequenciais
- Reduz número de round-trips ao Firestore
- Melhora consistência e reduz latência

---

## 🔄 Compatibilidade

### Código Existente

- ✅ Compatível com código existente
- ✅ Não requer mudanças em componentes que usam os serviços
- ✅ Mantém mesma interface de funções

### Migração

- ✅ Nenhuma migração necessária
- ✅ Melhorias são transparentes para o usuário
- ✅ Dados existentes permanecem válidos

---

## 📚 Referências

- [Firestore Batch Writes](https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**Última atualização**: Dezembro 2024  
**Implementado por**: Melhorias de atomicidade e segurança


