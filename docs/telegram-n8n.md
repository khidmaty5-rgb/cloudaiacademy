# Telegram + n8n Workflows

This document describes the two n8n workflows needed to operate the provider-facing Telegram integration. Secrets remain in n8n; the frontend never sees bot tokens or chat IDs.

Prerequisites
- Telegram bot created with BotFather; keep BOT_TOKEN secure in n8n credentials.
- Bot added to your target Telegram group/supergroup/channel as admin.
- The app’s .env.local contains a server-only secret: `N8N_WEBHOOK_SECRET=...` (already wired in server routes).

Server endpoints (already implemented)
- Provider-only (Firebase ID token required):
  - POST /api/telegram/connect/start
  - POST /api/telegram/jobs/create
  - GET  /api/telegram/jobs/list
  - POST /api/telegram/jobs/cancel
- n8n-only (must send header `X-N8N-SECRET`):
  - POST /api/telegram/connect/confirm
  - GET  /api/n8n/telegram/due?limit=50
  - POST /api/n8n/telegram/mark

---

A) Workflow: Telegram Connect Handler
Goal: when a provider sends `/connect CODE` in their chat, confirm the connection.

Nodes
1) Telegram Trigger
   - Event: On New Message
   - Bot: Use n8n Telegram credentials with BOT_TOKEN.
2) IF node: text startsWith `/connect`
   - Expression: `{{$json["message"]["text"]?.startsWith("/connect")}}`
3) Function: extract code and chat metadata
   - Code:
     ```js
     const msg = $json.message;
     const text = (msg.text || '').trim();
     const parts = text.split(/\s+/);
     const code = parts[1];
     if (!code) {
       return [{ error: 'Missing code' }];
     }
     const chat = msg.chat || {};
     return [{
       code,
       chatId: String(chat.id),
       chatType: chat.type,
       chatTitle: chat.title || chat.username || null,
     }];
     ```
4) HTTP Request: POST /api/telegram/connect/confirm
   - URL: https://<your-host>/api/telegram/connect/confirm
   - Method: POST
   - Headers: `X-N8N-SECRET: {{$env.N8N_WEBHOOK_SECRET}}`, `Content-Type: application/json`
   - Body (JSON): `{ "code": "{{$json.code}}", "chatId": "{{$json.chatId}}", "chatType": "{{$json.chatType}}", "chatTitle": "{{$json.chatTitle}}" }`
5) Optional Telegram Send Message: reply to chat with success/failure

Notes
- Only the server writes the verified chat info to users/{uid}.telegram and marks the code as used.

---

B) Workflow: Scheduled Dispatcher
Goal: periodically fetch due jobs and send them to Telegram.

Nodes
1) Cron
   - Every 1 minute
2) HTTP Request: GET due jobs
   - URL: https://<your-host>/api/n8n/telegram/due?limit=50
   - Method: GET
   - Headers: `X-N8N-SECRET: {{$env.N8N_WEBHOOK_SECRET}}`
3) Split In Batches over `items["jobs"]`
4) IF: payload has mediaUrl
   - Condition: `{{$json["payload"]["mediaUrl"] ? true : false}}`
5a) Telegram Send Photo (if media)
   - Chat ID: `{{$json["chatId"]}}`
   - Photo: `{{$json["payload"]["mediaUrl"]}}`
   - Caption: `{{$json["payload"]["text"] + ( $json["payload"]["linkUrl"] ? "\n" + $json["payload"]["linkUrl"] : "")}}`
5b) Telegram Send Message (if no media)
   - Chat ID: `{{$json["chatId"]}}`
   - Text: `{{$json["payload"]["text"] + ( $json["payload"]["linkUrl"] ? "\n" + $json["payload"]["linkUrl"] : "")}}`
6) HTTP Request: POST mark sent/failed
   - On success:
     - URL: https://<your-host>/api/n8n/telegram/mark
     - Body: `{ "jobId": "{{$json["jobId"]}}", "status": "sent", "telegramMessageId": "{{$node["Telegram Send Message"].json["result"]["message_id"] || $node["Telegram Send Photo"].json["result"]["message_id"]}}" }`
   - On error (use error branch):
     - Body: `{ "jobId": "{{$json["jobId"]}}", "status": "failed", "error": "{{$error.message}}" }`

Hardening & Idempotency
- The server marks jobs as `claimed=true` in a transaction when returned by /due; this prevents double-send across workers.
- Keep dispatcher concurrency low and add a small Delay (50–200ms) if sending many messages.
- Validate payload length (Telegram hard limit ~4096 chars for text; keep well below).
- Sanitize `linkUrl` (must start with http/https) before appending.
- Log failed jobs and consider a retry policy (e.g., limited retries).

---

Manual test steps
1) Connect
   - Log in as provider (admin/teacher).
   - Visit /dashboard/telegram → Generate code.
   - In Telegram, add bot to the target chat and send `/connect <CODE>`.
   - Expect connection status to show connected (after n8n confirm call).
2) Send now
   - Enter text and click "Send now".
   - Message should appear immediately in Telegram after the next dispatcher run.
3) Schedule
   - Enter text, open schedule picker, choose time in the near future, confirm.
   - Job appears in the list as scheduled, then changes to sent after the dispatcher sends it.
4) Cancel
   - For a scheduled job in the future, click Cancel.
   - Status becomes cancelled; dispatcher will not send it.

Troubleshooting
- 401 from n8n endpoints → verify `X-N8N-SECRET`.
- 403 from provider endpoints → verify Firebase ID token and role.
- No messages sent → ensure the bot is admin in the chat; check dispatcher logs.
- Index errors → create Firestore composite indexes as prompted for `status/claimed/sendAt` and `providerId/sendAt` combinations.
