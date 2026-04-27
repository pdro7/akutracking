CREATE TABLE whatsapp_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text UNIQUE NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  escalated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Only service role can access (Edge Function uses service role key)
CREATE POLICY "Service role only" ON whatsapp_conversations
  USING (false);
