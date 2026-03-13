

## Diagnóstico do Card de Lead

O nome do lead está desalinhado porque:

1. O container usa `items-start` (linha 86), alinhando tudo pelo topo
2. O `<div className="flex-1 min-w-0">` (linha 89) envolve apenas o `<h4>` do nome — esse wrapper ocupa mais altura vertical que o texto, criando espaço vazio abaixo do nome

Originalmente, esse wrapper provavelmente tinha um segundo elemento (ex: telefone ou subtítulo) abaixo do nome, que foi movido para a seção "Body" mais abaixo. O espaço vazio remanescente faz o nome parecer desalinhado em relação ao avatar.

### Correção

**Arquivo**: `src/components/LeadKanbanCard.tsx` (linha 86)

- Trocar `items-start` por `items-center` no container do header — isso centraliza verticalmente o avatar, nome, badge de tempo e menu
- Isso resolve o desalinhamento sem precisar adicionar conteúdo extra

