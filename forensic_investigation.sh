#!/bin/bash
# Script d'investigation forensique - Attaque False Flag
# Date: 2025-12-11
# Cible: Identifier l'attaquant (IP, MAC, traces réseau)

OUTPUT_DIR="/home/zack/FORENSIC_EVIDENCE_$(date +%s)"
mkdir -p "$OUTPUT_DIR"

echo "========================================"
echo "INVESTIGATION FORENSIQUE - FALSE FLAG"
echo "========================================"
echo "Output: $OUTPUT_DIR"
echo ""

# 1. CONFIGURATION NTOPNG
echo "[1/15] Configuration ntopng..."
cat /etc/ntopng/ntopng.conf > "$OUTPUT_DIR/ntopng_config.txt" 2>&1
dpkg -l | grep ntopng > "$OUTPUT_DIR/ntopng_package_info.txt"
systemctl status ntopng --no-pager > "$OUTPUT_DIR/ntopng_status.txt"

# 2. HISTORIQUE CONNEXIONS RÉSEAU (17h30-18h00 le 10 déc)
echo "[2/15] Logs réseau 10 décembre 17h30-18h00..."
journalctl --since "2025-12-10 17:30:00" --until "2025-12-10 18:00:00" > "$OUTPUT_DIR/network_logs_17h30-18h00.txt"

# 3. CONNEXIONS WIFI HISTORIQUE
echo "[3/15] Historique connexions WiFi..."
journalctl -u NetworkManager --since "2025-12-10 00:00:00" | grep -E "(WiFi|wlo1|connected|disconnected|address|DHCP)" > "$OUTPUT_DIR/wifi_history.txt"

# 4. IPs DHCP OBTENUES
echo "[4/15] Adresses DHCP..."
journalctl | grep -E "DHCP.*lease|DHCPv4.*address" | tail -100 > "$OUTPUT_DIR/dhcp_leases.txt"

# 5. TABLE ARP (VOISINS RÉSEAU)
echo "[5/15] Table ARP (voisins réseau)..."
ip neigh show > "$OUTPUT_DIR/arp_table.txt"
cat /proc/net/arp >> "$OUTPUT_DIR/arp_table.txt"

# 6. CONNEXIONS RÉSEAU ACTIVES
echo "[6/15] Connexions réseau actives..."
ss -tunap > "$OUTPUT_DIR/network_connections.txt"
netstat -tunap >> "$OUTPUT_DIR/network_connections.txt" 2>&1

# 7. STATISTIQUES INTERFACES
echo "[7/15] Statistiques interfaces réseau..."
ip -s link show > "$OUTPUT_DIR/interface_stats.txt"
ethtool wlo1 >> "$OUTPUT_DIR/interface_stats.txt" 2>&1

# 8. WAKE-ON-LAN CONFIGURATION
echo "[8/15] Configuration Wake-on-LAN..."
ethtool wlo1 | grep -A5 "Wake-on" > "$OUTPUT_DIR/wake_on_lan.txt"
ethtool enp3s0 | grep -A5 "Wake-on" >> "$OUTPUT_DIR/wake_on_lan.txt" 2>&1
cat /proc/acpi/wakeup >> "$OUTPUT_DIR/wake_on_lan.txt"

# 9. LOGS NTOPNG COMPLETS
echo "[9/15] Logs ntopng complets..."
journalctl -u ntopng --no-pager > "$OUTPUT_DIR/ntopng_logs_complete.txt"

# 10. LOGS VNSTAT
echo "[10/15] Logs vnstat..."
journalctl -u vnstat --no-pager > "$OUTPUT_DIR/vnstat_logs.txt"
vnstat -d > "$OUTPUT_DIR/vnstat_daily.txt" 2>&1
vnstat -h > "$OUTPUT_DIR/vnstat_hourly.txt" 2>&1

# 11. HISTORIQUE BOOTS COMPLET
echo "[11/15] Historique boots..."
last reboot > "$OUTPUT_DIR/boot_history.txt"
journalctl --list-boots >> "$OUTPUT_DIR/boot_history.txt"

# 12. ACPI/POWER EVENTS (WAKE EVENTS)
echo "[12/15] Événements ACPI (wake)..."
journalctl | grep -E "(ACPI|wake|suspend|resume|sleep)" | tail -200 > "$OUTPUT_DIR/acpi_events.txt"

# 13. SERVICES SYSTEMD ENABLED (AUTO-START)
echo "[13/15] Services systemd auto-start..."
systemctl list-unit-files --state=enabled > "$OUTPUT_DIR/systemd_enabled.txt"

# 14. AUTH LOGS (LOGINS)
echo "[14/15] Logs authentification..."
cat /var/log/auth.log > "$OUTPUT_DIR/auth_log.txt" 2>&1
journalctl -u systemd-logind --since "2025-12-10 00:00:00" > "$OUTPUT_DIR/login_events.txt"

# 15. INTEL ME STATUS
echo "[15/15] Intel Management Engine..."
dmesg | grep -i "mei\|management engine" > "$OUTPUT_DIR/intel_me.txt"

# 16. SCAN ROOTKIT (si disponible)
echo "[BONUS] Scan rootkit..."
if command -v rkhunter &> /dev/null; then
    rkhunter --check --sk --report-warnings-only > "$OUTPUT_DIR/rkhunter_scan.txt" 2>&1
fi

if command -v chkrootkit &> /dev/null; then
    chkrootkit > "$OUTPUT_DIR/chkrootkit_scan.txt" 2>&1
fi

# 17. RECHERCHE IPs DANS TOUS LES LOGS
echo "[CRITIQUE] Extraction toutes les IPs..."
journalctl --since "2025-12-09 00:00:00" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq > "$OUTPUT_DIR/all_ips_found.txt"

# PERMISSIONS
chmod 600 "$OUTPUT_DIR"/*
chown zack:zack "$OUTPUT_DIR" -R

echo ""
echo "========================================"
echo "✅ INVESTIGATION TERMINÉE"
echo "========================================"
echo "Preuves sauvegardées dans: $OUTPUT_DIR"
echo ""
echo "Fichiers créés:"
ls -lh "$OUTPUT_DIR"
echo ""
echo "Pour analyser: cd $OUTPUT_DIR && ls -la"
