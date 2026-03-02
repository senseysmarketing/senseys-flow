
Diagnóstico concluído para o formulário **“R$ 530 Mil | Fazenda Rio Grande v2”**:

### O que eu validei no banco (dados reais)

1. **Form config do formulário**
   - `form_id`: `1504091144275936`
   - `is_configured`: **false** (ainda pendente)
   - `reference_field_name`: `null`

2. **Leads desse formulário**
   - Existem leads recentes desse form, porém **todos anteriores ao último deploy do `meta-webhook`**.
   - Após o deploy de correção (boot em `2026-03-02T17:24:07Z`), esse formulário teve:
     - **0 leads novos**

3. **Campo REF salvo em `lead_form_field_values` para esse formulário**
   - Resultado: **nenhum registro** (`ref`, `reference_code`, `codigo_referencia`, etc.) para os leads desse form.

4. **Se o sistema está recebendo a referência**
   - Para esse form, os leads já chegam com `property_id` preenchido.
   - Isso indica que a referência está sendo usada para vínculo do imóvel no webhook.
   - Em outro formulário com lead pós-deploy, já existe `field_name = 'ref'` salvo em `lead_form_field_values`, provando que a correção nova está funcionando para novos eventos.

### Conclusão objetiva

- Para o formulário **R$ 530 Mil | Fazenda Rio Grande v2**, o REF **não aparece ainda** porque:
  1) os leads existentes foram processados antes da correção de persistência, e  
  2) **não entrou lead novo desse form** depois do deploy para gerar dados já no formato corrigido.

- Além disso, no frontend de qualificação, a lista de “Campo de Código de Referência” depende majoritariamente de `meta_form_scoring_rules` (perguntas com opções), então campo REF textual/hidden pode não aparecer nessa lista mesmo quando existe no payload.

### Plano de implementação recomendado

1. **Backfill dos leads antigos desse formulário**
   - Popular `lead_form_field_values` para leads antigos com um valor de referência consistente (ex.: via `properties.reference_code` quando `property_id` já está vinculado).
   - Isso resolve imediatamente a visualização histórica no modal do lead.

2. **Melhorar detecção de campo de referência no frontend**
   - Em `MetaFormScoringManager`, buscar candidatos de referência também de `lead_form_field_values` (distinct por formulário), não só de `meta_form_scoring_rules`.
   - Assim, REF aparece no seletor mesmo se vier como campo textual/hidden.

3. **Ajustar sincronização de formulários Meta**
   - No `sync-meta-forms`, manter exclusão de REF para pontuação, mas registrar/propagar REF como **campo elegível para vinculação**.
   - Separar claramente:
     - campos de pontuação (múltipla escolha),
     - campos de referência (texto/código).

4. **Validação fim a fim**
   - Gerar 1 lead teste nesse form após ajustes.
   - Confirmar:
     - REF visível em “Dados do Formulário”,
     - referência disponível no seletor de “Campo de Código de Referência”,
     - badge de configuração atualiza corretamente após salvar.
