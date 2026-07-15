# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main`  | Yes       |

## Reporting a vulnerability

If you discover a security issue, **please do not open a public GitHub issue**.

Email the maintainer privately with:

- A description of the issue
- Steps to reproduce
- Impact assessment (if known)

We aim to acknowledge reports within 72 hours.

## Deployment checklist (for self-hosters)

- Never commit `.env` or API keys to git
- Set strong, unique values for all API keys in production
- Restrict `ALLOWED_ORIGINS` to your frontend domain only
- Keep the API docs disabled in production (default on Railway)
- Rate limiting is enabled in production to protect OpenRouter and market-data quotas
- Mount a persistent volume for SQLite on Railway (`/data`)

## Research disclaimer

Vectra is a research dashboard. It does not execute trades and is not financial advice.
