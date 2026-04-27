ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'waiting', 'escalated', 'closed'));

-- Back-fill escalated conversations
UPDATE whatsapp_conversations SET status = 'escalated' WHERE escalated = true;
