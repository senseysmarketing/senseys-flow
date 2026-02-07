

## Plano: Modal de Gerenciamento de Templates WhatsApp

### Objetivo

Adicionar um botão "Personalizar Templates" abaixo do seletor de template que abre um modal completo para criar, editar e excluir templates de mensagens WhatsApp, incluindo documentação das variáveis dinâmicas disponíveis.

### Design Proposto

O modal terá duas seções:
1. **Lista de Templates**: Cards com os templates existentes, botões de editar/excluir
2. **Variáveis Disponíveis**: Painel informativo mostrando os códigos que podem ser usados

### Variáveis Disponíveis

| Variável | Descrição |
|----------|-----------|
| `{nome}` | Nome do lead |
| `{email}` | Email do lead |
| `{telefone}` | Telefone do lead |
| `{imovel}` | Nome do imóvel vinculado |
| `{corretor}` | Nome do corretor responsável |
| `{empresa}` | Nome da empresa/imobiliária |

### Arquivos a Criar/Modificar

#### 1. Novo Componente: `src/components/whatsapp/WhatsAppTemplatesModal.tsx`

Componente modal que permite:
- Listar templates existentes em cards visuais
- Criar novo template com nome e mensagem
- Editar template existente
- Excluir template (com confirmação)
- Mostrar painel de variáveis disponíveis
- Preview da mensagem com variáveis substituídas por exemplos

#### 2. Modificar: `src/components/whatsapp/WhatsAppIntegrationSettings.tsx`

Adicionar:
- Importação do novo modal
- Estado para controlar abertura do modal
- Botão "Personalizar Templates" abaixo do Select de template
- Callback para atualizar lista de templates após mudanças no modal

### Estrutura do Modal

```text
+-----------------------------------------------+
| Gerenciar Templates de Mensagem          [X]  |
+-----------------------------------------------+
|                                               |
| [+ Novo Template]                             |
|                                               |
| +-------------------------------------------+ |
| | Bom dia                              [✏️][🗑️] | |
| | Olá {nome}! Obrigado pelo seu interesse   | |
| | no imóvel {imovel}...                     | |
| +-------------------------------------------+ |
|                                               |
| +-------------------------------------------+ |
| | Boas vindas                        [✏️][🗑️] | |
| | Olá {nome}, seja bem-vindo(a)!            | |
| +-------------------------------------------+ |
|                                               |
| --- Variáveis Disponíveis ------------------- |
|                                               |
| {nome}      Nome do lead                      |
| {email}     Email do lead                     |
| {telefone}  Telefone do lead                  |
| {imovel}    Nome do imóvel vinculado          |
| {corretor}  Nome do corretor responsável      |
| {empresa}   Nome da empresa                   |
|                                               |
+-----------------------------------------------+
```

### Formulário de Criação/Edição

Quando o usuário clicar em "+ Novo Template" ou editar um existente:

```text
+-----------------------------------------------+
| Novo Template                            [X]  |
+-----------------------------------------------+
|                                               |
| Nome do Template                              |
| [________________________]                    |
|                                               |
| Mensagem                                      |
| +-------------------------------------------+ |
| | Olá {nome}! Obrigado pelo interesse no    | |
| | imóvel {imovel}. Sou {corretor}, vou te   | |
| | ajudar a encontrar seu imóvel ideal.      | |
| +-------------------------------------------+ |
|                                               |
| Variáveis: clique para inserir                |
| [{nome}] [{email}] [{imovel}] [{corretor}]   |
|                                               |
|                       [Cancelar] [Salvar]     |
+-----------------------------------------------+
```

### Fluxo de Uso

```text
Usuário está em "Template de Mensagem"
        ↓
Clica em "Personalizar Templates"
        ↓
Modal abre mostrando templates existentes
        ↓
Usuário pode:
  - Ver templates e variáveis disponíveis
  - Criar novo template
  - Editar template existente
  - Excluir template
        ↓
Ao fechar modal, lista de templates atualiza
        ↓
Novo template disponível no Select
```

### Detalhes Técnicos

**Props do Modal:**
```typescript
interface WhatsAppTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesChange: () => void; // Callback para atualizar lista
}
```

**Variáveis disponíveis (array para facilitar manutenção):**
```typescript
const TEMPLATE_VARIABLES = [
  { code: '{nome}', label: 'Nome do lead', example: 'João Silva' },
  { code: '{email}', label: 'Email do lead', example: 'joao@email.com' },
  { code: '{telefone}', label: 'Telefone do lead', example: '(11) 99999-9999' },
  { code: '{imovel}', label: 'Imóvel vinculado', example: 'Apartamento Centro' },
  { code: '{corretor}', label: 'Corretor responsável', example: 'Maria Santos' },
  { code: '{empresa}', label: 'Nome da empresa', example: 'Imobiliária ABC' },
];
```

### Resultado Esperado

- Usuário pode gerenciar templates diretamente da tela de automações
- Documentação clara das variáveis disponíveis
- Inserção rápida de variáveis com clique
- Preview visual de como a mensagem ficará
- Templates criados ficam imediatamente disponíveis no select

