
-- Backfill: Insert ref field values for leads from form 1504091144275936 that have property_id linked
INSERT INTO public.lead_form_field_values (lead_id, field_name, field_label, field_value)
SELECT l.id, 'ref', 'Código de Referência', p.reference_code
FROM public.leads l
JOIN public.properties p ON p.id = l.property_id
WHERE l.meta_form_id = '1504091144275936'
  AND l.property_id IS NOT NULL
  AND p.reference_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_form_field_values lf 
    WHERE lf.lead_id = l.id 
    AND lf.field_name IN ('ref', 'reference_code', 'codigo_referencia', 'codigo_imovel')
  );

-- Also backfill for ALL other forms that have leads with property_id but no ref field saved
INSERT INTO public.lead_form_field_values (lead_id, field_name, field_label, field_value)
SELECT l.id, 'ref', 'Código de Referência', p.reference_code
FROM public.leads l
JOIN public.properties p ON p.id = l.property_id
WHERE l.meta_form_id IS NOT NULL
  AND l.property_id IS NOT NULL
  AND p.reference_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_form_field_values lf 
    WHERE lf.lead_id = l.id 
    AND lf.field_name IN ('ref', 'reference_code', 'codigo_referencia', 'codigo_imovel')
  );
