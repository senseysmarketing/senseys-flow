

## Corrigir Reload da Aba WhatsApp ao Alternar Abas do Navegador

### Causa Raiz

O hook `use-auth.tsx` tem um listener de `visibilitychange` que, ao retornar ao tab do navegador, chama `supabase.auth.getSession()` e faz `setUser(currentSession.user)`. Isso cria uma **nova referência de objeto** para `user`, mesmo sendo o mesmo usuário. Como o `useEffect` principal do `WhatsAppIntegrationSettings` depende de `[user, ...]`, ele re-executa `loadData()` inteiro — fazendo `setLoading(true)` e recarregando tudo do zero.

### Solução

**Arquivo: `src/hooks/use-auth.tsx`** (linhas 61-91)

No handler de `visibilitychange`, evitar chamar `setSession`/`setUser` se a sessão retornada é a mesma que já temos (mesmo `user.id`). Isso previne re-renders desnecessários em toda a árvore de componentes:

```typescript
const handleVisibilityChange = async () => {
  if (document.visibilityState === 'visible') {
    const { data: { session: currentSession }, error } = await supabase.auth.getSession();
    
    if (error) {
      // ... manter lógica de recovery existente
    } else if (currentSession) {
      // Só atualizar state se o user mudou de fato
      if (currentSession.user?.id !== user?.id) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
    }
  }
};
```

Isso é suficiente porque:
- Se o token foi refreshed, o `onAuthStateChange` já cuida disso
- O `visibilitychange` só precisa detectar se a sessão **expirou ou mudou de usuário**, não re-setar o mesmo estado

### Arquivo Modificado

| Arquivo | Ação |
|---------|------|
| `src/hooks/use-auth.tsx` | Adicionar guard no `visibilitychange` para não re-setar `user`/`session` quando são os mesmos |

