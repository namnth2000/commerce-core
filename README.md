# commerce-core

A small, reusable commerce foundation for building custom online stores without rebuilding the same backend and workflow for every client.

The repository is intentionally simple. Product content and store configuration are file-based. Transactional data such as orders and payments will belong to the commerce API when that layer is implemented.

## Status

v0.1 is a working concept slice:

- contract drafts for store data, products, storefront behavior and commerce API
- a static Admin Portal prototype
- client-side image resize/compression in the Admin Portal
- a static storefront demo for office tech toys and desk decor
- an AI storefront skill that explains how a compatible frontend should be built

GitHub writes, Cloudflare Worker APIs, D1, real checkout and payment integrations are not implemented yet.

## Repository

```text
commerce-core/
├── admin/       Admin Portal prototype
├── contracts/   v0.1 contracts and examples
├── docs/        Product, architecture and design truth
└── frontend/    Demo storefront and storefront skill
```

## Run locally

No package install is required.

From the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/admin/
http://localhost:8000/frontend/
```

You can also use any simple static HTTP server.

## Development

Read these before changing behavior:

1. `docs/PRODUCT.md`
2. `docs/ARCHITECTURE.md` when changing data ownership or integrations
3. `contracts/` when changing data exchanged between parts
4. `docs/DESIGN.md` when changing UI direction
5. `AGENTS.md` for implementation rules

Keep v0.x changes small and prove one end-to-end flow before adding infrastructure.

## Deployment direction

The intended first production shape is:

- Storefront: Cloudflare Pages connected to GitHub
- Admin Portal: Cloudflare Pages
- Git operations: backend Worker using GitHub API, never a browser token
- Transaction API: Cloudflare Worker
- Orders/payments: D1
- Product images: Git first, R2 later if real usage makes Git storage painful

See `docs/ARCHITECTURE.md` for details.
