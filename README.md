# Periferia IT Group — Contract Reception Agent

AI Test Challenge 02 solution for Periferia IT Group.

This project implements a conversational contract-reception agent built with TypeScript and Node.js.

The system combines conversational AI with deterministic business controls for contract intake, validation, registration, document archival, alerts, and human approval.

---

## Live Demo

Hi Hernan,

I wanted to share a quick update regarding the live application.

The free API model had reached its usage limit, so I have now added balance to the API account and updated the configuration. The live agent is working again and can be tested normally.

You can access the application here:

https://periferia-contract-reception-agent-2.onrender.com

Please feel free to check the application at your convenience, and don’t hesitate to contact me if you experience any issues or need any additional information.

Thank you again for your time and consideration.

Best regards,  
Ram Chandhar Muddam

Health endpoint:

https://periferia-contract-reception-agent.onrender.com/api/health

> The Render free service may take a few seconds to wake up after inactivity.

---

## GitHub Repository

https://github.com/ramchandharmuddam/periferia-contract-reception-agent

---

## Main Features

- Conversational contract inbox assistant
- Email and document classification
- Structured contract extraction
- Confidence scores for extracted fields
- Deterministic validation
- Duplicate detection
- Contract amendment detection
- Simulated SharePoint registration
- Document archival
- Contract expiration alerts
- Policy-status alerts
- Human-in-the-loop approval
- Visible agent tool calls
- Deterministic verification without an LLM
- Registration-boundary security controls
- Safe Markdown rendering using DOMPurify

---

## Architecture

```text
User
  |
  v
Web Chat Frontend
  |
  v
Express Backend
  |
  v
Conversational Agent / LLM
  |
  v
Deterministic Contract Tools
  |
  +---- leer_buzon
  +---- extraer
  +---- validar
  +---- registrar
  +---- alertas
  |
  v
Simulated SharePoint Output
```

The LLM is used for conversational intent, orchestration, and explanation.

Business-critical decisions are handled by deterministic TypeScript tools.

---

## Tools

### `leer_buzon`

Lists pending inbox messages.

### `extraer`

Extracts structured contract information and confidence levels.

### `validar`

Validates contract information against the contract master.

Possible classifications:

```text
nuevo
actualizacion
duplicado
rechazado
```

### `registrar`

Creates or updates records in the simulated SharePoint contract master.

It also enforces human confirmation when uncertain fields require review.

### `alertas`

Generates deterministic expiration and policy alerts.

---

## Human-in-the-Loop Flow

A key test case is `msg-006`.

```text
extraer
   |
   v
validar
   |
   v
registrar confirmado=false
   |
   v
Human confirmation required
   |
   v
User reviews fecha_fin and valor
   |
   v
Confirm & Register
   |
   v
Contract registered
```

The LLM cannot independently approve uncertain contract information.

---

## Security Design

### Deterministic write boundary

Before modifying the contract master, `registrar` independently:

1. reloads the original message;
2. re-extracts the contract;
3. re-runs deterministic validation;
4. checks authoritative review fields;
5. requires human approval when necessary.

This prevents a caller or LLM from bypassing validation by modifying supplied validation data.

### Prompt injection protection

Emails and contract attachments are treated as untrusted input.

Document content cannot:

- override system instructions;
- bypass validation;
- bypass human confirmation;
- reveal API keys;
- expose environment variables;
- execute arbitrary commands.

### Frontend XSS protection

Assistant Markdown output is parsed with `marked` and sanitized using DOMPurify before being rendered.

### Secrets

Secrets are stored in environment variables.

The `.env` file is excluded from Git.

---

## Deterministic Demo

The project includes:

```text
demo.ts
```

This script directly calls the business tools without using a language model.

It demonstrates all six challenge cases:

```text
msg-001 -> new contract
msg-002 -> new contract
msg-003 -> contract update
msg-004 -> duplicate
msg-005 -> rejected quotation
msg-006 -> human confirmation required
```

Run:

```bash
npm run demo
```

---

## Project Structure

```text
reto-02/
|
+-- agent/
|   +-- prompt.md
|
+-- fixtures/
|   +-- reto-02/
|
+-- src/
|   |
|   +-- agent/
|   |   +-- agent.ts
|   |   +-- tools.ts
|   |
|   +-- tools/
|   |   +-- contratos.ts
|   |
|   +-- types/
|   |   +-- contrato.ts
|   |   +-- correo.ts
|   |
|   +-- server.ts
|
+-- web/
|   +-- index.html
|   +-- styles.css
|   +-- app.js
|
+-- demo.ts
+-- test-agent.ts
+-- PRD.md
+-- SOLUCION.md
+-- README.md
+-- package.json
+-- package-lock.json
+-- tsconfig.json
+-- .gitignore
```

---

## Requirements

- Node.js 20 or newer
- npm
- OpenRouter API key for conversational-agent functionality

---

## Local Setup

Install dependencies:

```bash
npm install
```

Create:

```text
.env
```

Add:

```text
OPENROUTER_API_KEY=<your-key>
OPENROUTER_MODEL=openrouter/free
```

Do not commit `.env`.

---

## Run the Application

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## TypeScript Validation

```bash
npm run typecheck
```

---

## Run Deterministic Verification

```bash
npm run demo
```

---

## Production Considerations

For a production deployment, the local filesystem simulation could be replaced with:

- Microsoft Graph / SharePoint APIs
- persistent database storage
- authentication and authorization
- centralized audit logging
- persistent session storage
- monitoring and observability
- a pinned production-grade tool-capable LLM

The deterministic tool interfaces can remain largely unchanged.

---

## Documentation

Detailed architecture, governance, cost analysis, design decisions, security considerations, and deployment notes are available in:

```text
SOLUCION.md
```

---

## Author

Ram Chandhar 
