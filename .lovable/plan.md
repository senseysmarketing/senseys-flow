

## Corrigir Botao "Configurar Saudacao Automatica" Desabilitado

### Causa Raiz

O usuario Francivaldo Lima tem **0 templates de WhatsApp** criados. O botao "Configurar Saudacao Automatica" fica desabilitado quando `templates.length === 0` (linha 574 do componente). O botao aparece cinza/inativo sem nenhuma explicacao visual do motivo.

### Solucao

Modificar o comportamento para que, ao clicar no botao sem templates, o sistema abra automaticamente o modal de templates para o usuario criar sua primeira mensagem. Apos criar o template, a saudacao automatica sera configurada.

### Mudancas

**Arquivo: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`**

1. **Remover o `disabled`** do botao "Configurar Saudacao Automatica" -- ele nunca deve ficar desabilitado
2. **Alterar a funcao `createNewLeadRule`**: quando nao houver templates, abrir o modal de templates (`setShowTemplatesModal(true)`) ao inves de apenas mostrar um toast de erro
3. **Adicionar texto explicativo** abaixo do botao quando nao houver templates, indicando que e necessario criar uma mensagem primeiro
4. **Apos fechar o modal de templates**, recarregar a lista de templates automaticamente (ja ocorre no `onClose` do modal)

### Comportamento Esperado

- Usuario clica em "Configurar Saudacao Automatica"
- Se nao tem templates: abre o modal para criar uma mensagem
- Apos criar o template e fechar o modal: o sistema cria a regra de automacao automaticamente
- Se ja tem templates: cria a regra normalmente (comportamento atual)

### Detalhes Tecnicos

- Remover `disabled={templates.length === 0}` da linha 574
- Na funcao `createNewLeadRule` (linha 266), substituir o toast de erro por `setShowTemplatesModal(true)` e adicionar um estado `pendingAutoCreate` para saber que ao fechar o modal com templates disponiveis, deve-se criar a regra automaticamente
- Adicionar um `useEffect` ou callback no `onClose` do modal de templates para verificar se `pendingAutoCreate` esta ativo e se templates foram criados
