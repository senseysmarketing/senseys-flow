UPDATE whatsapp_message_queue
SET status = 'cancelled', error_message = 'Cancelado manualmente antes de reconexão da instância'
WHERE id IN ('905b1151-b77c-4808-b9b0-f4c0d5cdbcb0', '5b3c7243-d7fd-4dbc-ab73-8e5b0503d78b', 'fefc6361-91e3-43f2-aaca-94e8d76e2ab2')
  AND status = 'pending';