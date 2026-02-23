UPDATE whatsapp_message_queue
SET status = 'cancelled', error_message = 'Cancelado manualmente antes de reconexão da instância'
WHERE id IN ('905b1151-aff6-4565-85ab-840c60e7d2fa', '5b3c7243-e77f-4551-9f4a-544c34ac1c7c', 'fefc6361-0900-42cc-9d1c-332f56dcc5d9')
  AND status = 'pending';