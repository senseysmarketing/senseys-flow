

## Plano: Remover "Templates WhatsApp" das Configurações de Leads

### Contexto

A opção "Templates WhatsApp" no menu de configurações de Leads é redundante, pois agora os templates podem ser gerenciados diretamente na tela de configuração de automação de saudação automática (via botão "Personalizar Templates").

### Mudança

Remover o item do array `settingsItems` no arquivo `src/components/leads/LeadsSettingsSheet.tsx`.

### Arquivo a Modificar

**`src/components/leads/LeadsSettingsSheet.tsx`**

Remover estas linhas (58-63):
```typescript
{
  id: "whatsapp" as SettingsTab,
  icon: MessageCircle,
  label: "Templates WhatsApp",
  description: "Crie mensagens prontas para contato via WhatsApp",
},
```

E também remover a importação do ícone `MessageCircle` que não será mais utilizado.

Atualizar o tipo `SettingsTab` para remover `"whatsapp"`.

### Resultado

O menu de configurações de Leads terá apenas 5 opções:
1. Status dos Leads
2. Regras de Distribuição
3. Qualificação Automática
4. Follow-up Automático
5. Importar Leads

