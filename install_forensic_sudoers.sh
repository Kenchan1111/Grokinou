#!/bin/bash

# INSTALLATION CONFIG SUDOERS FORENSIQUE
# Date: 14 décembre 2025
# Objectif: Permettre à zack d'exécuter commandes forensiques sans sudo password

set -e

echo "=========================================="
echo "INSTALLATION SUDOERS FORENSIQUE"
echo "=========================================="
echo ""

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Ce script doit être exécuté avec sudo"
    echo "Usage: sudo bash install_forensic_sudoers.sh"
    exit 1
fi

SUDOERS_FILE="/etc/sudoers.d/claude-forensic"
SOURCE_FILE="sudoers_forensic_config.txt"

echo "[1/4] Vérification du fichier source..."
if [ ! -f "$SOURCE_FILE" ]; then
    echo "❌ Fichier $SOURCE_FILE non trouvé"
    exit 1
fi
echo "✅ Fichier source trouvé"
echo ""

echo "[2/4] Backup des sudoers actuels..."
cp /etc/sudoers /etc/sudoers.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup créé"
echo ""

echo "[3/4] Installation de la configuration forensique..."
# Copier avec permissions correctes (440)
install -m 440 "$SOURCE_FILE" "$SUDOERS_FILE"

# Vérifier syntaxe
if visudo -c -f "$SUDOERS_FILE"; then
    echo "✅ Configuration sudoers valide"
else
    echo "❌ Erreur de syntaxe dans la configuration"
    rm "$SUDOERS_FILE"
    exit 1
fi
echo ""

echo "[4/4] Test de la configuration..."
# Tester une commande simple
if sudo -u zack -n lsof -v >/dev/null 2>&1; then
    echo "✅ Test réussi: zack peut exécuter lsof sans password"
else
    echo "⚠️  Test partiel: certaines commandes peuvent nécessiter configuration additionnelle"
fi
echo ""

echo "=========================================="
echo "INSTALLATION TERMINÉE"
echo "=========================================="
echo ""
echo "Configuration installée dans: $SUDOERS_FILE"
echo ""
echo "⚠️  SÉCURITÉ:"
echo "- Cette config donne des permissions étendues à l'utilisateur zack"
echo "- Elle est destinée à l'investigation forensique temporaire"
echo "- SUPPRIMEZ-LA après investigation:"
echo "    sudo rm $SUDOERS_FILE"
echo ""
echo "🔍 COMMANDES FORENSIQUES DISPONIBLES SANS PASSWORD:"
echo "- journalctl, dmesg (logs système)"
echo "- netstat, ss, lsof (réseau)"
echo "- tcpdump (capture réseau)"
echo "- cat /var/log/*, /proc/*, /sys/* (lecture logs/info système)"
echo "- systemctl status/list (services)"
echo "- rkhunter, chkrootkit (scan rootkits)"
echo "- iptables -L (firewall)"
echo "- ausearch, aureport (audit)"
echo "- Et plus..."
echo ""
echo "📋 PROCHAINE ÉTAPE:"
echo "Vous pouvez maintenant relancer SECURITY_INVESTIGATION.sh"
echo "Toutes les commandes sudo fonctionneront automatiquement"
echo ""
echo "Exemple:"
echo "  ./SECURITY_INVESTIGATION.sh"
echo ""
