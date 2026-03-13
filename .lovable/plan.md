

## Modernizar Navegação: Floating Sidebar → Slim Edge Rail + Command Palette

### 1. Reescrever `FloatingSidebar.tsx` como Edge Rail

Substituir o container flutuante (`fixed left-4 top-1/2 -translate-y-1/2 rounded-2xl bg-[#465666]`) por uma barra fixa colada à esquerda:

- **Container**: `fixed left-0 top-0 h-screen z-50 bg-[#1e1e20] border-r border-white/5`
- **Largura**: Framer Motion anima entre `64px` (recolhido) e `200px` (expandido) no hover
- **Remover**: `rounded-2xl`, `shadow-elevated`, `left-4`, `-translate-y-1/2`
- **Ícones/texto**: cor `text-[#a6c8e1]` (cinza claro azulado)
- **Item ativo**: `bg-white/5` + barra vertical esquerda `w-1 h-5 bg-[#81afd1]` (manter lógica atual mas trocar cores)
- **Hover nos itens**: `hover:bg-white/5 hover:text-white` (sem fundo azul claro)
- **Logo, menu items, bottom section, logout**: manter mesma estrutura funcional, só trocar cores

### 2. Atualizar `Layout.tsx`

- **margin-left**: trocar `ml-[80px]` para `ml-16` (64px exato, correspondendo à largura recolhida)
- **Search button no header**: transformar em Command Palette trigger visual:
  - Fundo `bg-[#5a5f65]/50`, borda `border border-white/10`, rounded-xl
  - Texto: "Buscar ou executar comando..."
  - Tag `⌘ K` mais estilizada com `bg-white/10 text-[#a6c8e1] px-1.5 py-0.5 rounded-md`
  - Largura maior: `min-w-[280px]`

### 3. Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/FloatingSidebar.tsx` | Rewrite: fixed left-0 h-screen, bg-[#1e1e20], cores escuras, sem rounded pill |
| `src/components/Layout.tsx` | ml-16, search → command palette visual |

