#!/bin/bash

# SCRIPT DE SÉCURISATION FALCO
# Date: 14 décembre 2025
# Objectif: Restreindre Falco à localhost (port 8765)

set -e

echo "=========================================="
echo "SÉCURISATION FALCO - PORT 8765"
echo "=========================================="
echo ""

# Vérifier si on est root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  Ce script doit être exécuté avec sudo"
    echo "Usage: sudo bash secure_falco.sh"
    exit 1
fi

BACKUP_DIR="$HOME/FALCO_BACKUP_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[1/7] Backup de la configuration actuelle..."
cp /etc/falco/falco.yaml "$BACKUP_DIR/falco.yaml.backup"
echo "✅ Backup sauvegardé: $BACKUP_DIR/falco.yaml.backup"
echo ""

echo "[2/7] Vérification configuration gRPC actuelle..."
echo "--- Config gRPC actuelle ---"
grep -A20 "^grpc:" /etc/falco/falco.yaml | tee "$BACKUP_DIR/grpc_config_before.txt"
echo ""

echo "[3/7] Vérification connexions actives port 8765..."
echo "--- Connexions actives ---"
netstat -antp | grep 8765 | tee "$BACKUP_DIR/connections_before.txt" || echo "Aucune connexion active"
echo ""

echo "[4/7] Vérification logs Falco (dernières 24h)..."
echo "--- Logs connexions récentes ---"
journalctl -u falco-modern-bpf --since "24 hours ago" | grep -iE "grpc|client|connect" | tail -20 | tee "$BACKUP_DIR/falco_logs.txt" || echo "Aucun log de connexion"
echo ""

echo "[5/7] Modification de la configuration Falco..."
echo "Changement: bind_address: \"0.0.0.0\" → \"127.0.0.1\""

# Backup avant modification
cp /etc/falco/falco.yaml /etc/falco/falco.yaml.pre-secure

# Modifier bind_address si existe
if grep -q "bind_address:" /etc/falco/falco.yaml; then
    sed -i 's/bind_address: "0\.0\.0\.0"/bind_address: "127.0.0.1"/g' /etc/falco/falco.yaml
    sed -i "s/bind_address: '0\.0\.0\.0'/bind_address: '127.0.0.1'/g" /etc/falco/falco.yaml
    echo "✅ bind_address modifié"
else
    echo "⚠️  bind_address non trouvé dans la config"
fi

# Vérifier le changement
echo ""
echo "--- Nouvelle config gRPC ---"
grep -A20 "^grpc:" /etc/falco/falco.yaml | tee "$BACKUP_DIR/grpc_config_after.txt"
echo ""

echo "[6/7] Blocage du port 8765 au firewall (défense en profondeur)..."

# UFW
if command -v ufw &> /dev/null; then
    echo "Configuration UFW..."
    ufw deny 8765/tcp 2>/dev/null || echo "UFW: règle deny 8765 déjà existante ou erreur"
    ufw allow from 127.0.0.1 to any port 8765 proto tcp 2>/dev/null || echo "UFW: règle allow localhost déjà existante"
    echo "✅ UFW configuré"
fi

# iptables (backup + règles)
echo "Configuration iptables..."
iptables-save > "$BACKUP_DIR/iptables_backup.rules"
iptables -C INPUT -p tcp --dport 8765 ! -s 127.0.0.1 -j DROP 2>/dev/null || \
    iptables -A INPUT -p tcp --dport 8765 ! -s 127.0.0.1 -j DROP
echo "✅ iptables configuré"
echo ""

echo "[7/7] Redémarrage de Falco..."
systemctl restart falco-modern-bpf
sleep 3
systemctl status falco-modern-bpf --no-pager | head -20
echo ""

echo "=========================================="
echo "VÉRIFICATION POST-SÉCURISATION"
echo "=========================================="
echo ""

echo "Port 8765 actuel:"
netstat -tlnp | grep 8765 || ss -tlnp | grep 8765
echo ""

echo "✅ SÉCURISATION TERMINÉE"
echo ""
echo "Résumé:"
echo "- ✅ Config Falco modifiée (bind_address: 127.0.0.1)"
echo "- ✅ Firewall configuré (bloque accès externe)"
echo "- ✅ Falco redémarré"
echo "- ✅ Backup complet: $BACKUP_DIR"
echo ""
echo "⚠️  IMPORTANT: Vérifiez que Falco fonctionne correctement:"
echo "   sudo journalctl -u falco-modern-bpf -f"
echo ""
echo "Pour revenir en arrière:"
echo "   sudo cp $BACKUP_DIR/falco.yaml.backup /etc/falco/falco.yaml"
echo "   sudo systemctl restart falco-modern-bpf"
echo ""
