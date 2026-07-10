# Send

https://send.asriyan.me

## Supabase key configuration

Community server refresh uses Supabase and expects `VITE_SUPABASE_ANON_KEY` at build time.

For local development:
1. Copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_ANON_KEY` in `.env`.

For GitHub Pages builds:
1. Open repository Settings -> Secrets and variables -> Actions -> Variables.
2. Create repository variable `VITE_SUPABASE_ANON_KEY`.

`anon` keys are public by design and end up in the browser bundle, so `Variable` is the right default. Use `Secret` only if you need masking in logs.
