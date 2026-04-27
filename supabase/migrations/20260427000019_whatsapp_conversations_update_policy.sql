CREATE POLICY "Authenticated users can update" ON whatsapp_conversations
  FOR UPDATE USING (auth.role() = 'authenticated');
