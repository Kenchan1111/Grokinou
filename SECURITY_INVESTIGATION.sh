#!/bin/bash

# SECURITY INVESTIGATION SCRIPT
# Date: 14 décembre 2025
# Objectif: Identifier vecteurs d'accès système (écran + modification fichiers)

REPORT_DIR="$HOME/SECURITY_INVESTIGATION_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "INVESTIGATION FORENSIQUE SYSTÈME"
echo "Date: $(date)"
echo "Report: $REPORT_DIR"
echo "=========================================="
echo ""

# 1. CONNEXIONS RÉSEAU ACTIVES
echo "[1/15] Connexions réseau actives..."
{
    echo "=== CONNEXIONS ÉTABLIES ==="
    ss -tunapl | grep ESTAB
    echo ""
    echo "=== CONNEXIONS EN ÉCOUTE ==="
    ss -tunapl | grep LISTEN
    echo ""
    echo "=== NETSTAT COMPLET ==="
    netstat -antup 2>/dev/null || ss -antup
} > "$REPORT_DIR/01_network_connections.txt"

# 2. PROCESSUS SUSPECTS
echo "[2/15] Processus en cours d'exécution..."
{
    echo "=== TOUS PROCESSUS ==="
    ps auxf
    echo ""
    echo "=== PROCESSUS RÉSEAU ==="
    lsof -i -n -P 2>/dev/null || ss -p
    echo ""
    echo "=== PROCESSUS UTILISANT /dev/video* (webcam) ==="
    lsof /dev/video* 2>/dev/null || echo "Aucun"
    echo ""
    echo "=== PROCESSUS ACCÉDANT AUX DISPLAY (X11/Wayland) ==="
    ps aux | grep -E "Xorg|wayland|gnome-shell|kwin|mutter|compton|picom"
} > "$REPORT_DIR/02_processes.txt"

# 3. SERVICES SYSTEMD
echo "[3/15] Services systemd actifs..."
{
    echo "=== SERVICES ACTIFS ==="
    systemctl list-units --type=service --state=running
    echo ""
    echo "=== SERVICES SUSPECTS (remote, monitoring, etc) ==="
    systemctl list-units --type=service | grep -E "ssh|vnc|rdp|team|viewer|remote|anydesk|chrome-remote|monitor|telemetry"
} > "$REPORT_DIR/03_systemd_services.txt"

# 4. CRONJOBS ET TÂCHES PLANIFIÉES
echo "[4/15] Tâches planifiées..."
{
    echo "=== CRONTAB UTILISATEUR ==="
    crontab -l 2>/dev/null || echo "Aucun crontab"
    echo ""
    echo "=== CRONTABS SYSTÈME ==="
    cat /etc/crontab 2>/dev/null
    ls -la /etc/cron.* 2>/dev/null
    echo ""
    echo "=== SYSTEMD TIMERS ==="
    systemctl list-timers --all
} > "$REPORT_DIR/04_scheduled_tasks.txt"

# 5. MODULES KERNEL
echo "[5/15] Modules kernel chargés..."
{
    echo "=== TOUS MODULES ==="
    lsmod
    echo ""
    echo "=== MODULES SUSPECTS (keylogger, rootkit patterns) ==="
    lsmod | grep -E "key|log|hook|hide|root|back"
} > "$REPORT_DIR/05_kernel_modules.txt"

# 6. FICHIERS MODIFIÉS RÉCEMMENT
echo "[6/15] Fichiers modifiés récemment (zones critiques)..."
{
    echo "=== /etc modifié dernières 48h ==="
    find /etc -type f -mtime -2 2>/dev/null | head -50
    echo ""
    echo "=== /usr/bin /usr/sbin modifié dernières 7 jours ==="
    find /usr/bin /usr/sbin -type f -mtime -7 2>/dev/null | head -50
    echo ""
    echo "=== $HOME modifié dernières 24h (hors cache) ==="
    find "$HOME" -type f -mtime -1 2>/dev/null | grep -v "/.cache/" | head -100
    echo ""
    echo "=== .bashrc .profile .bash_history ==="
    ls -la "$HOME"/.bash* "$HOME"/.profile "$HOME"/.zshrc 2>/dev/null
} > "$REPORT_DIR/06_modified_files.txt"

# 7. SESSIONS SSH ET ACCÈS DISTANT
echo "[7/15] Sessions SSH et accès distant..."
{
    echo "=== SESSIONS SSH ACTIVES ==="
    w
    echo ""
    echo "=== WHO ==="
    who -a
    echo ""
    echo "=== LAST LOGINS ==="
    last -20
    echo ""
    echo "=== SSH AUTHORIZED_KEYS ==="
    cat "$HOME/.ssh/authorized_keys" 2>/dev/null || echo "Aucun"
    echo ""
    echo "=== SSH CONFIG ==="
    cat "$HOME/.ssh/config" 2>/dev/null || echo "Aucun"
    echo ""
    echo "=== SSH AGENT ==="
    ssh-add -l 2>/dev/null || echo "Pas d'agent SSH"
} > "$REPORT_DIR/07_ssh_sessions.txt"

# 8. LOGS D'AUTHENTIFICATION
echo "[8/15] Logs d'authentification..."
{
    echo "=== AUTH.LOG (dernières 100 lignes) ==="
    sudo tail -100 /var/log/auth.log 2>/dev/null || echo "Accès refusé"
    echo ""
    echo "=== FAILED LOGIN ATTEMPTS ==="
    sudo grep -i "failed" /var/log/auth.log 2>/dev/null | tail -50 || echo "Accès refusé"
    echo ""
    echo "=== SUDO USAGE ==="
    sudo grep -i "sudo" /var/log/auth.log 2>/dev/null | tail -50 || echo "Accès refusé"
} > "$REPORT_DIR/08_auth_logs.txt"

# 9. PERMISSIONS SUDO ET SUDOERS
echo "[9/15] Permissions sudo..."
{
    echo "=== SUDOERS PRINCIPAL ==="
    sudo cat /etc/sudoers 2>/dev/null || echo "Accès refusé"
    echo ""
    echo "=== SUDOERS.D ==="
    sudo ls -la /etc/sudoers.d/ 2>/dev/null || echo "Accès refusé"
    sudo cat /etc/sudoers.d/* 2>/dev/null || echo "Accès refusé"
    echo ""
    echo "=== GROUPES UTILISATEUR ==="
    groups
    echo ""
    echo "=== MEMBRES GROUPE SUDO ==="
    getent group sudo
} > "$REPORT_DIR/09_sudo_permissions.txt"

# 10. HISTORIQUE BASH SUSPECT
echo "[10/15] Historique bash (commandes suspectes)..."
{
    echo "=== HISTORIQUE COMPLET ==="
    cat "$HOME/.bash_history" 2>/dev/null | tail -200
    echo ""
    echo "=== COMMANDES SUSPECTES ==="
    cat "$HOME/.bash_history" 2>/dev/null | grep -E "nc|netcat|curl.*sh|wget.*sh|chmod.*777|/tmp/|base64|python.*-c|perl.*-e"
} > "$REPORT_DIR/10_bash_history.txt"

# 11. PORTS EN ÉCOUTE
echo "[11/15] Ports en écoute (backdoors potentiels)..."
{
    echo "=== TOUS PORTS ÉCOUTE ==="
    sudo netstat -tlnp 2>/dev/null || sudo ss -tlnp
    echo ""
    echo "=== PORTS NON-STANDARD (hors 22,80,443,etc) ==="
    sudo netstat -tlnp 2>/dev/null | grep -vE ":22 |:80 |:443 |:53 |:25 " || sudo ss -tlnp | grep -vE ":22 |:80 |:443 |:53 |:25 "
} > "$REPORT_DIR/11_listening_ports.txt"

# 12. UTILISATEURS SYSTÈME
echo "[12/15] Utilisateurs système et accès..."
{
    echo "=== /etc/passwd ==="
    cat /etc/passwd
    echo ""
    echo "=== UTILISATEURS AVEC SHELL ==="
    cat /etc/passwd | grep -v "/nologin" | grep -v "/false"
    echo ""
    echo "=== DERNIÈRES CONNEXIONS PAR UTILISATEUR ==="
    lastlog
} > "$REPORT_DIR/12_users.txt"

# 13. DISPLAY ET X11/WAYLAND
echo "[13/15] Serveur d'affichage et captures d'écran..."
{
    echo "=== DISPLAY VARIABLES ==="
    env | grep -i display
    echo ""
    echo "=== WAYLAND ==="
    env | grep -i wayland
    echo ""
    echo "=== XAUTHORITY ==="
    ls -la "$HOME/.Xauthority" 2>/dev/null || echo "Aucun"
    echo ""
    echo "=== PROCESSUS X11 ==="
    ps aux | grep -i x11
    echo ""
    echo "=== CLIENTS X11 CONNECTÉS ==="
    xwininfo -root -tree 2>/dev/null || echo "X11 non accessible"
} > "$REPORT_DIR/13_display_server.txt"

# 14. LOGICIELS DE MONITORING/EDR
echo "[14/15] Logiciels de monitoring/EDR installés..."
{
    echo "=== PACKAGES SUSPECTS ==="
    dpkg -l 2>/dev/null | grep -iE "team|viewer|anydesk|remote|monitor|telemetry|chrome-remote|vnc|rdp|spy|watch|track" || echo "dpkg non disponible"
    echo ""
    echo "=== PROCESSUS MONITORING ==="
    ps aux | grep -iE "team|viewer|anydesk|remote|monitor|vnc|rdp"
} > "$REPORT_DIR/14_monitoring_software.txt"

# 15. FICHIERS SUID/SGID SUSPECTS
echo "[15/15] Fichiers SUID/SGID (backdoors potentiels)..."
{
    echo "=== SUID ROOT ==="
    find / -perm -4000 -type f 2>/dev/null | head -50
    echo ""
    echo "=== SGID ROOT ==="
    find / -perm -2000 -type f 2>/dev/null | head -50
    echo ""
    echo "=== FICHIERS WORLD-WRITABLE ==="
    find /etc /usr/bin /usr/sbin -perm -002 -type f 2>/dev/null | head -50
} > "$REPORT_DIR/15_suid_sgid_files.txt"

# RÉSUMÉ
echo ""
echo "=========================================="
echo "INVESTIGATION TERMINÉE"
echo "=========================================="
echo ""
echo "Tous les rapports sont dans: $REPORT_DIR"
echo ""
echo "PROCHAINES ÉTAPES:"
echo "1. Examiner chaque fichier .txt"
echo "2. Identifier processus/connexions suspectes"
echo "3. Vérifier services inconnus"
echo "4. Analyser logs auth pour accès non autorisés"
echo ""

# Créer un index
{
    echo "# SECURITY INVESTIGATION REPORT"
    echo "Date: $(date)"
    echo "Hostname: $(hostname)"
    echo "User: $(whoami)"
    echo ""
    echo "## Fichiers générés:"
    ls -lh "$REPORT_DIR"/*.txt
    echo ""
    echo "## Éléments critiques à vérifier:"
    echo "- Connexions ESTABLISHED vers IPs externes (01)"
    echo "- Processus avec accès réseau inconnus (02)"
    echo "- Services systemd suspects (03)"
    echo "- Cronjobs non autorisés (04)"
    echo "- Modules kernel inhabituels (05)"
    echo "- Fichiers modifiés dans /etc (06)"
    echo "- Sessions SSH multiples (07)"
    echo "- Failed logins répétés (08)"
    echo "- Entrées sudoers non standard (09)"
    echo "- Commandes bash suspectes (10)"
    echo "- Ports non-standard en écoute (11)"
    echo "- Utilisateurs inconnus avec shell (12)"
    echo "- Processus accédant au display (13)"
    echo "- Logiciels monitoring installés (14)"
    echo "- Binaires SUID suspects (15)"
} > "$REPORT_DIR/00_INDEX.md"

echo "Index créé: $REPORT_DIR/00_INDEX.md"
echo ""
echo "Pour analyser les résultats:"
echo "  cd $REPORT_DIR"
echo "  cat 00_INDEX.md"
echo "  less 01_network_connections.txt"
echo ""
