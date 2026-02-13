

## Adicionar "Dados do Formulario" ao painel lateral de Lead nas Conversas

### O que sera feito

Incluir a secao "Dados do Formulario" no painel lateral (`LeadPanel`) que aparece na tela de Conversas e no modal de chat. O componente `LeadFormFields` ja existe e busca os dados automaticamente da tabela `lead_form_field_values` -- basta reutiliza-lo dentro do `LeadPanel`.

### Detalhes tecnicos

**Arquivo: `src/components/conversations/LeadPanel.tsx`**

1. Importar o componente `LeadFormFields` de `@/components/LeadFormFields`
2. Adicionar o componente apos a secao de "Observacoes" (ou apos "Detalhes" caso nao haja observacoes), precedido por um `<Separator />`
3. Passar `lead.id` como prop: `<LeadFormFields leadId={lead.id} />`
4. O componente ja se auto-oculta quando nao ha campos preenchidos, entao nao precisa de logica condicional extra

Resultado visual: apos as secoes de Contato, Detalhes e Observacoes, aparecera a secao "Dados do Formulario" com os campos em grid, usando o mesmo layout compacto (`grid-cols-2`) que funciona bem no espaco do painel lateral. Como o painel tem largura limitada (~320-384px), o grid de 2 colunas pode precisar ser ajustado para `grid-cols-1` -- mas isso sera avaliado visualmente e o componente pode ser usado diretamente pois os cards sao compactos.

