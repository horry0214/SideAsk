# Store Privacy Declarations

## Single purpose

SideAsk lets a user ask context-aware AI questions about text they deliberately select on a webpage, keep the answer attached to its source, and save the resulting learning branch locally for later understanding and review.

## Permission justifications

### `storage`

Stores the interface locale, consent record, migration metadata, recent side questions, favorites, and source anchors in extension-private local storage. Provider settings are stored separately in the loopback Gateway's encrypted on-device Vault so the browser and optional VS Code Companion can share them. Nothing is synced to a SideAsk cloud service.

### `scripting`

Injects the SideAsk selection button and floating panel into pages where the user has granted access. It is also used when the user explicitly clicks the toolbar action for the current tab.

### `activeTab`

Allows the toolbar action to open SideAsk on the current tab after a deliberate user click without requiring permanent access to that tab's site.

### Required host access: `127.0.0.1:8787` and `localhost:8787`

Allows the extension service worker to communicate with the SideAsk Local Gateway running on the user's own computer. The Gateway is the only path from the extension to a user-configured AI Provider.

### Optional host access: `http://*/*` and `https://*/*`

Allows the selection button and floating panel to appear automatically on ordinary websites. This access is not requested at installation. The first-run guide explains exactly what page content may be read and sent, then asks for the permission through a user gesture. The user can revoke it from the same guide. SideAsk does not request access to browser-internal pages or file URLs.

## Remote code

No. All executable extension code is included in the submitted ZIP. SideAsk does not download or evaluate JavaScript, WebAssembly, or other executable code. AI-generated answers are rendered as sanitized Markdown and are never executed. The separately downloaded local Gateway is an open-source companion service and does not inject executable code into the extension.

## Data categories to declare

Declare conservatively:

- Website content: selected text, minimal nearby readable context, sanitized source URL.
- User-generated content: the user's question and follow-up messages.
- Authentication information: Provider API keys are entered by the user and stored only in the local Gateway's encrypted on-device Vault. Saved keys are never returned to the extension and are used only by the Gateway for authentication with the user's chosen Provider.

SideAsk does not collect analytics, browsing history, location, financial data, health data, contacts, or advertising identifiers. It does not sell data or use it for advertising, credit, or unrelated profiling.

## Data flow and consent

Before website access is requested, the in-product disclosure states what is read, what is excluded, where the data is sent, and where local data is stored. A user must click “I understand — continue,” then separately click “Enable on websites.” Content is sent only after the user selects text and clicks Explain or submits a follow-up.

Data path: webpage selection → extension service worker → loopback Gateway on the same computer → user's chosen Provider over HTTPS.

## Chrome Limited Use certification

SideAsk uses information obtained from browser APIs only to provide or improve its disclosed user-facing single purpose. It does not sell user data, use it for personalized advertising, or permit humans to read it. The project privacy policy contains an affirmative Chrome Web Store Limited Use statement.
