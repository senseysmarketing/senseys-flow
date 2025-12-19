-- Inserir 5 leads da conta Braz Imóveis (importação CSV)

-- Lead 1: Jéssica Pavão (AP0189-OSWG) - warm
INSERT INTO public.leads (
  account_id, status_id, property_id, name, email, phone, origem,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign_id, meta_ad_name, meta_campaign_name,
  created_at, temperature
) VALUES (
  '7629c620-65a5-4e89-afbf-599cd221db5d',
  '9a98f091-5f59-4ae5-872e-511e305c5f94',
  '05959c37-a5b2-4d8a-af67-f79fa8bfd1fb',
  'Jéssica Pavão',
  'jessica.andrade.pavao@gmail.com',
  '+5519998399639',
  'Meta Ads',
  '1324515555343052',
  '1324491608678780',
  '120215996377620605',
  '120215996377550605',
  'AP0189-OSWG_R$1.640M - Carrossel',
  'AP0189-OSWG_R$1.640M',
  '2025-12-18 16:48:39+00',
  'warm'
);

-- Lead 2: josihenrique (AP0189-OSWG) - warm
INSERT INTO public.leads (
  account_id, status_id, property_id, name, email, phone, origem,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign_id, meta_ad_name, meta_campaign_name,
  created_at, temperature
) VALUES (
  '7629c620-65a5-4e89-afbf-599cd221db5d',
  '9a98f091-5f59-4ae5-872e-511e305c5f94',
  '05959c37-a5b2-4d8a-af67-f79fa8bfd1fb',
  'josihenrique',
  'josiane.henrique@gmail.com',
  '+5511994334343',
  'Meta Ads',
  '579aborede053456836',
  '1324491608678780',
  '120215996377620605',
  '120215996377550605',
  'AP0189-OSWG_R$1.640M - Carrossel',
  'AP0189-OSWG_R$1.640M',
  '2025-12-18 12:49:33+00',
  'warm'
);

-- Lead 3: Tu Monteiro (AP0189-OSWG) - warm
INSERT INTO public.leads (
  account_id, status_id, property_id, name, email, phone, origem,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign_id, meta_ad_name, meta_campaign_name,
  created_at, temperature
) VALUES (
  '7629c620-65a5-4e89-afbf-599cd221db5d',
  '9a98f091-5f59-4ae5-872e-511e305c5f94',
  '05959c37-a5b2-4d8a-af67-f79fa8bfd1fb',
  'Tu Monteiro',
  'tu.monteiro@hotmail.com',
  '+5511987333328',
  'Meta Ads',
  '1324436342017640',
  '1324491608678780',
  '120215996377620605',
  '120215996377550605',
  'AP0189-OSWG_R$1.640M - Carrossel',
  'AP0189-OSWG_R$1.640M',
  '2025-12-18 11:30:16+00',
  'warm'
);

-- Lead 4: Mayara (AP0189-OSWG) - cold
INSERT INTO public.leads (
  account_id, status_id, property_id, name, email, phone, origem,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign_id, meta_ad_name, meta_campaign_name,
  created_at, temperature
) VALUES (
  '7629c620-65a5-4e89-afbf-599cd221db5d',
  '9a98f091-5f59-4ae5-872e-511e305c5f94',
  '05959c37-a5b2-4d8a-af67-f79fa8bfd1fb',
  'Mayara',
  'Maydonatti@icloud.com',
  '+5516992297439',
  'Meta Ads',
  '1324447268683214',
  '1324491608678780',
  '120215996377620605',
  '120215996377550605',
  'AP0189-OSWG_R$1.640M - Carrossel',
  'AP0189-OSWG_R$1.640M',
  '2025-12-18 10:30:21+00',
  'cold'
);

-- Lead 5: Leidiane Sales (AP0186-OSWG) - hot
INSERT INTO public.leads (
  account_id, status_id, property_id, name, email, phone, origem,
  meta_lead_id, meta_form_id, meta_ad_id, meta_campaign_id, meta_ad_name, meta_campaign_name,
  created_at, temperature
) VALUES (
  '7629c620-65a5-4e89-afbf-599cd221db5d',
  '9a98f091-5f59-4ae5-872e-511e305c5f94',
  '8a84d160-4490-437f-b3da-23fd27769644',
  'Leidiane Sales',
  'leidiane_salles@hotmail.com',
  '+5511984742608',
  'Meta Ads',
  '9aborede5669609543285',
  '580536481463620',
  '120215996371390605',
  '120215996371320605',
  'AP0186-OSWG_R$1.550M - Carrossel',
  'AP0186-OSWG_R$1.550M',
  '2025-12-19 05:32:44+00',
  'hot'
);