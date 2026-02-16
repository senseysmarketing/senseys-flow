
-- Step 1: Insert 23 new leads
INSERT INTO leads (account_id, name, phone, email, status_id, temperature, property_id, origem, created_at) VALUES
-- 3 Fechados (vendas de alto valor)
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Ricardo Mendes', '11987654321', 'ricardo.mendes@gmail.com', 'a22d3cb2-7540-4dca-80ec-b5c5b2fe071e', 'hot', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '12 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Patricia Almeida', '11976543210', 'patricia.almeida@outlook.com', 'a22d3cb2-7540-4dca-80ec-b5c5b2fe071e', 'hot', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Meta Ads', now() - interval '18 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Eduardo Santos', '11965432109', 'eduardo.santos@yahoo.com', 'a22d3cb2-7540-4dca-80ec-b5c5b2fe071e', 'hot', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7', 'Indicação', now() - interval '25 days'),
-- 5 Novo Lead
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Fernanda Costa', '11954321098', 'fernanda.costa@gmail.com', '623d184a-8cdb-436d-97cc-6df1f48c7217', 'warm', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '1 day'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Marcos Oliveira', '11943210987', NULL, '623d184a-8cdb-436d-97cc-6df1f48c7217', 'cold', '8d4a6dff-bc5b-4cbe-a4ac-a289fc2f3d1b', 'Site', now() - interval '2 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Juliana Pereira', '11932109876', 'juliana.p@hotmail.com', '623d184a-8cdb-436d-97cc-6df1f48c7217', 'hot', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Meta Ads', now() - interval '1 day'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Roberto Campos', '11921098765', NULL, '623d184a-8cdb-436d-97cc-6df1f48c7217', 'warm', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7', 'Meta Ads', now() - interval '3 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Camila Rodrigues', '11910987654', 'camila.r@gmail.com', '623d184a-8cdb-436d-97cc-6df1f48c7217', 'warm', '25ffaa90-0854-4fb5-b26e-65eaebd5986e', 'Webhook', now()),
-- 4 Em Contato
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'André Martins', '11998877665', 'andre.m@gmail.com', '4dc322f9-af0f-4edc-a067-7ebd2c2fa11a', 'warm', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '5 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Beatriz Souza', '11997766554', NULL, '4dc322f9-af0f-4edc-a067-7ebd2c2fa11a', 'hot', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Meta Ads', now() - interval '4 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Diego Ferreira', '11996655443', 'diego.f@outlook.com', '4dc322f9-af0f-4edc-a067-7ebd2c2fa11a', 'cold', '3e249b2c-79e2-43b1-a0c0-bad10d4e6b5f', 'Site', now() - interval '6 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Isabela Nascimento', '11995544332', 'isabela.n@gmail.com', '4dc322f9-af0f-4edc-a067-7ebd2c2fa11a', 'warm', '8d4a6dff-bc5b-4cbe-a4ac-a289fc2f3d1b', 'Indicação', now() - interval '7 days'),
-- 3 Qualificado
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Thiago Lima', '11994433221', 'thiago.lima@gmail.com', '718d6a08-72ea-4a44-9a38-7cf57855107f', 'hot', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '8 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Larissa Barbosa', '11993322110', NULL, '718d6a08-72ea-4a44-9a38-7cf57855107f', 'warm', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7', 'Meta Ads', now() - interval '10 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Gustavo Ribeiro', '11992211009', 'gustavo.r@yahoo.com', '718d6a08-72ea-4a44-9a38-7cf57855107f', 'hot', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Indicação', now() - interval '9 days'),
-- 3 Visita Agendada
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Amanda Carvalho', '11991100998', 'amanda.c@gmail.com', 'c5883355-ed6e-4b32-a81a-b0a4c49659a6', 'hot', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '6 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Felipe Moreira', '11990099887', NULL, 'c5883355-ed6e-4b32-a81a-b0a4c49659a6', 'warm', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7', 'Meta Ads', now() - interval '5 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Renata Vieira', '11989988776', 'renata.v@hotmail.com', 'c5883355-ed6e-4b32-a81a-b0a4c49659a6', 'warm', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Site', now() - interval '4 days'),
-- 2 Proposta
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Lucas Teixeira', '11988877665', 'lucas.t@gmail.com', 'f355954c-6bfd-4f2c-8d07-6928319961ed', 'hot', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '10 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Marina Azevedo', '11987766554', 'marina.a@outlook.com', 'f355954c-6bfd-4f2c-8d07-6928319961ed', 'hot', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7', 'Indicação', now() - interval '14 days'),
-- 2 Negociação
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Paulo Henrique Silva', '11986655443', 'paulo.h@gmail.com', '940ebc66-5a74-4df8-bb52-7d2c26219d01', 'hot', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49', 'Meta Ads', now() - interval '15 days'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Daniela Freitas', '11985544332', NULL, '940ebc66-5a74-4df8-bb52-7d2c26219d01', 'warm', '404b450b-b197-42b7-a251-e948ba09081f', 'Meta Ads', now() - interval '20 days'),
-- 1 Perdido
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Carlos Nogueira', '11984433221', 'carlos.n@gmail.com', '05a817db-b8f6-4d5c-b6ca-66ec82f99667', 'cold', '3e249b2c-79e2-43b1-a0c0-bad10d4e6b5f', 'Site', now() - interval '30 days');

-- Step 2: Update property statuses for sold/reserved
UPDATE properties SET status = 'vendido' WHERE id = '404b450b-b197-42b7-a251-e948ba09081f';
UPDATE properties SET status = 'reservado' WHERE id = '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49';
UPDATE properties SET status = 'vendido' WHERE id = 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7';

-- Step 3: Form-to-property mappings
INSERT INTO meta_form_property_mapping (account_id, form_id, form_name, reference_code, property_id) VALUES
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'form_cobertura_jardins', 'Cobertura Duplex Jardins', 'APT004', '404b450b-b197-42b7-a251-e948ba09081f'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'form_casa_alphaville', 'Casa 4 Suítes Alphaville', 'CASA001', '7fcfe992-90a5-40fc-b5bc-9d1c3a6b3e49'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'form_apt_itaim', 'Apartamento Itaim Bibi', 'APT001', 'b21d9eea-27a5-4828-8e06-cd3e0c7fefe7'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'form_studio_pinheiros', 'Studio Pinheiros', 'APT002', '8d4a6dff-bc5b-4cbe-a4ac-a289fc2f3d1b');

-- Step 4: Daily ad insights (30 days, ~R$100/day, total ~R$3000)
INSERT INTO meta_ad_insights (account_id, date, spend, impressions, clicks, leads_count, cpl, cpc, cpm, reach) VALUES
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 30, 95.50, 4200, 85, 3, 31.83, 1.12, 22.74, 3800),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 29, 102.30, 4500, 92, 4, 25.58, 1.11, 22.73, 4100),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 28, 88.70, 3900, 78, 2, 44.35, 1.14, 22.74, 3500),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 27, 110.20, 4800, 98, 4, 27.55, 1.12, 22.96, 4300),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 26, 97.80, 4300, 87, 3, 32.60, 1.12, 22.74, 3900),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 25, 105.60, 4600, 94, 3, 35.20, 1.12, 22.96, 4200),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 24, 92.40, 4100, 82, 2, 46.20, 1.13, 22.54, 3700),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 23, 115.30, 5000, 102, 5, 23.06, 1.13, 23.06, 4500),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 22, 98.90, 4350, 88, 3, 32.97, 1.12, 22.74, 3950),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 21, 108.40, 4700, 96, 4, 27.10, 1.13, 23.06, 4250),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 20, 85.20, 3750, 75, 2, 42.60, 1.14, 22.72, 3400),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 19, 112.70, 4900, 100, 4, 28.18, 1.13, 23.00, 4400),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 18, 94.30, 4150, 84, 3, 31.43, 1.12, 22.72, 3750),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 17, 103.50, 4550, 93, 3, 34.50, 1.11, 22.75, 4100),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 16, 99.80, 4400, 89, 3, 33.27, 1.12, 22.68, 3980),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 15, 118.60, 5200, 106, 5, 23.72, 1.12, 22.81, 4700),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 14, 91.40, 4000, 81, 2, 45.70, 1.13, 22.85, 3600),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 13, 107.20, 4650, 95, 4, 26.80, 1.13, 23.05, 4200),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 12, 96.50, 4250, 86, 3, 32.17, 1.12, 22.71, 3850),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 11, 104.80, 4580, 93, 3, 34.93, 1.13, 22.88, 4130),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 10, 89.60, 3950, 79, 2, 44.80, 1.13, 22.68, 3570),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 9, 113.90, 4950, 101, 4, 28.48, 1.13, 23.01, 4470),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 8, 97.30, 4280, 87, 3, 32.43, 1.12, 22.73, 3870),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 7, 106.50, 4630, 94, 4, 26.63, 1.13, 23.00, 4180),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 6, 93.70, 4120, 83, 2, 46.85, 1.13, 22.74, 3720),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 5, 111.40, 4870, 99, 4, 27.85, 1.13, 22.87, 4390),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 4, 100.20, 4410, 90, 3, 33.40, 1.11, 22.72, 3990),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 3, 109.80, 4780, 97, 4, 27.45, 1.13, 22.97, 4310),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 2, 95.10, 4190, 85, 3, 31.70, 1.12, 22.70, 3790),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', CURRENT_DATE - 1, 107.60, 4680, 95, 4, 26.90, 1.13, 22.99, 4220);

-- Step 5: Ad insights by ad (per property/form) - distribute ~R$3000 across 4 properties over 30 days
-- Cobertura Jardins (~35% = R$1050)
INSERT INTO meta_ad_insights_by_ad (account_id, date, ad_id, ad_name, campaign_id, campaign_name, form_id, spend, impressions, clicks, leads_count, cpl, cpc, cpm, reach) 
SELECT '6e7a7df6-a3d8-4775-8a43-3e20704ef985', d::date, 'ad_jardins_001', 'Cobertura Jardins - Lead', 'camp_001', 'Imóveis Alto Padrão', 'form_cobertura_jardins',
  round((random() * 8 + 30)::numeric, 2), (random() * 500 + 1200)::int, (random() * 15 + 25)::int, (random() * 2 + 1)::int, 0, 0, 0, (random() * 400 + 1000)::int
FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day'::interval) d;

-- Casa Alphaville (~25% = R$750)
INSERT INTO meta_ad_insights_by_ad (account_id, date, ad_id, ad_name, campaign_id, campaign_name, form_id, spend, impressions, clicks, leads_count, cpl, cpc, cpm, reach)
SELECT '6e7a7df6-a3d8-4775-8a43-3e20704ef985', d::date, 'ad_alphaville_001', 'Casa Alphaville - Lead', 'camp_001', 'Imóveis Alto Padrão', 'form_casa_alphaville',
  round((random() * 8 + 20)::numeric, 2), (random() * 400 + 900)::int, (random() * 12 + 18)::int, (random() * 2)::int, 0, 0, 0, (random() * 350 + 750)::int
FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day'::interval) d;

-- Apt Itaim (~25% = R$750)
INSERT INTO meta_ad_insights_by_ad (account_id, date, ad_id, ad_name, campaign_id, campaign_name, form_id, spend, impressions, clicks, leads_count, cpl, cpc, cpm, reach)
SELECT '6e7a7df6-a3d8-4775-8a43-3e20704ef985', d::date, 'ad_itaim_001', 'Apartamento Itaim - Lead', 'camp_002', 'Apartamentos SP', 'form_apt_itaim',
  round((random() * 8 + 20)::numeric, 2), (random() * 400 + 900)::int, (random() * 12 + 18)::int, (random() * 2)::int, 0, 0, 0, (random() * 350 + 750)::int
FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day'::interval) d;

-- Studio Pinheiros (~15% = R$450)
INSERT INTO meta_ad_insights_by_ad (account_id, date, ad_id, ad_name, campaign_id, campaign_name, form_id, spend, impressions, clicks, leads_count, cpl, cpc, cpm, reach)
SELECT '6e7a7df6-a3d8-4775-8a43-3e20704ef985', d::date, 'ad_pinheiros_001', 'Studio Pinheiros - Lead', 'camp_002', 'Apartamentos SP', 'form_studio_pinheiros',
  round((random() * 5 + 12)::numeric, 2), (random() * 300 + 600)::int, (random() * 8 + 12)::int, (random() * 1.5)::int, 0, 0, 0, (random() * 250 + 500)::int
FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day'::interval) d;

-- Step 6: Events (15 new events over next 14 days)
INSERT INTO events (account_id, title, description, start_time, end_time, location, created_by) VALUES
-- Visitas a imóveis
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Cobertura Jardins (Amanda)', 'Visita agendada com Amanda Carvalho para conhecer a Cobertura Duplex', (CURRENT_DATE + 1) + time '10:00', (CURRENT_DATE + 1) + time '11:00', 'Rua Oscar Freire, 1500 - Jardins', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Apt Itaim (Felipe)', 'Felipe Moreira quer conhecer o apartamento', (CURRENT_DATE + 2) + time '14:00', (CURRENT_DATE + 2) + time '15:00', 'Rua Joaquim Floriano, 820 - Itaim Bibi', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Casa Alphaville (Renata)', 'Renata Vieira - segunda visita ao imóvel', (CURRENT_DATE + 2) + time '09:30', (CURRENT_DATE + 2) + time '10:30', 'Alameda das Acácias, 300 - Alphaville', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Studio Pinheiros (André)', 'André Martins interessado no studio', (CURRENT_DATE + 3) + time '11:00', (CURRENT_DATE + 3) + time '12:00', 'Rua dos Pinheiros, 450', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Cobertura Jardins (Thiago)', 'Thiago Lima - lead qualificado, primeira visita', (CURRENT_DATE + 4) + time '15:00', (CURRENT_DATE + 4) + time '16:00', 'Rua Oscar Freire, 1500 - Jardins', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Casa Alphaville (Gustavo)', 'Gustavo Ribeiro qualificado, visita agendada', (CURRENT_DATE + 5) + time '10:00', (CURRENT_DATE + 5) + time '11:30', 'Alameda das Acácias, 300 - Alphaville', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Apt Vila Madalena (Diego)', 'Diego Ferreira quer revisitar o apartamento', (CURRENT_DATE + 7) + time '14:00', (CURRENT_DATE + 7) + time '15:00', 'Rua Harmonia, 250 - Vila Madalena', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Visita - Sala Faria Lima (Camila)', 'Camila Rodrigues interessada na sala comercial', (CURRENT_DATE + 8) + time '16:00', (CURRENT_DATE + 8) + time '17:00', 'Av. Faria Lima, 3000', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
-- Reuniões
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Reunião - Proposta Lucas Teixeira', 'Apresentação de proposta para Cobertura Jardins', (CURRENT_DATE + 3) + time '14:00', (CURRENT_DATE + 3) + time '15:30', 'Escritório', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Reunião - Negociação Paulo Henrique', 'Contraproposta Casa Alphaville', (CURRENT_DATE + 5) + time '14:00', (CURRENT_DATE + 5) + time '15:00', 'Escritório', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Reunião - Marina Azevedo (proposta)', 'Discussão de valores do Apt Itaim', (CURRENT_DATE + 6) + time '10:00', (CURRENT_DATE + 6) + time '11:00', 'Escritório', 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
-- Follow-ups
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Follow-up - Beatriz Souza', 'Ligar para Beatriz sobre Casa Alphaville', (CURRENT_DATE + 1) + time '15:00', (CURRENT_DATE + 1) + time '15:30', NULL, 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Follow-up - Fernanda Costa', 'Retorno sobre interesse na Cobertura', (CURRENT_DATE + 2) + time '16:00', (CURRENT_DATE + 2) + time '16:30', NULL, 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Follow-up - Larissa Barbosa', 'Enviar material do Apt Itaim', (CURRENT_DATE + 4) + time '09:00', (CURRENT_DATE + 4) + time '09:30', NULL, 'e4e07296-bd00-4160-af45-5e0a36eca0f0'),
-- Assinatura de contrato
('6e7a7df6-a3d8-4775-8a43-3e20704ef985', 'Assinatura de Contrato - Daniela Freitas', 'Finalização da venda da Cobertura Jardins', (CURRENT_DATE + 10) + time '10:00', (CURRENT_DATE + 10) + time '11:30', 'Cartório - Av. Paulista, 1500', 'e4e07296-bd00-4160-af45-5e0a36eca0f0');
