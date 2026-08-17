# Rhinestone MetaMask Debug

Small standalone Vite page to isolate the external MetaMask browser flow:

1. Connect MetaMask
2. Create Rhinestone account
3. Deploy via warp if needed
4. Register HCA ownership
5. Enable smart sessions

Run from the repo root:

```bash
pnpm --filter=manager run debug:rhinestone-browser
```

It reads `VITE_RHINESTONE_API_KEY` from `apps/manager/.env`.
