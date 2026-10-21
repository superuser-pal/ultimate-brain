# 0002 — Rate-limit the public endpoints

**Date:** 2026-11-20

The Acme API limits each client key to 100 requests a minute on public endpoints, after the load test on 18 November 2026 showed the order service failing at 400 requests a second. The limit is set in the gateway, not in the services.
