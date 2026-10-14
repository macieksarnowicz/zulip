# OceanPosse Zulip fork: agent guide

Guidance for AI agents and humans working in this repository. The root `AGENTS.md` only
points here, so that it stays a one-line change when upstream ships its own `AGENTS.md`.

Related files:

- `oceanposse/TASKS.md`: open and completed tasks. Keep it up to date: add new tasks
  there, and move finished ones to "Done".
- `oceanposse/*.sh`: server management scripts (see "Rules for future changes").

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

- One fork branch per Zulip major version: `7.x`, `8.x`, `9.x`, `10.x`, `11.x`, `12.x`.
  Each one is an **upstream release plus our commits on top**.
- **`12.x` is the current branch.** It is based on the upstream **`12.3` tag**
  (`b31982251f`) plus:
  - `370aa666df` "Workaround for Google Consent Mode" (the code patch)
  - one commit carrying `oceanposse/` and the root `AGENTS.md` forward from `11.x`
- **Production runs the fork's `12.x` branch** (`12.3-5-g95599b077f`), deployed
  2026-10-14. Before that it briefly ran plain upstream 12.3 (deployed 2026-10-03,
  without our patch).
- `11.x` is frozen. It is based on upstream `11.0-81` (`1b30049059`) plus
  `08afa6aeed` (the patch) and the first `oceanposse/` docs and tooling commits.
- `main` holds the original 2023 development history of the patch (several
  "fix lint/tests" commits that were later squashed into the single commit carried on
  each version branch). It is not used for deployment.

### Moving to a new major version

Each fork version branch is upstream plus three kinds of commits, in this order:

1. **Code patches.** One commit per customization, listed under "Our customization".
   These are **cherry-picked** from the previous version branch, because they modify
   upstream files and may need conflict resolution.
2. **Fork tooling and docs.** Everything in `oceanposse/` plus the root `AGENTS.md`
   pointer. These are **copied as a tree** from the previous branch into a single commit,
   not cherry-picked one by one. Upstream never touches `oceanposse/`, so the copy never
   conflicts, and the history of the tooling stays on the older branches.
3. **Ongoing work.** Normal commits made on the new branch while it is the production
   branch.

Only the current production branch gets new work. Older version branches are frozen.

Procedure (example for the next move, 12.x → 13.x, run on the dev machine):

```bash
git fetch upstream --tags
git switch -c 13.x 13.N                            # base on a release tag, e.g., the one to deploy

# 1. Code patches: cherry-pick each customization commit from the previous branch.
git cherry-pick 370aa666df                         # Google Consent Mode workaround
#    Resolve conflicts, then: ./tools/test-backend zerver.tests.test_link_embed

# 2. Fork tooling and docs: copy the tree from the previous branch.
git checkout 12.x -- oceanposse/ AGENTS.md
#    If upstream has its own root AGENTS.md by now, don't overwrite it. Run
#    `git checkout HEAD -- AGENTS.md` and append the pointer section instead
#    (see "Root AGENTS.md" below).
git commit -m "oceanposse: Carry forward fork tooling and docs from 12.x."

# 3. Update the docs for the new version: commit hashes in "Our customization",
#    "Branching model", and TASKS.md. Then commit and push:
git push -u origin 13.x
```

Deploy on the server (DO web console, as root, during the maintenance window). Check that
a recent DigitalOcean backup exists first. **Always run the upgrade inside `tmux`**: the
web console can disconnect mid-upgrade, which kills the upgrade and leaves Zulip stopped.
This happened during the 12.x deploy.

```bash
tmux new -s upgrade          # after a disconnect, reattach with: tmux attach -t upgrade
/home/zulip/deployments/current/scripts/upgrade-zulip-from-git 13.x
```

If an upgrade is interrupted or fails:

- **Re-run the same command.** The upgrade scripts are idempotent
  (`docs/production/upgrade.md`, "Troubleshooting and rollback"). Do not start the old
  deployment by hand, because the database may already be partly migrated.
- If it says **"Another deployment in progress; waiting for lock"**, the killed run left
  its lock behind. Press Ctrl+C. Check that nothing is still running with
  `pgrep -af 'upgrade-zulip|puppet|apt-get|dpkg|webpack'`. Only if that prints nothing,
  run `rmdir /home/zulip/deployments/lock` and re-run the upgrade.
- Check for out-of-memory kills (`dmesg -T | grep -iE "out of memory|killed process"`).
  On this 4 GB droplet the asset build (webpack) is the most memory-hungry step.
- Details are in `/var/log/zulip/upgrade.log`.

After the fork branch is deployed, the scripts are on the server in
`/home/zulip/deployments/current/oceanposse/`, so they no longer need to be pasted.

**Root `AGENTS.md`.** Upstream `main` (the future 13.x) already has its own root
`AGENTS.md`. Up to 12.x our root `AGENTS.md` is a short pointer file. From the first
version where upstream has one, keep upstream's file and append only this section at the
end, a single hunk that is easy to carry forward:

```markdown
## OceanPosse fork

This is the OceanPosse fork of Zulip. Read `oceanposse/AGENTS.md` before making changes.
```

Read the upstream upgrade notes before upgrading production:
`docs/production/upgrade.md` and `docs/overview/changelog.md`.

## Our customization (the only code change)

**Commit:** "Workaround for Google Consent Mode": `370aa666df` on `12.x`
(`08afa6aeed` on `11.x`).

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

(This needs the development environment; see "Running tests locally".)

## Running tests locally

The dev machine is Windows with WSL 2 (Ubuntu 26.04, systemd enabled). Zulip's
development environment runs directly inside WSL, without Vagrant or Docker.
Upstream guide: `docs/development/setup-recommended.md` (Windows / WSL tab).
Testing docs: `docs/testing/`.

### One-time setup

Upstream recommends a **dedicated WSL instance** for Zulip, because provisioning installs
system packages (PostgreSQL, RabbitMQ, Redis, memcached, Node, etc.) and may conflict with
other tools. Using the existing instance usually works.

```bash
# 0. Ubuntu 26.04 only: use classic sudo instead of sudo-rs (the 26.04 default).
#    With sudo-rs, provision's nested `sudo` calls leave apt-get stopped (state T)
#    at "Setting up <package> ...", and provisioning hangs forever.
#    The dev machine uses classic sudo permanently.
sudo update-alternatives --set sudo /usr/bin/sudo.ws
sudo --version | head -1     # expect "Sudo version 1.9.x", not "sudo-rs"

# 1. Services Zulip needs (systemd must be enabled in /etc/wsl.conf).
sudo apt update && sudo apt upgrade
sudo apt install rabbitmq-server memcached redis-server postgresql

# 2. Make RabbitMQ listen on localhost. Add these lines to
#    /etc/rabbitmq/rabbitmq-env.conf if they are missing:
#      NODE_IP_ADDRESS=127.0.0.1
#      NODE_PORT=5672

# 3. Provision. The checkout must be on the WSL disk (~/zulip), not under /mnt/c.
cd ~/zulip
./tools/provision            # takes a while; installs into .venv, node_modules, etc.
```

### Running tests

```bash
cd ~/zulip
source .venv/bin/activate

./tools/test-backend zerver.tests.test_link_embed   # our patch's tests
./tools/test-backend zerver.tests.test_link_embed.PreviewTestCase.test_http_error_get_data  # one test (the one our patch edits)
./tools/test-backend --rerun                        # rerun only the last failures
./tools/test-backend                                # full backend suite (slow)

./tools/lint zerver/lib/url_preview/preview.py      # lint/format the files you changed
./tools/run-mypy                                    # type checks
./tools/test-js-with-node                           # frontend unit tests, if web/ changed
```

To see the app running, use `./tools/run-dev` and open http://localhost:9991.

### After switching branches

The provisioned environment matches the checked-out version. After switching between
version branches (e.g., `11.x` ↔ `12.x`) or pulling upstream changes, run
`./tools/provision` again before testing. It is quick when little has changed.
`tools/test-backend` warns if provisioning is out of date.

### Before pushing a version branch

For every customization commit on the branch, run its listed tests, plus `./tools/lint`
on the touched files. Record the result in `TASKS.md`.

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
   - Keep each logical customization in **one self-contained commit** with a clear
     message, so it cherry-picks cleanly onto the next version branch.
   - Update or add tests so upstream's test suite still passes.
   - Follow Zulip's lint/format rules (`./tools/lint`, `./tools/run-mypy`).
3. **Document every customization in this file** (the "Our customization" section):
   commit, files, why, and how to test. That list is the checklist for each upgrade.
4. **Server management tooling** (deploy, upgrade, backup and diagnostic scripts) lives
   in the top-level `oceanposse/` directory, never in upstream directories, so it never
   conflicts with upstream. It is carried forward as a tree copy (see "Moving to a new
   major version").
   - `oceanposse/server-info.sh`: read-only host report. Run it as root on the server; it
     writes `/root/server-info.txt`.
   - `oceanposse/set-user-defaults.py`: makes "Combined feed" the home view (both the
     organization default and every existing user) and pins "Main Chat" for all
     subscribers. Dry run by default; `--apply` writes. Run it as `zulip`, not root. It
     can be re-run safely and only changes users that differ. Pins are per subscription,
     so re-run it after new users join to pin the channel for them too.
   - Scripts that use Django follow the `scripts/lib/check-database-compatibility` pattern
     (`setup_path()`, `django.setup()`), and call Zulip's `zerver.actions` functions
     rather than writing to models directly. That way clients get live events and the
     audit log records the change. Test them locally against the dev database first.
   - Upstream CI lints `oceanposse/` like the rest of the repo (shfmt, shellcheck,
     prettier, ruff, mypy, and a Markdown spelling check that wants US spelling and
     "e.g.,"). Before pushing, run
     `./tools/lint --skip=gitlint oceanposse/ AGENTS.md` (`--fix` handles formatting).
5. **Follow Zulip's commit message format** for every commit, both code patches and
   `oceanposse/` changes (see `.claude/CLAUDE.md` and
   https://zulip.readthedocs.io/en/latest/contributing/commit-discipline.html):

   ```text
   subsystem: Summary in 72 characters or less.

   The body explains why and how, wrapped at about 70 characters.
   ```

   - The summary starts with a lower-case subsystem or feature and a colon. Use
     `oceanposse:` for fork tooling and docs, and the upstream subsystem for code
     patches (e.g., `url_preview:`). Then a capitalized summary ending with a period.
   - One minimal, coherent idea per commit, with its tests included.
   - Check with `./tools/lint --only=gitlint` (it checks commits newer than upstream).
     CI skips gitlint, so this has to be done locally.
   - Commits that are already pushed are not rewritten to fix their titles. Production
     deploys from these branches. Known exceptions: `370aa666df` "Workaround for
     Google Consent Mode" (the original patch, carried as-is) and `668cfa1c5e`
     (73-character title).

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
  (e.g., `uwsgi_processes=2`) and the server is now stable. About 0.7 GB of swap is in use.
  Check memory impact before enabling extra workers or features.

**Access**

- Only through the DigitalOcean web console (launched from the droplet's page in the DO
  dashboard), logged in as root. There is no SSH from the dev machine.
- Management scripts run **directly on the server**. They must be self-contained
  shell/Python. Long pastes into the web console are unreliable: put the script in a file
  with `nano` (or fetch it from GitHub with `curl`) and run it with `bash`. Once a fork
  branch is deployed, the scripts are already in
  `/home/zulip/deployments/current/oceanposse/`.

**Zulip**

- Version `12.3-5-g95599b077f`: the fork's `12.x` branch, with our patch. Deployed
  2026-10-14 with `upgrade-zulip-from-git 12.x`.
- `/etc/zulip/zulip.conf`: `zulip::profile::standalone`, PostgreSQL 16,
  `[deployment] git_repo_url = https://github.com/macieksarnowicz/zulip.git`.
  The fork is already the git source, so `upgrade-zulip-from-git 12.x` deploys our fork
  branch.
- Upgrade command: `/home/zulip/deployments/current/scripts/upgrade-zulip-from-git <branch-or-tag>`
  (see `docs/production/upgrade.md`). The log is in `/var/log/zulip/upgrade.log`.
- One organization, "OCEAN POSSE" (root domain), with about 300 members
  (282 active users and 7 bots in the snapshot).
- Auth: email/password only (`EmailAuthBackend`). The LDAP/SAML/OIDC/JWT blocks in
  `settings.py` are unused template defaults.
- User defaults applied with `oceanposse/set-user-defaults.py` on 2026-10-14: the home view
  is "Combined feed" for everyone and is the organization default for new users, and
  "Main Chat" is pinned for all subscribers. New users do not get the pin automatically;
  re-run the script. A copy is at `/home/zulip/set-user-defaults.py` on the server.
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
  `chat.oceanposse.com` needs to be supported. Cleanup is deferred (see `TASKS.md`).

**DNS**

- DNS for `oceanposse.com` is hosted at IONOS (`ui-dns.*` nameservers), not at
  DigitalOcean. IONOS also hosts the domain's email.

**Backups**

- Done through **DigitalOcean droplet backups**. Nothing is configured on the server
  itself: no backup cron, no `[postgresql]` backup settings.

**Maintenance window**

- US night time. Traffic is low. Announce upgrades to users in advance.

## Useful upstream pointers

| Topic                      | Location                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Production install/upgrade | `docs/production/`                                              |
| Release notes / changelog  | `docs/overview/changelog.md`                                    |
| Dev environment setup      | `docs/development/`                                             |
| Backend tests              | `./tools/test-backend`                                          |
| Linting / type checks      | `./tools/lint`, `./tools/run-mypy`                              |
| Writing bots               | https://zulip.com/api/writing-bots                              |
| Integrations               | `zerver/webhooks/`, https://zulip.com/api/integrations-overview |
| Version info               | `version.py`                                                    |
