# AGENTS.md

Guidance for AI agents and humans working in this repository.

## What this is

- A **fork of the open-source [Zulip](https://zulip.com) server** (team chat).
  - Upstream code: https://github.com/zulip/zulip (git remote `upstream`)
  - This fork: https://github.com/macieksarnowicz/zulip (git remote `origin`)
  - Upstream community/docs: https://zulip.org, public chat: https://chat.zulip.org,
    docs: https://zulip.readthedocs.io (also in `docs/` in this repo).
- It runs as a **self-hosted production server at https://chat.oceanposse.com**, on a
  DigitalOcean droplet.
- Apart from the one change described below, the code is stock upstream Zulip. All of
  Zulip's own developer documentation (`docs/`, `CONTRIBUTING.md`) applies.

## Branching model

- One fork branch per Zulip major version: `7.x`, `8.x`, `9.x`, `10.x`, `11.x`, and next
  `12.x`. Each one is an **upstream release branch plus our patch(es) on top**.
- **Current production state (2026-10): the server runs upstream Zulip 12.3 *without*
  our patch.** It was deployed from the upstream `12.3` tag on 2026-10-03. Re-applying
  the patch on a fork `12.x` branch and redeploying from it is pending.
- `11.x` is the latest fork branch. It is based on upstream `11.0-81`
  (`1b30049059`) plus one commit, `08afa6aeed` "Workaround for Google Consent Mode".
  - Note: upstream `11.x` has since moved on to 11.6. Our branch has not been rebased
    onto those maintenance releases.
- `main` holds the original 2023 development history of the patch (several
  "fix lint/tests" commits that were later squashed into the single commit carried on
  each version branch). It is not used for deployment.
- Upstream has released **12.x** (`upstream/12.x`, tags `12.0`–`12.3`). The next task
  is to create a `12.x` fork branch and carry our patch forward.

### Carrying the patch to a new major version

```bash
git fetch upstream --tags
git checkout -b 12.x upstream/12.x   # or a specific tag, e.g. 12.3
git cherry-pick 08afa6aeed           # the Consent Mode commit from 11.x
# resolve conflicts, then run the affected tests (see below)
git push origin 12.x
```

Read the upstream upgrade notes before upgrading production:
`docs/production/upgrade.md` and `docs/overview/changelog.md`.

## Our customisation (the only code change)

**Commit:** "Workaround for Google Consent Mode" (`08afa6aeed` on `11.x`).

**Problem:** Zulip generates link previews by fetching the URL from the server. Google
sites (and `goo.gl` short links) answered the server's requests with the EU Consent
Mode cookie popup page instead of real content, which produced useless previews.

**Fix**, in `zerver/lib/url_preview/preview.py`:

- Adds a `COOKIES` dict with pre-set `CONSENT` and `SOCS` cookies that tell Google
  consent has already been given.
- Adds `get_cookies(url)`: returns `COOKIES` if the URL contains `google` or `goo.gl`,
  otherwise `{}`. Logs `"Google Cookies used"` at INFO level.
- Passes `cookies=get_cookies(url)` to both `PreviewSession().get(...)` calls
  (in `valid_content_type()` and `get_link_embed_data()`).
- In `valid_content_type()`, the `requests.RequestException` handler now logs the
  exception (`logging.exception("An exception occurred for URL ...")`) instead of
  silently returning `False`.

**Test adjustment**, in `zerver/tests/test_link_embed.py`: one test that inspects
INFO logs now expects the new "An exception occurred for URL" line first, and the
original "Time spent on get_link_embed_data" line second.

**Maintenance notes:**

- The cookie values are hard-coded and can stop working if Google changes its consent
  mechanism. If Google previews start showing the consent page again, refresh these
  values from a browser session that has accepted consent.
- The URL check is a plain substring match, so it also matches non-Google URLs that
  contain "google".

Test it with:

```bash
./tools/test-backend zerver.tests.test_link_embed
```

(requires the Zulip development environment; see `docs/development/setup-recommended.md`.)

## Rules for future changes

We expect to add more functionality over time: bots, integrations/extensions, or code
changes. Every change has to be carried forward to each new Zulip major version, so:

1. **Prefer no core changes.** Use extension points first:
   - Bots via the Zulip API / `zulip` Python package, run outside the server.
   - Incoming/outgoing webhooks and the REST API.
   - Server settings in `/etc/zulip/settings.py` and `/etc/zulip/zulip.conf` on the
     host, not code edits.
2. **If core code must change, keep it surgical.**
   - Touch as few files and lines as possible. Add new functions or constants rather
     than rewriting upstream code.
   - Avoid reformatting or refactoring upstream code, because it makes conflicts in
     later cherry-picks.
   - Keep each logical customisation in **one self-contained commit** with a clear
     message, so it cherry-picks cleanly onto the next version branch.
   - Update or add tests so upstream's test suite still passes.
   - Follow Zulip's lint/format rules (`./tools/lint`, `./tools/run-mypy`).
3. **Document every customisation in this file** (the "Our customisation" section):
   commit, files, why, and how to test. That list is the checklist for each upgrade.
4. **Server management tooling** (deploy, upgrade, backup and diagnostic scripts) lives
   in the top-level `oceanposse/` directory, never in upstream directories, so it never
   conflicts with upstream. Carry `oceanposse/` and `AGENTS.md` forward to each new
   version branch together with the patches.
   - `oceanposse/server-info.sh`: read-only host report. Run it as root on the server; it
     writes `/root/server-info.txt`.

## Production server (chat.oceanposse.com)

Snapshot from `oceanposse/server-info.sh`, run 2026-10-14. Re-run the script to refresh it.

**Host**
- DigitalOcean droplet `chat`: Basic, 2 vCPU / 4 GB RAM (+2 GB swapfile) / 50 GB disk,
  region FRA1 (Frankfurt). Public IP `134.209.237.208`. Runs only Zulip.
- Ubuntu 22.04.5 LTS. Unattended upgrades are on. `do-agent` (DO monitoring) and
  `droplet-agent` are running.
- ufw allows 22, 80, 443 and 25 (IPv4 and IPv6).
- Disk is 67% used (32 of 49 GB). Uploads are 2.9 GB and the database 316 MB, so most of
  the space is used by something else (not yet investigated).
- Memory was a problem in the past. Worker count and memory settings were trimmed
  (e.g. `uwsgi_processes=2`) and the server is now stable. About 0.7 GB of swap is in use.
  Check memory impact before enabling extra workers or features.

**Access**
- Only through the DigitalOcean web console (launched from the droplet's page in the DO
  dashboard), logged in as root. There is no SSH from the dev machine.
- Management scripts run **directly on the server**. They must be self-contained
  shell/Python. Long pastes into the web console are unreliable: put the script in a file
  with `nano` (or fetch it from GitHub with `curl`) and run it with `bash`.

**Zulip**
- Version 12.3 (stock upstream, **without our patch**), deployed 2026-10-03.
  The previous deployment (`last`) is from 2025-09-07.
- `/etc/zulip/zulip.conf`: `zulip::profile::standalone`, PostgreSQL 16,
  `[deployment] git_repo_url = https://github.com/macieksarnowicz/zulip.git`.
  The fork is already the git source, so `upgrade-zulip-from-git 12.x` deploys our fork
  branch. 12.3 was deployed from the plain upstream tag.
- Upgrade command: `/home/zulip/deployments/current/scripts/upgrade-zulip-from-git <branch-or-tag>`
  (see `docs/production/upgrade.md`). The log is in `/var/log/zulip/upgrade.log`.
- One organisation, "OCEAN POSSE" (root domain), with about 300 members
  (282 active users and 7 bots in the snapshot).
- Auth: email/password only (`EmailAuthBackend`). The LDAP/SAML/OIDC/JWT blocks in
  `settings.py` are unused template defaults.
- Uploads are on local disk, in `/home/zulip/uploads`. Push notifications go through
  Zulip's service (`ZULIP_SERVICE_PUSH_NOTIFICATIONS = True`).
- Email: `EMAIL_HOST = 127.0.0.1:25`, no TLS, so mail goes through a local MTA on the
  droplet. Port 25 is open for inbound mail. The noreply address is
  `donotreply@oceanposse.com` and the admin is `chat@oceanposse.com`. The
  `oceanposse.com` mail service is hosted at IONOS. **Outgoing Zulip email works.**
- `ALLOWED_HOSTS` also lists `146.190.178.82`, which is not this droplet's IP
  (probably an old droplet).

**TLS**
- Let's Encrypt via certbot (`/etc/cron.d/certbot`). The current cert expires
  2026-12-22.
- The server was migrated from `chat.panamaposse.com` to `chat.oceanposse.com`, and both
  names were supported for a while. The Zulip cert symlinks still point to
  `/etc/letsencrypt/live/chat.panamaposse.com/` (a cert covering both names), and a
  separate `chat.oceanposse.com` cert directory also exists. Going forward only
  `chat.oceanposse.com` needs to be supported. Cleanup is deferred (see "Open follow-ups").

**DNS**
- DNS for `oceanposse.com` is hosted at IONOS (`ui-dns.*` nameservers), not at
  DigitalOcean. IONOS also hosts the domain's email.

**Backups**
- Done through **DigitalOcean droplet backups**. Nothing is configured on the server
  itself: no backup cron, no `[postgresql]` backup settings.

**Maintenance window**
- US night time. Traffic is low. Announce upgrades to users in advance.

## Open follow-ups

1. **Restore the patch in production:** create a fork `12.x` branch (upstream 12.x plus
   the Consent Mode patch plus `oceanposse/` and `AGENTS.md`), push it, and run
   `upgrade-zulip-from-git 12.x` during the maintenance window.
2. **Find out what uses the disk:** about 28 GB is used by something other than uploads
   and the database.
3. **TLS cleanup (deferred):** switch the Zulip cert to `chat.oceanposse.com` only and drop
   `chat.panamaposse.com`.
4. **`ALLOWED_HOSTS` cleanup:** remove `146.190.178.82` (not this droplet).
5. **OS:** plan an Ubuntu 22.04 → 24.04 upgrade before Zulip drops 22.04 support.
6. **Management scripts:** deploy/upgrade helpers, health checks, and a pre-upgrade
   checklist in `oceanposse/`.

## Useful upstream pointers

| Topic | Location |
|---|---|
| Production install/upgrade | `docs/production/` |
| Release notes / changelog | `docs/overview/changelog.md` |
| Dev environment setup | `docs/development/` |
| Backend tests | `./tools/test-backend` |
| Linting / type checks | `./tools/lint`, `./tools/run-mypy` |
| Writing bots | https://zulip.com/api/writing-bots |
| Integrations | `zerver/webhooks/`, https://zulip.com/api/integrations-overview |
| Version info | `version.py` |
