#!/usr/bin/env bash
# Collect read-only diagnostic information about the chat.oceanposse.com Zulip host.
# Changes nothing on the server; prints no secret values.
#
# Usage (as root on the server):
#   bash server-info.sh            # prints and saves to /root/server-info.txt

OUT=/root/server-info.txt
DEPLOY=/home/zulip/deployments/current

section() { printf '\n=== %s ===\n' "$1"; }

manage() { su zulip -s /bin/bash -c "cd $DEPLOY && ./manage.py $*"; }

collect() {
    section "Collected"
    date -u
    hostname

    section "OS"
    grep -E '^(PRETTY_NAME|VERSION_ID)=' /etc/os-release
    uname -r
    uptime

    section "Disk / memory"
    df -h /
    free -h
    swapon --show

    section "Zulip version & deployments"
    if [ -f "$DEPLOY/zulip-git-version" ]; then
        cat "$DEPLOY/zulip-git-version"
    else
        grep -m1 ZULIP_VERSION "$DEPLOY/version.py"
    fi
    # Human-readable listing of the deploy symlinks is the point here.
    # shellcheck disable=SC2012
    ls -l /home/zulip/deployments/ | tail -n 8
    # /srv/zulip.git is owned by zulip; git refuses to read it as root.
    su zulip -s /bin/bash -c "git -C /srv/zulip.git remote -v" || echo "(cannot read /srv/zulip.git)"

    section "zulip.conf"
    cat /etc/zulip/zulip.conf

    section "settings.py (non-comment lines)"
    grep -vE '^\s*(#|$)' /etc/zulip/settings.py

    section "zulip-secrets.conf (key names only)"
    cut -d= -f1 /etc/zulip/zulip-secrets.conf

    section "SSL"
    ls -l /etc/ssl/certs/zulip.combined-chain.crt /etc/ssl/private/zulip.key
    openssl x509 -noout -issuer -enddate -in /etc/ssl/certs/zulip.combined-chain.crt
    ls /etc/letsencrypt/live 2>/dev/null || echo "(no /etc/letsencrypt/live)"

    section "Services"
    supervisorctl status | awk '{print $1, $2}'
    for svc in nginx postgresql rabbitmq-server redis-server memcached do-agent droplet-agent; do
        printf '%s: %s\n' "$svc" "$(systemctl is-active "$svc" 2>/dev/null)"
    done

    section "Cron"
    echo "--- root:"
    crontab -l
    echo "--- zulip:"
    crontab -u zulip -l
    echo "--- /etc/cron.d:"
    ls /etc/cron.d

    section "Auto-updates / firewall"
    cat /etc/apt/apt.conf.d/20auto-upgrades
    ufw status

    section "Data sizes"
    du -sh /home/zulip/uploads
    su postgres -c "psql -At -d zulip -c \"select pg_size_pretty(pg_database_size('zulip'))\""

    section "Realms & users"
    manage list_realms | head -n 20
    manage shell -c "'from zerver.models import UserProfile as U; print(\"active humans:\", U.objects.filter(is_active=True, is_bot=False).count(), \"bots:\", U.objects.filter(is_active=True, is_bot=True).count())'" | tail -n 1

    section "Last upgrade log"
    tail -n 15 /var/log/zulip/upgrade.log

    section "Network / DNS"
    getent hosts chat.oceanposse.com
    echo "public IP: $(curl -s --max-time 5 ifconfig.me)"
    if command -v dig >/dev/null; then dig +short NS oceanposse.com; else echo "(dig not installed)"; fi
}

if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root." >&2
    exit 1
fi

collect 2>&1 | tee "$OUT"
echo
echo "Saved to $OUT"
