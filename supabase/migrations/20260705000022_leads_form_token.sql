-- form_token identifies a lead in the public preferences form. It is
-- generated automatically for every lead and never guessable — used
-- instead of the primary id so parents visiting the tokenized URL cannot
-- read or write other leads by incrementing an id.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS form_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS leads_form_token_idx ON leads(form_token);
