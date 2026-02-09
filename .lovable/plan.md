

## Plano: Mensagem Padrao no Botao WhatsApp

### O que muda

O botao de WhatsApp nos cards de lead voltara a enviar uma mensagem pre-definida amigavel, usando o nome do lead e o imovel de interesse (quando disponivel). Sem modal, sem template -- apenas uma mensagem padrao embutida no codigo.

### Mensagem Sugerida

**Com imovel:**
> Ola {nome}! Tudo bem? Vi que voce demonstrou interesse no imovel {imovel}. Estou a disposicao para te ajudar com mais informacoes. Como posso te atender? 😊

**Sem imovel:**
> Ola {nome}! Tudo bem? Vi que voce demonstrou interesse em nossos imoveis. Estou a disposicao para te ajudar. Como posso te atender? 😊

### Arquivo a Modificar

**`src/components/WhatsAppButton.tsx`**

1. Usar as props `leadName` e `propertyName` (que ja existem mas estao sendo ignoradas)
2. Montar a mensagem padrao com `encodeURIComponent`
3. Adicionar `?text=` na URL do `wa.me`

```typescript
const WhatsAppButton = ({ 
  phone, 
  className,
  variant = 'default',
  size = 'sm',
  leadName,
  propertyName,
}: WhatsAppButtonProps) => {
  
  const openWhatsApp = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    let message = '';
    if (leadName) {
      const firstName = leadName.split(' ')[0];
      if (propertyName) {
        message = `Olá ${firstName}! Tudo bem? Vi que você demonstrou interesse no imóvel *${propertyName}*. Estou à disposição para te ajudar com mais informações. Como posso te atender? 😊`;
      } else {
        message = `Olá ${firstName}! Tudo bem? Vi que você demonstrou interesse em nossos imóveis. Estou à disposição para te ajudar. Como posso te atender? 😊`;
      }
    }
    
    const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
    window.open(`https://wa.me/${fullPhone}${textParam}`, '_blank');
  };
```

Nenhum outro arquivo precisa ser alterado pois `leadName` e `propertyName` ja sao passados como props em todos os locais que usam o componente (`LeadMobileCard`, `LeadsTable`, `LeadKanbanCard`).

### Resultado

- Ao clicar no botao WhatsApp, o app abre o wa.me com a mensagem ja preenchida
- O corretor pode editar antes de enviar (comportamento padrao do wa.me)
- Usa apenas o primeiro nome para ser mais pessoal
- Destaca o imovel em negrito com asteriscos do WhatsApp
