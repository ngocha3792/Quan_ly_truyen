-- Official OpenAI connections now use the Responses API. Compatible proxies
-- remain on Chat Completions unless the user explicitly configures otherwise.
UPDATE "ai_connections"
SET "protocol" = 'openai_responses'::"ai_protocol"
WHERE "vendor_hint" = 'OPENAI'
  AND "protocol" = 'openai_chat_completions'::"ai_protocol";

UPDATE "ai_conversations"
SET "protocol" = 'openai_responses'::"ai_protocol"
WHERE "vendor_hint" = 'OPENAI'
  AND "protocol" = 'openai_chat_completions'::"ai_protocol";
