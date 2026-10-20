# Deploy

The `Dockerfile` builds the client, drops dev dependencies, and runs the server as a non-root user on port 8080. Mount a volume at `/data` to keep accounts. The server saves and exits cleanly on SIGTERM.

```bash
docker build -t tinwar .
docker run -p 8080:8080 -v skirmish-data:/data tinwar
```

The server limits WebSocket connections, login attempts and new guest profiles per IP address. Behind a reverse proxy every player arrives from the proxy's address, so they all share one limit. Set `TRUST_PROXY=1` to key the limits on the last `X-Forwarded-For` address instead, which is the one your proxy appends. Enable it only when exactly one proxy you control sits in front of the server, because clients can put any value they like at the front of that header.

```bash
docker run -p 8080:8080 -e TRUST_PROXY=1 -v skirmish-data:/data tinwar
```

## Fly.io

`fly.toml` runs the Docker image (its volume, `skirmish_data`, keeps the name it was created under) on one always-on machine with a volume at `/data`, `TRUST_PROXY=1` (Fly's edge is the one proxy in front), and a `/healthz` check. Keep it to one machine: rooms live in memory and the accounts file is not shared between machines.

```bash
fly launch --no-deploy --copy-config --name <your-app-name>
```

```bash
fly volumes create skirmish_data --size 1 --region iad
```

```bash
fly deploy
```

Password-reset email needs a mail provider and the site's public address, set as Fly secrets (they reach the server as environment variables; without them reset requests still answer the same but send nothing, and the log says email is not configured):

```bash
fly secrets set RESEND_API_KEY=re_... MAIL_FROM="Tinwar <no-reply@tinwar.io>" PUBLIC_URL=https://tinwar.io
```

`MAIL_FROM` must be on a domain verified in Resend. To use SMTP instead, set `SMTP_URL` (for example `smtps://user:pass@smtp.example.com:465`) and `MAIL_FROM` in place of `RESEND_API_KEY`. `PUBLIC_URL` is where reset links point; it is never taken from a request's Host header. Never set `DEV_MAIL_LOG` in production (the server ignores it under `NODE_ENV=production`).

Change `primary_region` and the volume region to the one nearest your players. A deploy restarts the machine and disconnects everyone, so deploy at quiet times.

## Bot chat (optional LLM)

Bots chat from a phrase bank (`src/server/bot/social.ts`). With an API key set, the chatty ones (about one bot in five) now and then have a line written by a small, fast model instead (`src/server/bot/llmchat.ts`). It covers kills, deaths, repeat deaths, round ends, being addressed, questions, idle banter, and short exchanges between bots (three bot lines in a row at most). **Without a key it is off** and bots use the bank only. Tests, benches and replays never use it.

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Uses the Anthropic API through the official SDK, model `claude-haiku-5-5` (no thinking, low effort, 30 tokens). Takes precedence when both keys are set. |
| `OPENROUTER_API_KEY` | unset | Uses OpenRouter's `/api/v1/chat/completions` endpoint instead. |
| `OPENROUTER_MODEL` | `anthropic/claude-haiku-5.5` | Check that this exact id exists in OpenRouter's model list before relying on it. |
| `LLM_CHAT_MAX_PER_MIN` | `6` | Calls per minute for the whole server. `0` turns the feature off. |
| `LLM_CHAT_MAX_PER_DAY` | `2000` | Calls per day for the server process. The count lives in memory, so a restart or deploy resets it. `0` turns the feature off. |

The bot always draws its bank line first and the writer decides afterwards. Once a model line is sent, though, that room no longer plays out as a seeded bank-only room would. The model is asked for about 30% of a chatty bot's lines, with at most one call in flight per room. Each call has 2.5 s to answer. On a timeout, an error, a 429 or a refusal the bot says its bank line instead, and the writer backs off: 15 s doubling to 5 minutes, and at least a minute after a 429. An answer of `SKIP` means the bot stays silent.

Every answer is checked twice. First it is folded to plain ASCII (NFKC and look-alike letters; anything else non-ASCII is refused), and must then be one line with no quotes, 1-5 words, nothing about bots, AI, prompts or instructions, and no claim about the speaker (age, gender, place, family, accounts). It must not copy more than three words of anyone's chat, and must not contain what someone asked to have said ("say ..."). While anything the model was shown calls someone a bot, an AI, real or human, or accuses them of hacking, a bot may only brush it off ("?", "bro what", "lmao", "huh"); anything else is silence. While it shows a personal question (age, where from, boy or girl, meeting up, socials), the only answers are "idk" or a brush-off. After that the line goes through the same safety filter as every bot line. Recent chat is passed to the model as untrusted data in a fenced block. With `SKIRMISH_NETSTATS=1` the server's netstats line includes the call counters, and the writer logs one summary line per minute at most. Keys are never logged. If `@anthropic-ai/sdk` cannot be loaded, the server logs `LLM chat off: @anthropic-ai/sdk missing` once and uses the bank only.

On Fly, set one key as a secret, plus any of the optional settings:

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
# or: fly secrets set OPENROUTER_API_KEY=sk-or-... OPENROUTER_MODEL=anthropic/claude-haiku-5.5
fly secrets set LLM_CHAT_MAX_PER_MIN=6 LLM_CHAT_MAX_PER_DAY=2000
```
