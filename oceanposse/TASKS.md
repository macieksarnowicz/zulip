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
Production ran upstream 12.3 without the Google Consent Mode patch. Follow
"Moving to a new major version" in `AGENTS.md`.
- [x] Base: the **`12.3` tag** (matches production; decided 2026-10-14).
- [x] Create `12.x` from `12.3` and cherry-pick the patch, giving `370aa666df`. It
      applied cleanly: `preview.py` is unchanged upstream between 11.0 and 12.3. A review
      of the new upstream tests found none affected by the extra log lines.
- [x] Tests (2026-10-14, WSL dev env, Ubuntu 26.04 / Python 3.14). In the full backend
      run (4557 tests), `test_link_embed` passes. Two unrelated failures:
      - `test_bots...test_patch_bot_owner_of_bot_with_can_create_users`: flaky upstream
        test (`UnboundLocalError` in `do_create_user`); it passes on rerun.
      - `test_events...RealmPropertyActionTest.test_change_realm_property`: fails the same
        way on plain upstream `12.3`, so it is upstream or environment related, not ours.
- [x] Copy `oceanposse/` and `AGENTS.md` from `11.x`, and update hashes and versions in
      the docs.
- [x] Push `12.x` to `origin`.
- [x] Run `upgrade-zulip-from-git 12.x` on the server.
      - 2026-10-14: the first attempt was killed when the web console disconnected,
        leaving services stopped and a stale lock. Removed the lock (nothing was
        running) and re-ran the upgrade, which completed. Deployed version
        `12.3-5-g95599b077f`, all services RUNNING, `oceanposse/` present.
- [x] Verify that `oceanposse/` exists in the deployment.
- [ ] Verify that a Google link preview works (post a Google Maps link in a channel).

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

### T7: Combined feed as home view, and pin "Main Chat" for everyone (in progress)
Script: `oceanposse/set-user-defaults.py`. Tested on the dev database (dry run, apply,
re-run shows no changes).
- [x] 2026-10-14: Downloaded to `/home/zulip/set-user-defaults.py`, ran a dry run, then
      ran it with `--apply` on production. The output was not recorded.
- [ ] Decide how to handle future users. New users get the Combined feed default
      automatically, but pinning has no organization default, so re-run periodically.

### T6: TLS: serve only chat.oceanposse.com (deferred)
The Zulip cert symlinks point to the combined `chat.panamaposse.com` cert. Switch to the
`chat.oceanposse.com` cert and drop panamaposse. The user has deferred this.

## Done

- 2026-10-14: Wrote `AGENTS.md`. Added `oceanposse/server-info.sh` and recorded the
  production server snapshot.
