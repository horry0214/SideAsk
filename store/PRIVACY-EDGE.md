# SideAsk Privacy Policy for Microsoft Edge

SideAsk for Microsoft Edge is a local-first browser extension with no SideAsk account, telemetry, advertising SDK, or SideAsk-operated cloud database.

Before SideAsk reads page content in Microsoft Edge, its first-run guide explains what it can access and where that content goes. The user must affirm the disclosure and separately grant optional HTTP/HTTPS website access. That permission can be revoked from the same guide.

SideAsk stores Provider settings and API keys, recent side questions, messages, source anchors, and user-selected favorites in extension-private local storage. It does not send this local database to the SideAsk maintainers.

After the user deliberately selects text and requests an explanation or sends a follow-up, SideAsk sends the selected text, a small amount of nearby readable context, recent messages in that branch, and a source URL stripped of credentials, query, and hash to the loopback-only SideAsk Gateway on the same computer. The Gateway forwards the request over HTTPS to the AI Provider selected by the user. That Provider processes the request under its own terms and privacy policy.

Password fields, form controls, editable regions, editor drafts, explicitly private or sensitive nodes, scripts, styles, full-page browsing history, unrelated conversation history, analytics, and advertising identifiers are excluded.

Users can delete Provider entries from the dashboard, revoke website access from the setup guide, and remove SideAsk from Microsoft Edge to clear its local storage. Data already sent to a chosen AI Provider is governed by that Provider's retention and deletion controls.

SideAsk uses information received through Microsoft Edge extension APIs only to provide or improve its disclosed user-facing side-question, return-to-source, and local learning-history features. It does not sell user data, use it for personalized advertising, or allow SideAsk maintainers to read it.

Project and support: https://github.com/horry0214/sideask
