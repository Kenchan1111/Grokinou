# GUIDE - SÉCURISER FALCO PORT 8765

**Date** : 14 décembre 2025
**Problème** : Falco écoute sur port 8765 accessible depuis Internet
**Solution** : Restreindre à localhost (127.0.0.1)

---

## 🚨 CE QUI SE PASSE

### Port 8765 = Falco gRPC API

```
falco   1251 root    5u  IPv4   9193      0t0  TCP *:8765 (LISTEN)
                                                      ↑
                                                  0.0.0.0 = INTERNET
```

**Conséquence** :
- Falco monitore TOUT votre système (syscalls, fichiers, réseau)
- Port 8765 = API gRPC pour recevoir ces events en temps réel
- Accessible depuis Internet = **N'importe qui peut se connecter et lire vos événements**

---

## ✅ SOLUTION AUTOMATIQUE (RECOMMANDÉE)

### Script tout-en-un

```bash
cd ~/GROK_CLI/grok-cli
sudo bash secure_falco.sh
```

**Ce que fait le script** :
1. ✅ Backup de votre config actuelle
2. ✅ Vérifie les connexions actives au port 8765
3. ✅ Vérifie les logs Falco (qui s'est connecté?)
4. ✅ Modifie `bind_address: "0.0.0.0"` → `"127.0.0.1"`
5. ✅ Bloque le port 8765 au firewall (défense en profondeur)
6. ✅ Redémarre Falco
7. ✅ Vérifie que tout fonctionne

**Durée** : ~30 secondes

---

## 🛠️ SOLUTION MANUELLE (Si préféré)

### Étape 1 : Backup config

```bash
sudo cp /etc/falco/falco.yaml /etc/falco/falco.yaml.backup
```

### Étape 2 : Vérifier config actuelle

```bash
sudo cat /etc/falco/falco.yaml | grep -A20 "^grpc:"
```

**Recherchez** :
```yaml
grpc:
  enabled: true
  bind_address: "0.0.0.0"  # ← LE PROBLÈME
  threadiness: 0
```

### Étape 3 : Modifier config

```bash
sudo nano /etc/falco/falco.yaml
```

**Chercher** la section `grpc:` et **modifier** :

```yaml
grpc:
  enabled: true
  bind_address: "127.0.0.1"  # ← CHANGÉ
  threadiness: 0
```

**Sauvegarder** : `Ctrl+O`, `Enter`, `Ctrl+X`

### Étape 4 : Vérifier qui était connecté

```bash
# Connexions actives maintenant
sudo netstat -antp | grep 8765

# Logs dernières 24h
sudo journalctl -u falco-modern-bpf --since "24 hours ago" | grep -iE "grpc|client|connect"
```

**Sauvegarder ces infos** si vous voyez des IPs externes!

### Étape 5 : Bloquer au firewall

```bash
# UFW
sudo ufw deny 8765/tcp
sudo ufw allow from 127.0.0.1 to any port 8765 proto tcp

# iptables (backup avant)
sudo iptables-save > ~/iptables_backup.rules
sudo iptables -A INPUT -p tcp --dport 8765 ! -s 127.0.0.1 -j DROP
```

### Étape 6 : Redémarrer Falco

```bash
sudo systemctl restart falco-modern-bpf
```

### Étape 7 : Vérifier

```bash
# Port doit montrer 127.0.0.1:8765 (pas 0.0.0.0:8765)
sudo netstat -tlnp | grep 8765

# Falco doit être actif
sudo systemctl status falco-modern-bpf
```

**Attendu** :
```
tcp  LISTEN  0  5  127.0.0.1:8765  0.0.0.0:*  1251/falco
                  ↑
              Localhost seulement
```

---

## 🔍 VÉRIFIER SI VOUS AVEZ ÉTÉ ESPIONNÉ

### 1. Logs Falco connexions

```bash
sudo journalctl -u falco-modern-bpf | grep -i "grpc\|client"
```

**Cherchez** :
- Connexions d'IPs externes (pas 127.0.0.1)
- Messages "client connected"
- Erreurs d'authentification

### 2. Connexions réseau historiques

```bash
# Connexions établies au port 8765 (si encore actives)
sudo netstat -antp | grep 8765 | grep ESTABLISHED
```

**Si vous voyez des IPs externes** → Quelqu'un lisait vos events!

### 3. Logs système

```bash
# Accès réseau suspects
sudo tail -1000 /var/log/syslog | grep 8765
sudo tail -1000 /var/log/auth.log | grep -i "falco"
```

---

## 📊 IMPACT DE LA MODIFICATION

### AVANT (DANGEREUX)

```
Falco écoute sur 0.0.0.0:8765
        ↓
Accessible depuis Internet
        ↓
N'importe qui peut se connecter via gRPC client
        ↓
Reçoit TOUS vos événements système en temps réel:
- Fichiers ouverts/modifiés
- Commandes exécutées
- Connexions réseau
- Processus lancés
```

### APRÈS (SÉCURISÉ)

```
Falco écoute sur 127.0.0.1:8765
        ↓
Accessible UNIQUEMENT depuis localhost
        ↓
Seuls les processus sur VOTRE machine peuvent se connecter
        ↓
Internet ne peut plus accéder
```

---

## ⚠️ QUESTIONS IMPORTANTES

### 1. Avez-vous besoin de l'API gRPC?

**Si NON** → Désactivez complètement gRPC:

```bash
sudo nano /etc/falco/falco.yaml

# Modifier:
grpc:
  enabled: false  # ← Désactiver complètement

# Redémarrer
sudo systemctl restart falco-modern-bpf
```

**Si OUI (pourquoi?)** :
- Utilisez-vous un outil qui se connecte à Falco? (Falcosidekick, etc.)
- Si oui, configurez-le pour utiliser 127.0.0.1:8765

### 2. Utilisez-vous Falco avec d'autres outils?

**Vérifiez** :
- Falcosidekick
- Falco Exporter
- Dashboards custom

**Si oui** → Adaptez leur config pour utiliser `localhost:8765` au lieu de `<votre-ip>:8765`

---

## 🔒 DURCISSEMENT ADDITIONNEL

### Option 1 : Ajouter authentification gRPC

Si vous avez **vraiment** besoin d'accès distant:

```yaml
grpc:
  enabled: true
  bind_address: "0.0.0.0"
  threadiness: 0
  private_key: "/etc/falco/certs/server.key"
  cert_chain: "/etc/falco/certs/server.crt"
  root_certs: "/etc/falco/certs/ca.crt"
```

**Puis** générez des certificats TLS.

### Option 2 : VPN/Tunnel

Si besoin d'accès distant:
- Utilisez WireGuard/OpenVPN
- Accédez via tunnel sécurisé
- Gardez bind_address: "127.0.0.1"

### Option 3 : Reverse proxy avec auth

```
Internet → Nginx (auth basic) → Falco (localhost)
```

---

## 🚀 APRÈS SÉCURISATION

### Vérifications à faire

```bash
# 1. Port correct?
sudo ss -tlnp | grep 8765
# Doit montrer: 127.0.0.1:8765

# 2. Falco fonctionne?
sudo systemctl status falco-modern-bpf

# 3. Events générés?
sudo journalctl -u falco-modern-bpf -f
# Doit montrer des events système

# 4. Plus de connexions externes?
sudo netstat -antp | grep 8765 | grep ESTABLISHED
# Ne doit rien montrer (ou seulement 127.0.0.1)
```

### Monitoring continu

```bash
# Alerter si port 8765 redevient 0.0.0.0
watch -n 60 'sudo ss -tlnp | grep 8765 | grep -v "127.0.0.1" && echo "⚠️  ALERT: Port 8765 exposed!" || echo "✅ OK"'
```

---

## 🔙 ROLLBACK (En cas de problème)

Si Falco ne fonctionne plus après modification:

```bash
# Restaurer config
sudo cp /etc/falco/falco.yaml.backup /etc/falco/falco.yaml

# Redémarrer
sudo systemctl restart falco-modern-bpf

# Vérifier
sudo systemctl status falco-modern-bpf
```

---

## 📋 CHECKLIST

Après exécution du script ou modifications manuelles:

- [ ] Config Falco modifiée (bind_address: 127.0.0.1)
- [ ] Backup config sauvegardé
- [ ] Firewall configuré (port 8765 bloqué externe)
- [ ] Falco redémarré
- [ ] Port 8765 sur 127.0.0.1 (vérifié)
- [ ] Falco génère des events (vérifié)
- [ ] Logs vérifiés (connexions suspectes?)
- [ ] Aucune connexion externe active
- [ ] Documentation lue et comprise

---

## 🆘 EN CAS DE DOUTE

### Contact support Falco

- Docs: https://falco.org/docs/
- Slack: https://kubernetes.slack.com/messages/falco
- GitHub: https://github.com/falcosecurity/falco

### Vérifier intégrité Falco

```bash
# Version
falco --version

# Règles actives
sudo falco --list

# Test sans démarrage service
sudo falco -c /etc/falco/falco.yaml --dry-run
```

---

**EXÉCUTEZ MAINTENANT** :

```bash
cd ~/GROK_CLI/grok-cli
sudo bash secure_falco.sh
```

**Durée** : 30 secondes
**Risque** : Minimal (backup automatique)
**Bénéfice** : Ferme la porte à l'espionnage externe

---

**FIN GUIDE** - 14 décembre 2025
