

## Sidebar Logo + Remover White Label

### Mudanças

**1. Copiar favicon para assets**
- Copiar `user-uploads://Fav_v2.png` → `src/assets/logo-icon.png`

**2. `src/components/FloatingSidebar.tsx`**
- Importar `logoIcon` de `@/assets/logo-icon.png`
- Remover `useAccount` (não precisa mais de `account?.logo_url`)
- Logo section: quando recolhido mostrar `logoIcon`, quando expandido mostrar `logoAlternativaBranca`
- Usar `AnimatePresence` para transição suave entre os dois

**3. `src/components/AppSidebar.tsx`**
- Remover referência a `account?.logo_url`, usar sempre `logoAlternativaBranca`

**4. `src/pages/Settings.tsx`**
- Remover tab/case `whitelabel` e o import de `WhiteLabelSettings`

**5. `src/components/WhiteLabelSettings.tsx`**
- Deletar arquivo (ou deixar sem referência — a remoção do import/uso já basta)

