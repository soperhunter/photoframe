#!/bin/bash
# Publishes photoframe.local as an mDNS A record pointing to this Pi's IP.
# Runs as a long-lived foreground process via systemd.
IP=$(hostname -I | awk '{print $1}')
exec /usr/bin/avahi-publish -a -R photoframe.local "$IP"
