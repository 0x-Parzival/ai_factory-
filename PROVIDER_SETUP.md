# Agent infrastructure setup

The factory code is ready for AgentMail, Composio, Orgo, Firecrawl, and E2B. No provider account is connected and no external action has been taken until the owner supplies credentials and completes the interactive account grants below.

## 1. AgentMail: give the company agent an inbox

1. Create an AgentMail organization and API key at <https://www.agentmail.to/>.
2. Create one inbox in the AgentMail console. Start with an `agentmail.to` address; attach a verified Spiritual AI domain later if desired.
3. Copy the returned inbox ID, not merely the visible email address.
4. Set these server secrets:

```dotenv
AGENTMAIL_API_KEY=am_...
AGENTMAIL_INBOX_ID=...
AGENTMAIL_DOMAIN=agentmail.to
```

The connector can also create an inbox through the `email.inbox.create` action, but that action is critical and requires owner approval. Mailbox reads exclude spam, blocked, unauthenticated, and trash messages. Every send requires the exact recipient and body in an approved outreach context.

Official documentation: <https://docs.agentmail.to/quickstart>

## 2. Composio: connect company platforms

1. Create a Composio project and project API key at <https://platform.composio.dev/>.
2. Set the server key and keep the toolkit list narrow:

```dotenv
COMPOSIO_API_KEY=...
COMPOSIO_ALLOWED_TOOLKITS=gmail,reddit,linkedin,instagram,facebook,whatsapp,youtube,slack,notion,github,hubspot,googlecalendar,googlesheets,googledrive,stripe
```

3. Restart the dashboard, sign in through Clerk, and open `/dashboard/connectors`.
4. Click **Connect** for each platform and personally complete its OAuth page. Accounts are created as private connections scoped to that signed-in owner.
5. In Composio, inspect the exact tool slug and its current dated toolkit version. Add only reviewed tools to the factory mapping. Example structure:

```dotenv
COMPOSIO_ACTION_TOOL_ALLOWLIST={"social.publish":["REDDIT_CREATE_REDDIT_POST"]}
COMPOSIO_TOOLKIT_VERSIONS={"reddit":"REPLACE_WITH_COMPOSIO_DATED_VERSION"}
```

Replace the version placeholder with the dated version reported by Composio, such as the `YYYYMMDD_00` format. The connector rejects unknown toolkits, unmapped tool slugs, unpinned versions, cross-user IDs, and non-interactive account connections. A mapped external write still needs the factory's normal human approval.

Official documentation: <https://docs.composio.dev/docs/manually-authenticating>

## 3. Orgo: persistent cloud computer

1. Create an Orgo workspace at <https://www.orgo.ai/workspaces>.
2. Generate an API key and copy the workspace UUID.
3. Set:

```dotenv
ORGO_API_KEY=sk_live_...
ORGO_WORKSPACE_ID=...
```

The factory can create a small Linux computer or control an existing computer. Creating, viewing screenshots, clicking, typing, pressing keys, executing Bash or Python, and starting or stopping a machine all require owner approval. Delete, clone, resize, streaming, and credential extraction are not exposed.

Official documentation: <https://docs.orgo.ai/quickstart>

## 4. Firecrawl: public web research

1. Create a Firecrawl API key at <https://firecrawl.dev/>.
2. Set:

```dotenv
FIRECRAWL_API_KEY=fc-...
```

The connector exposes web search and one-page extraction only. It caps search results and response size and rejects non-HTTPS URLs, embedded credentials, local networks, cloud metadata, bulk crawling, and interactive browser actions.

Official documentation: <https://docs.firecrawl.dev/api-reference/v2-introduction>

## 5. E2B: isolated jobs

1. Create an E2B API key at <https://e2b.dev/dashboard>.
2. Set:

```dotenv
E2B_API_KEY=e2b_...
E2B_TEMPLATE=
```

Leave `E2B_TEMPLATE` empty to use the default base sandbox. Each `code.execute` action requires approval, runs for at most five minutes, receives no company secrets from the connector, caps returned output, and kills the sandbox afterward.

Official documentation: <https://e2b.dev/docs>

## Activation check

Put these values in the dashboard's server-only environment, never in browser code or Git. Restart the dashboard and worker, then verify `/dashboard/connectors` reports the five providers as configured. Test in this order:

1. Firecrawl public-page read.
2. E2B harmless command such as `printf 'sandbox ready\n'`.
3. AgentMail inbox read, then one approved email to an address you own.
4. Orgo screenshot, then one approved click on a disposable test machine.
5. Composio read-only tool, then one approved post to a test or owned destination.

Do not put provider keys, account passwords, OTP codes, OAuth tokens, or mailbox app passwords in chat.
