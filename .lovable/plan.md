

## Diagnostico e Solucao: Variaveis de Formulario nos Templates WhatsApp

### O que esta acontecendo

Sua analise esta **100% correta**. O lead Cristal Lorca veio do formulario **Cidade-Jardim** (form_id: 1852010645681625) e possui estes campos salvos:

- `você_já_investe_em_imóveis?` → sim, tenho portfólio...
- `qual_seu_momento_de_decisão_para_investir?` → 6 meses
- `qual_valor_você_considera_investir_neste_empreendimento?` → até R$ 300 mil

O template que foi enviado provavelmente usa uma variavel do formulario **Ilha Pura** (ex: `{form_você_está_buscando_imóvel_para_moradia_própria_ou_para_investimento?_}`), que **nao existe** nos dados desse lead. Por isso aparece vazio na mensagem.

### A conta tem 6+ formularios com perguntas sobrepostas

- Art Wood, Cidade-Jardim, Ilha Pura v3/v4/v5/v6, Ipanema v2
- Varias perguntas sao **iguais** entre formularios (ex: "fase da compra", "valor maximo")
- Mas o Cidade-Jardim tem perguntas **exclusivas** (ex: "Voce ja investe em imoveis?")
- Hoje o modal de templates mostra **todas as variaveis de todos os formularios misturadas**, sem indicar de qual formulario vem cada uma

### Solucao: Duas mudancas

#### 1. Confirmar a abordagem correta de configuracao (sem codigo)

Sim, o correto e:
- Criar **um template por formulario/imovel** com as variaveis especificas daquele formulario
- Usar **regras condicionais de saudacao** (que ja existem no sistema) vinculadas a campanha, formulario ou imovel
- Cada regra aponta para o template correto com as variaveis daquele formulario

#### 2. Melhorar o seletor de variaveis no modal de templates (mudanca de codigo)

Agrupar as variaveis por formulario no modal `WhatsAppTemplatesModal`, para ficar claro de qual formulario vem cada variavel.

**Mudancas em `WhatsAppTemplatesModal.tsx`:**

- Alterar `fetchFormVars` para buscar tambem o `form_name` via join com `meta_form_configs`
- Na interface `FormVar`, adicionar campo `formName`
- Na secao expandivel de variaveis, agrupar por nome do formulario com headers visuais (ex: "Cidade-Jardim", "Ilha Pura v6")
- Cada grupo mostra apenas as variaveis daquele formulario

**Layout proposto:**

```text
▼ Mostrar variaveis de formulario Meta (12)

  ── Cidade-Jardim ──
  {form_qual_seu_momento...}   Qual seu momento de decisao...
  {form_você_já_investe...}    Voce ja investe em imoveis?
  {form_qual_valor_você...}    Qual valor voce considera...

  ── Ilha Pura v6 ──
  {form_Para_entendermos...}   Para entendermos melhor...
  {form_Qual_o_valor...}       Qual o valor maximo...
  {form_Você_está_buscando...} Voce esta buscando...

  ── Art Wood ──
  ...
```

### Arquivo a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/whatsapp/WhatsAppTemplatesModal.tsx` | Agrupar variaveis por formulario, buscar form_name via join |

### Impacto

- Nenhuma mudanca no backend ou edge functions
- Apenas melhoria de UX no seletor de variaveis
- O sistema de substituicao de variaveis ja funciona corretamente — o problema e de configuracao (template errado para o formulario do lead)

