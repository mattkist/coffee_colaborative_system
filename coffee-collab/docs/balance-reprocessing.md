# Reprocessamento de Saldos - CAFÉ GRÃO

Este documento descreve como funciona o sistema de reprocessamento de saldos e por que ele é necessário.

---

## 🎯 Problema Identificado

Anteriormente, quando uma contribuição era salva ou atualizada, o sistema calculava o novo saldo **incrementalmente**:

```javascript
// ❌ MÉTODO ANTIGO (PROBLEMÁTICO)
const oldBalance = user.balance || 0
const newBalance = oldBalance + contributionDifference
await updateUserProfile(userId, { balance: newBalance })
```

**Problema**: Se o saldo atual já estivesse errado (por qualquer motivo), o novo saldo também estaria errado, porque ele assume que o saldo antigo estava correto.

---

## ✅ Solução Implementada

Agora, após salvar ou atualizar uma contribuição, o sistema **reprocessa todos os saldos** de todos os usuários, garantindo que os valores estejam sempre corretos.

### Como Funciona

1. **Pega o saldo da última compensação** (ou 0 se o usuário não estava na última compensação)
2. **Soma todas as contribuições** que ocorreram **APÓS** a última compensação
3. **Atualiza apenas os usuários** cujo novo saldo seja diferente do saldo atual

### Função Principal: `reprocessAllUserBalances()`

```javascript
export async function reprocessAllUserBalances() {
  // 1. Pega última compensação
  const lastCompDate = await getLastCompensationDate()
  const lastCompensation = await getLastCompensation()
  
  // 2. Filtra contribuições após última compensação
  const contributionsAfterCompensation = lastCompDate
    ? allContributions.filter(c => c.purchaseDate > lastCompDate)
    : allContributions
  
  // 3. Para cada usuário:
  for (const user of allUsers) {
    // 3a. Saldo base = saldo após última compensação (ou 0)
    let baseBalance = 0
    if (lastCompensation?.details) {
      const userDetail = lastCompensation.details.find(d => d.userId === user.id)
      baseBalance = userDetail?.balanceAfter || 0
    }
    
    // 3b. Soma contribuições após compensação
    let contributionsKg = 0
    for (const contrib of contributionsAfterCompensation) {
      if (contrib.isDivided) {
        // Para contribuições divididas, pega a parte do usuário
        const userDetail = contrib.details.find(d => d.userId === user.id)
        contributionsKg += userDetail?.quantityKg || 0
      } else if (contrib.userId === user.id) {
        // Contribuição regular - apenas o criador recebe
        contributionsKg += contrib.quantityKg || 0
      }
    }
    
    // 3c. Novo saldo = saldo base + contribuições
    const newBalance = Math.max(0, baseBalance + contributionsKg)
    
    // 3d. Atualiza apenas se mudou
    if (newBalance !== user.balance) {
      await updateUserBalance(user.id, newBalance)
    }
  }
}
```

---

## 📍 Quando o Reprocessamento Ocorre

O reprocessamento é chamado automaticamente em:

1. **Criar nova contribuição** (`createContribution`)
2. **Atualizar contribuição** (`updateContribution`) - exceto se `skipBalanceUpdate: true`
3. **Deletar contribuição** (`deleteContribution`)
4. **Botão manual em Settings** (`migrateAllUserBalances`) - agora chama `reprocessAllUserBalances()`

---

## 🔄 Fluxo Completo

```
Usuário salva contribuição
  ↓
Sistema cria/atualiza contribuição no Firestore
  ↓
Sistema reprocessa TODOS os saldos
  │
  ├─ Pega saldo da última compensação
  ├─ Soma contribuições pós compensação
  └─ Atualiza apenas saldos que mudaram
  ↓
Sistema verifica se deve disparar compensação automática
  ↓
Se sim, executa compensação automática
```

---

## ⚙️ Otimizações

### Atualização Incremental vs. Reprocessamento Completo

**Antes (Incremental)**:
- ⚡ Rápido (O(1) por usuário afetado)
- ❌ Propenso a erros se o saldo atual estiver errado

**Depois (Reprocessamento Completo)**:
- ✅ Sempre correto (recalcula tudo do zero)
- ⚠️ Um pouco mais lento (O(n) onde n = número de contribuições)
- ✅ Atualiza apenas usuários cujo saldo mudou (otimização)

### Performance

- O reprocessamento roda apenas quando necessário (após criar/editar/deletar contribuição)
- Atualiza apenas usuários cujo saldo realmente mudou
- Usa batch writes para atualizar múltiplos usuários de uma vez

---

## 🧪 Testando o Reprocessamento

### Via Botão em Settings

1. Acesse `/settings` como administrador
2. Na seção "Configurações do Sistema", clique em "Migrar Saldos de Todos os Usuários"
3. O sistema reprocessará todos os saldos e mostrará quantos usuários foram atualizados

### Via Código

```javascript
import { reprocessAllUserBalances } from './services/userService'

const result = await reprocessAllUserBalances()
console.log(result.message) // "Balances reprocessed: X user(s) updated"
```

---

## 📝 Notas Importantes

1. **Contribuições já compensadas**: Contribuições com `purchaseDate <= data da última compensação` não afetam o saldo durante o reprocessamento, pois já foram contabilizadas na última compensação.

2. **Contribuições divididas**: O reprocessamento considera corretamente a parte de cada usuário em contribuições divididas (`isDivided: true`).

3. **Novos usuários**: Usuários que não estavam na última compensação começam com saldo 0 e só contabilizam contribuições após a última compensação.

4. **Compensação automática**: Após o reprocessamento, o sistema verifica se todos os usuários têm saldo > 0 e, se sim, dispara uma compensação automática.

---

**Última atualização**: Dezembro 2024


