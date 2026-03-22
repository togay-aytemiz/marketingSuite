# Brand and URL Guardrails

Use these rules for all Marketing Suite blog generation, editing, and internal-link workflows.

## Official Website

- The official Qualy website is `https://www.askqualy.com`.
- Never invent, guess, or substitute another Qualy domain such as `qualy.ai`.
- If content needs an absolute homepage or product-site link, use `https://www.askqualy.com`.

## Blog Linking

- For internal blog links, prefer site-relative URLs:
  - TR: `/blog/<slug>`
  - EN: `/en/blog/<slug>`
- Do not rewrite internal blog links to invented absolute domains.
- Do not create homepage, pricing, or product links on any domain other than `https://www.askqualy.com`.

## Verification

- Before shipping prompt changes, check generated blog content for invented domains.
- If a generated draft includes a non-Qualy domain for Qualy-owned pages, treat it as a bug and fix the prompt/rules before publish.
