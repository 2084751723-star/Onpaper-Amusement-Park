# Template provenance

Project bootstrap source: the official Qoder Sites React starter bundled with Qoder Desktop 0.5.16. The repository's existing MIT `LICENSE` and Git history are preserved. The unused upstream README is not copied; the approved development plan and task PR provide project-specific commands. Vite, Zod and source-map-js were updated from the bundled lockfile to patched releases during bootstrap; upstream component and stylesheet attribution below is retained.

Adapted from the user-provided Codex Sites 0.1.66 `sites-building/templates/vinext-starter`.

The UI catalog, hooks, utilities, Tailwind stylesheet and vendored Shadcn CSS originate from that template. The vendored CSS license is preserved beside the file. Dependencies retain their own licenses.

Qoder adaptations replace Vinext/Next server rendering and Cloudflare configuration with a Vite static build; remove D1/Drizzle, R2 and ChatGPT authentication scaffolding; set Shadcn to client rendering; and make the toast component use its system theme without a Next theme provider. The Function example reuses Qoder Sites' credential-free handler. No upstream hosting, auth or resource configuration is copied into generated projects.

Qoder adds the Sites design contract and maps the starter theme, spacing, typography and transition scales to Nudge variables. Original light/dark colors are preserved as named project variables.
