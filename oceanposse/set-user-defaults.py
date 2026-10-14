#!/usr/bin/env python3
"""Apply OceanPosse's standard user settings to everyone in the organization.

1. Home view: "Combined feed" (`web_home_view = "all_messages"`), both as the
   organization default for new users and for all existing users.
2. Pin the main channel (default "Main Chat") for every user subscribed to it.

Uses Zulip's own action functions, so open browser/mobile sessions update
live and every change is recorded in the audit log.

Dry run by default. Run as the zulip user (not root):

    su zulip -c '/home/zulip/deployments/current/oceanposse/set-user-defaults.py'
    su zulip -c '/home/zulip/deployments/current/oceanposse/set-user-defaults.py --apply'

If the script is not inside a Zulip deployment (e.g. downloaded to
/home/zulip), it uses the code in /home/zulip/deployments/current.
"""

import argparse
import os
import sys

DEFAULT_ZULIP_PATH = "/home/zulip/deployments/current"
ZULIP_PATH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ZULIP_PATH, "zproject")):
    ZULIP_PATH = DEFAULT_ZULIP_PATH
sys.path.insert(0, ZULIP_PATH)
os.chdir(ZULIP_PATH)

from scripts.lib.setup_path import setup_path
from scripts.lib.zulip_tools import assert_not_running_as_root

assert_not_running_as_root()
setup_path()
os.environ["DJANGO_SETTINGS_MODULE"] = "zproject.settings"

import django

django.setup()

from zerver.actions.realm_settings import do_set_realm_user_default_setting
from zerver.actions.streams import do_change_subscription_property
from zerver.actions.user_settings import bulk_change_user_setting
from zerver.models import RealmUserDefault, Subscription, UserProfile
from zerver.models.realms import get_realm
from zerver.models.streams import get_stream

HOME_VIEW = "all_messages"  # "Combined feed" in the UI


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="make changes (default: dry run)")
    parser.add_argument(
        "--realm", default="", help="organization string_id (default: root organization)"
    )
    parser.add_argument("--channel", default="Main Chat", help="channel to pin for everyone")
    args = parser.parse_args()

    realm = get_realm(args.realm)
    stream = get_stream(args.channel, realm)
    mode = "APPLY" if args.apply else "DRY RUN (use --apply to make changes)"
    print(f"{mode}: organization '{realm.name}', channel '{stream.name}'\n")

    # 1a. Organization default for new users.
    realm_default = RealmUserDefault.objects.get(realm=realm)
    print(f"Default home view for new users: {realm_default.web_home_view!r} -> {HOME_VIEW!r}")
    if args.apply and realm_default.web_home_view != HOME_VIEW:
        do_set_realm_user_default_setting(
            realm_default, "web_home_view", HOME_VIEW, acting_user=None
        )

    # 1b. Existing users (including deactivated ones, in case they are reactivated).
    humans = UserProfile.objects.filter(realm=realm, is_bot=False)
    to_change = list(humans.exclude(web_home_view=HOME_VIEW))
    print(f"Users whose home view changes: {len(to_change)} of {humans.count()}")
    if args.apply and to_change:
        bulk_change_user_setting(realm, to_change, "web_home_view", HOME_VIEW, acting_user=None)

    # 2. Pin the channel for every active human subscriber.
    subs = Subscription.objects.filter(
        recipient_id=stream.recipient_id,
        active=True,
        user_profile__is_active=True,
        user_profile__is_bot=False,
    ).select_related("user_profile")
    to_pin = [sub for sub in subs if not sub.pin_to_top]
    print(f"Subscribers to pin '{stream.name}' for: {len(to_pin)} of {len(subs)}")
    if args.apply:
        for sub in to_pin:
            do_change_subscription_property(
                sub.user_profile, sub, stream, "pin_to_top", True, acting_user=None
            )

    subscriber_ids = {sub.user_profile_id for sub in subs}
    not_subscribed = humans.filter(is_active=True).exclude(id__in=subscriber_ids)
    if not_subscribed.exists():
        print(
            f"\nNote: {not_subscribed.count()} active users are not subscribed to "
            f"'{stream.name}', so it cannot be pinned for them:"
        )
        for user in not_subscribed.order_by("full_name")[:20]:
            print(f"  - {user.full_name} <{user.delivery_email}>")

    print("\nDone." if args.apply else "\nDry run only; nothing was changed.")


if __name__ == "__main__":
    main()
