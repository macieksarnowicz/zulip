# OceanPosse tasks

Task list for the fork and the chat.oceanposse.com server. Background is in
`oceanposse/AGENTS.md`.

How to use this file:
- Each task has an ID (`T<n>`), never reused. Move it to "Done" when finished, with the
  date and the commit or outcome.
- Status is one of: `todo`, `in progress`, `blocked`, `deferred`.
- Keep entries short. Long-lived facts go in `AGENTS.md`, not here.

## Open

### T1: Move the fork to 12.x and redeploy with the patch (in progress)
Production runs upstream 12.3 without the Google Consent Mode patch. Follow
"Moving to a new major version" in `AGENTS.md`.
- [x] Base: the **`12.3` tag** (matches production; decided 2026-10-14).
- [x] Create `12.x` from `12.3` and cherry-pick the patch, giving `370aa666df`. It
      applied cleanly: `preview.py` is unchanged upstream between 11.0 and 12.3. A review
      of the new upstream tests found none affected by the extra log lines.
- [ ] Run `./tools/test-backend zerver.tests.test_link_embed`. This needs the Zulip dev
      environment, which is not set up on the dev machine yet. See "Running tests
      locally" in `AGENTS.md`.
- [x] Copy `oceanposse/` and `AGENTS.md` from `11.x`, and update hashes and versions in
      the docs.
- [x] Push `12.x` to `origin`.
- [ ] Announce the maintenance to users. During US night time, run
      `upgrade-zulip-from-git 12.x` on the server.
- [ ] Verify that a Google link preview works and that `oceanposse/` exists in the
      deployment.

### T2: Find what uses the disk (todo)
32 of 49 GB is used, but uploads plus the database are only about 3.2 GB. Write a
read-only script (e.g. `oceanposse/disk-usage.sh`) that reports the largest directories,
and check the space needed for upgrades.

### T3: Server management scripts (todo)
Build helpers in `oceanposse/`: a pre-upgrade checklist/health check, a post-upgrade
verification, and anything else repeated by hand.

### T4: Remove the old IP from `ALLOWED_HOSTS` (todo)
`146.190.178.82` is not this droplet. Remove it from `/etc/zulip/settings.py` and restart
Zulip.

### T5: Ubuntu 22.04 → 24.04 (todo)
Plan the OS upgrade before Zulip drops 22.04 support. See
`docs/production/upgrade.md` (upgrading the operating system).

### T6: TLS: serve only chat.oceanposse.com (deferred)
The Zulip cert symlinks point to the combined `chat.panamaposse.com` cert. Switch to the
`chat.oceanposse.com` cert and drop panamaposse. The user has deferred this.

## Done

- 2026-10-14: Wrote `AGENTS.md`. Added `oceanposse/server-info.sh` and recorded the
  production server snapshot.
