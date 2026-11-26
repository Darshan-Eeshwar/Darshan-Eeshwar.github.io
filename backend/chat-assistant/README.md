# Dimple Assistant

The homepage chat works immediately as a website guide using published service information. Its header shows “Website guide” until an AI endpoint is configured. Chats stay in page memory and can be cleared with New chat. WhatsApp opens a draft with the latest question for the visitor to send.

## Enable generated AI answers

This Cloudflare Worker keeps the OpenAI key on the server. GitHub Pages serves the chat interface.

1. From this directory, use Wrangler 4.36 or newer, sign in to the Cloudflare account hosting the Worker, and run `npx wrangler secret put OPENAI_API_KEY`. Enter the key at its hidden prompt.
2. Review `wrangler.jsonc`. Set the allowed website origins and model. The rate limiter allows approximately 30 requests per minute per Cloudflare location across this assistant. Its namespace must be unique within the account. This is a traffic control, and account usage limits should be configured with the API provider.
3. Run `npx wrangler deploy` and copy the returned HTTPS Worker URL.
4. In the homepage's `js/chat-assistant.js` script tag, set `data-endpoint` to that URL followed by `/chat`. Publish the homepage change.
5. Test a generated reply, reset during a pending reply, rate limiting and fallback when the service is unavailable.

When enabled, the last 12 conversation messages are sent to the Worker and OpenAI. The widget displays this before the first submission. No chat transcript is stored by the website. The Responses request uses `store: false`. Provider operational retention policies still apply. The Worker returns plain text and exposes no API keys or provider error details.

If the AI request fails, the widget labels its response as website information and provides WhatsApp handoff. Endpoint configuration and a real provider round trip must be verified before describing generated AI replies as live.
