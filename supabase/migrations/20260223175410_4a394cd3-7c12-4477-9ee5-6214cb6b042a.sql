UPDATE broker_round_robin 
SET broker_order = '["76859bd7-57d4-4869-b96d-7f48fe315cdf","df0dca52-d783-4586-ab55-28a1093d7224","a9207a34-9ff8-4b43-97b2-729c7bd08cdc","d018c9fd-b5ad-4200-a8cf-538952270d2c","6273cec0-c785-48c5-8ffe-b6dc56262124"]'::jsonb,
    last_broker_index = 0,
    updated_at = now()
WHERE id = 'f6b683ee-9f08-45d9-a9a8-f0334c6863b7';