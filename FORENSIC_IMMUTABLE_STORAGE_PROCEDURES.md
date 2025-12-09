# 🔐 Procédures de Stockage Immuable - Base Forensique
## 2025-12-08 00:10 - WORM + IPFS

---

## 📊 MANIFESTS CRÉÉS

### 3 Manifests Forensiques Ancrés

| Catégorie | Fichiers | Merkle Root | Ancrages |
|-----------|----------|-------------|----------|
| **CODE** | 161 | `8f5be9a5dea09f6ab7d867a01fd47939db50b86e47b4ce2f5876378de30b538b` | OTS ✅ TSA ✅ |
| **DOCS** | 205 | `a7928aa3293db9b8f1e9a82975b92d2f6814f6a63216f55bbdad6a6e9c393b0a` | OTS ✅ TSA ✅ |
| **OTHERS** | 440 | `3d4d8088c7ab4951662af6a1818056e64ec9c86afc327a29b5fd9f520fd3a1aa` | OTS ✅ TSA ✅ |
| **TOTAL** | **806** | - | 6 ancrages |

**Fichiers manifests:**
- `secure_integrity_manifest_CODE.json`
- `secure_integrity_manifest_DOCS.json`
- `secure_integrity_manifest_OTHERS.json`

---

## 🔐 ÉTAPE 1: ANCRAGE SIGSTORE (Optionnel mais Recommandé)

### Installation Sigstore (si nécessaire)
```bash
# Déjà installé dans l'environnement conda
conda activate LLM_API_SESSION_SECURED
sigstore --version  # Devrait afficher 4.1.0
```

### Signer les 3 Manifests
```bash
cd /home/zack/GROK_CLI/grok-cli

# Environnement conda
source ~/anaconda3/etc/profile.d/conda.sh
conda activate LLM_API_SESSION_SECURED

# Signer CODE
sigstore sign secure_integrity_manifest_CODE.json \
  --bundle logs/anchors/sigstore/manifest_CODE.sigstore.bundle.json

# Signer DOCS
sigstore sign secure_integrity_manifest_DOCS.json \
  --bundle logs/anchors/sigstore/manifest_DOCS.sigstore.bundle.json

# Signer OTHERS
sigstore sign secure_integrity_manifest_OTHERS.json \
  --bundle logs/anchors/sigstore/manifest_OTHERS.sigstore.bundle.json
```

**Note:** Sigstore ouvrira un navigateur pour authentification OIDC Google.

**Résultat attendu:**
- 3 bundles Sigstore créés
- Logs dans Rekor (transparency log public)
- Indices Rekor enregistrés

---

## 💾 ÉTAPE 2: STOCKAGE WORM (Write Once Read Many)

### Option A: AWS S3 Glacier Deep Archive avec Object Lock

**Avantages:**
- Stockage le moins cher (~$1/TB/mois)
- Immutabilité garantie (Object Lock)
- Compliance mode (impossible de supprimer avant expiration)
- Durabilité 99.999999999% (11 nines)

**Procédure:**

#### 1. Installer AWS CLI
```bash
pip install awscli --upgrade
aws --version
```

#### 2. Configurer AWS Credentials
```bash
aws configure
# AWS Access Key ID: [Votre clé]
# AWS Secret Access Key: [Votre clé secrète]
# Default region: us-east-1 (ou votre région)
# Default output format: json
```

#### 3. Créer Bucket S3 avec Object Lock
```bash
# Créer bucket avec versioning et object lock
aws s3api create-bucket \
  --bucket grok-cli-forensic-immutable \
  --region us-east-1 \
  --object-lock-enabled-for-bucket

# Activer versioning (requis pour Object Lock)
aws s3api put-bucket-versioning \
  --bucket grok-cli-forensic-immutable \
  --versioning-configuration Status=Enabled

# Configurer Object Lock (Compliance mode)
aws s3api put-object-lock-configuration \
  --bucket grok-cli-forensic-immutable \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": {
        "Mode": "COMPLIANCE",
        "Years": 7
      }
    }
  }'
```

#### 4. Upload des Manifests
```bash
cd /home/zack/GROK_CLI/grok-cli

# Upload CODE manifest
aws s3 cp secure_integrity_manifest_CODE.json \
  s3://grok-cli-forensic-immutable/manifests/2025-12-08/CODE.json \
  --storage-class DEEP_ARCHIVE \
  --metadata "merkle=8f5be9a5dea09f6ab7d867a01fd47939db50b86e47b4ce2f5876378de30b538b,files=161"

# Upload DOCS manifest
aws s3 cp secure_integrity_manifest_DOCS.json \
  s3://grok-cli-forensic-immutable/manifests/2025-12-08/DOCS.json \
  --storage-class DEEP_ARCHIVE \
  --metadata "merkle=a7928aa3293db9b8f1e9a82975b92d2f6814f6a63216f55bbdad6a6e9c393b0a,files=205"

# Upload OTHERS manifest
aws s3 cp secure_integrity_manifest_OTHERS.json \
  s3://grok-cli-forensic-immutable/manifests/2025-12-08/OTHERS.json \
  --storage-class DEEP_ARCHIVE \
  --metadata "merkle=3d4d8088c7ab4951662af6a1818056e64ec9c86afc327a29b5fd9f520fd3a1aa,files=440"
```

#### 5. Upload des Ancrages
```bash
# Upload tous les receipts OTS
aws s3 sync logs/anchors/ots/ \
  s3://grok-cli-forensic-immutable/anchors/2025-12-08/ots/ \
  --storage-class DEEP_ARCHIVE \
  --exclude "*" \
  --include "merkle_CODE_*.ots" \
  --include "merkle_DOCS_*.ots" \
  --include "merkle_OTHERS_*.ots"

# Upload tous les receipts TSA
aws s3 sync logs/anchors/tsa/ \
  s3://grok-cli-forensic-immutable/anchors/2025-12-08/tsa/ \
  --storage-class DEEP_ARCHIVE \
  --exclude "*" \
  --include "merkle_CODE_*.ts*" \
  --include "merkle_DOCS_*.ts*" \
  --include "merkle_OTHERS_*.ts*"

# Upload bundles Sigstore (si créés)
aws s3 sync logs/anchors/sigstore/ \
  s3://grok-cli-forensic-immutable/anchors/2025-12-08/sigstore/ \
  --storage-class DEEP_ARCHIVE \
  --exclude "*" \
  --include "manifest_*.sigstore.bundle.json"
```

#### 6. Vérifier Object Lock
```bash
# Lister les objets avec leur statut de lock
aws s3api list-object-versions \
  --bucket grok-cli-forensic-immutable \
  --prefix manifests/2025-12-08/

# Vérifier retention d'un objet spécifique
aws s3api get-object-retention \
  --bucket grok-cli-forensic-immutable \
  --key manifests/2025-12-08/CODE.json
```

**Résultat:**
- ✅ 3 manifests stockés en WORM (immuables 7 ans)
- ✅ Ancrages cryptographiques stockés
- ✅ Impossible de modifier ou supprimer (Compliance mode)
- ✅ Coût: ~$0.01/mois pour les 3 manifests

---

### Option B: Stockage Local WORM (Disque Blu-ray M-DISC)

**Avantages:**
- Aucun coût cloud
- Support physique immuable (durée 1000 ans)
- Contrôle total

**Matériel requis:**
- Graveur Blu-ray M-DISC (ex: LG WH16NS40)
- Disques Blu-ray M-DISC (25GB ou 100GB)
- Coût: ~$100 graveur + ~$5/disque

**Procédure:**

#### 1. Préparer les Fichiers
```bash
cd /home/zack/GROK_CLI/grok-cli

# Créer répertoire de staging
mkdir -p /tmp/forensic_archive_2025-12-08

# Copier manifests
cp secure_integrity_manifest_*.json /tmp/forensic_archive_2025-12-08/

# Copier ancrages
cp -r logs/anchors/ots/merkle_CODE_* /tmp/forensic_archive_2025-12-08/
cp -r logs/anchors/ots/merkle_DOCS_* /tmp/forensic_archive_2025-12-08/
cp -r logs/anchors/ots/merkle_OTHERS_* /tmp/forensic_archive_2025-12-08/
cp -r logs/anchors/tsa/merkle_* /tmp/forensic_archive_2025-12-08/

# Créer checksum
cd /tmp/forensic_archive_2025-12-08
sha256sum * > SHA256SUMS.txt
```

#### 2. Créer ISO
```bash
# Installer genisoimage (si nécessaire)
sudo apt-get install genisoimage

# Créer ISO avec Rock Ridge extensions
genisoimage -r -J -o forensic_archive_2025-12-08.iso \
  -V "GROK_FORENSIC_2025-12-08" \
  /tmp/forensic_archive_2025-12-08/
```

#### 3. Graver sur M-DISC
```bash
# Installer brasero ou wodim
sudo apt-get install brasero

# Graver (remplacer /dev/sr0 par votre graveur)
wodim -v dev=/dev/sr0 speed=4 -dao forensic_archive_2025-12-08.iso

# OU utiliser interface graphique
brasero forensic_archive_2025-12-08.iso
```

#### 4. Vérifier le Gravage
```bash
# Comparer ISO gravé vs original
dd if=/dev/sr0 bs=2048 count=$(stat -c%s forensic_archive_2025-12-08.iso | awk '{print int($1/2048)}') | sha256sum
sha256sum forensic_archive_2025-12-08.iso
# Les deux hashes doivent être identiques
```

**Étiquette du disque:**
```
GROK CLI - Base Forensique
Date: 2025-12-08
Manifests: CODE (161) + DOCS (205) + OTHERS (440)
Merkle Roots:
  CODE:   8f5be9a5...
  DOCS:   a7928aa3...
  OTHERS: 3d4d8088...
Ancrages: OTS + TSA + Sigstore
Stockage: WORM (immuable 1000 ans)
```

---

## 🌐 ÉTAPE 3: STOCKAGE IPFS (InterPlanetary File System)

### Option A: IPFS avec Pinata (Service d'Hébergement)

**Avantages:**
- Gratuit jusqu'à 1GB
- Interface web simple
- API disponible
- Réplication automatique

**Procédure:**

#### 1. Créer Compte Pinata
```
URL: https://pinata.cloud/
Plan: Free (1GB)
```

#### 2. Obtenir API Keys
```
Dashboard → API Keys → New Key
Name: grok-cli-forensic
Permissions:
  - pinFileToIPFS ✓
  - pinJSONToIPFS ✓
  - unpin ✗
```

#### 3. Upload via API
```bash
# Variables
PINATA_API_KEY="your_api_key"
PINATA_SECRET_KEY="your_secret_key"

# Upload CODE manifest
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET_KEY" \
  -F "file=@secure_integrity_manifest_CODE.json" \
  -F "pinataMetadata={\"name\":\"GROK_CODE_2025-12-08\",\"keyvalues\":{\"category\":\"code\",\"files\":\"161\",\"merkle\":\"8f5be9a5dea09f6a\"}}"

# Upload DOCS manifest
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET_KEY" \
  -F "file=@secure_integrity_manifest_DOCS.json" \
  -F "pinataMetadata={\"name\":\"GROK_DOCS_2025-12-08\",\"keyvalues\":{\"category\":\"docs\",\"files\":\"205\",\"merkle\":\"a7928aa3293db9b8\"}}"

# Upload OTHERS manifest
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET_KEY" \
  -F "file=@secure_integrity_manifest_OTHERS.json" \
  -F "pinataMetadata={\"name\":\"GROK_OTHERS_2025-12-08\",\"keyvalues\":{\"category\":\"others\",\"files\":\"440\",\"merkle\":\"3d4d8088c7ab4951\"}}"
```

**Résultat attendu:**
```json
{
  "IpfsHash": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "PinSize": 12345,
  "Timestamp": "2025-12-08T00:00:00.000Z"
}
```

#### 4. Sauvegarder les CIDs
```bash
# Créer fichier de référence
cat > IPFS_CIDS.txt << 'EOF'
GROK CLI - IPFS Content Identifiers
Date: 2025-12-08

CODE Manifest:
  CID: QmXXXXXX...
  URL: https://gateway.pinata.cloud/ipfs/QmXXXXXX...

DOCS Manifest:
  CID: QmYYYYYY...
  URL: https://gateway.pinata.cloud/ipfs/QmYYYYYY...

OTHERS Manifest:
  CID: QmZZZZZZ...
  URL: https://gateway.pinata.cloud/ipfs/QmZZZZZZ...
EOF
```

---

### Option B: IPFS Local avec Kubo

**Avantages:**
- Contrôle total
- Pas de dépendance externe
- Gratuit

**Procédure:**

#### 1. Installer IPFS (Kubo)
```bash
# Télécharger
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz

# Extraire
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz

# Installer
cd kubo
sudo bash install.sh

# Vérifier
ipfs --version
```

#### 2. Initialiser IPFS
```bash
# Init
ipfs init

# Configuration (optionnel)
ipfs config Addresses.Gateway /ip4/127.0.0.1/tcp/8080
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001
```

#### 3. Démarrer Daemon
```bash
# En background
ipfs daemon &

# Vérifier
ipfs id
```

#### 4. Ajouter les Manifests
```bash
cd /home/zack/GROK_CLI/grok-cli

# Ajouter CODE
ipfs add secure_integrity_manifest_CODE.json
# Retourne: added QmXXX... secure_integrity_manifest_CODE.json

# Ajouter DOCS
ipfs add secure_integrity_manifest_DOCS.json
# Retourne: added QmYYY... secure_integrity_manifest_DOCS.json

# Ajouter OTHERS
ipfs add secure_integrity_manifest_OTHERS.json
# Retourne: added QmZZZ... secure_integrity_manifest_OTHERS.json

# Pin pour garder permanent
ipfs pin add QmXXX...
ipfs pin add QmYYY...
ipfs pin add QmZZZ...
```

#### 5. Publier sur IPNS (Optionnel)
```bash
# Créer clé IPNS
ipfs key gen --type=rsa --size=2048 grok-forensic

# Publier
ipfs name publish --key=grok-forensic /ipfs/QmXXX...

# Retourne: Published to k51... : /ipfs/QmXXX...
# Le k51... est votre IPNS address (immuable)
```

#### 6. Partager avec Réseau Public
```bash
# Annoncer au DHT
ipfs dht provide QmXXX...
ipfs dht provide QmYYY...
ipfs dht provide QmZZZ...

# Vérifier accessibilité publique
curl https://ipfs.io/ipfs/QmXXX...
```

---

## 📋 ÉTAPE 4: CRÉER INDEX FORENSIQUE

```bash
cat > FORENSIC_IMMUTABLE_STORAGE_INDEX.md << 'EOF'
# Index de Stockage Immuable - Base Forensique GROK CLI
## Date: 2025-12-08

---

## 🔐 MERKLE ROOTS

| Catégorie | Fichiers | Merkle Root |
|-----------|----------|-------------|
| CODE | 161 | `8f5be9a5dea09f6ab7d867a01fd47939db50b86e47b4ce2f5876378de30b538b` |
| DOCS | 205 | `a7928aa3293db9b8f1e9a82975b92d2f6814f6a63216f55bbdad6a6e9c393b0a` |
| OTHERS | 440 | `3d4d8088c7ab4951662af6a1818056e64ec9c86afc327a29b5fd9f520fd3a1aa` |

---

## ⛓️  ANCRAGES CRYPTOGRAPHIQUES

### OpenTimestamps (Bitcoin)
- CODE: `logs/anchors/ots/merkle_CODE_8f5be9a5dea09f6a.ots`
- DOCS: `logs/anchors/ots/merkle_DOCS_a7928aa3293db9b8.ots`
- OTHERS: `logs/anchors/ots/merkle_OTHERS_3d4d8088c7ab4951.ots`

### TSA (RFC3161)
- CODE: `logs/anchors/tsa/merkle_CODE_8f5be9a5dea09f6a.tsr`
- DOCS: `logs/anchors/tsa/merkle_DOCS_a7928aa3293db9b8.tsr`
- OTHERS: `logs/anchors/tsa/merkle_OTHERS_3d4d8088c7ab4951.tsr`

### Sigstore (Rekor)
- CODE: Rekor index XXXXXX
- DOCS: Rekor index YYYYYY
- OTHERS: Rekor index ZZZZZZ

---

## 💾 STOCKAGE WORM

### AWS S3 Glacier Deep Archive
- Bucket: `grok-cli-forensic-immutable`
- Region: `us-east-1`
- Object Lock: Compliance Mode (7 ans)
- CODE: `s3://grok-cli-forensic-immutable/manifests/2025-12-08/CODE.json`
- DOCS: `s3://grok-cli-forensic-immutable/manifests/2025-12-08/DOCS.json`
- OTHERS: `s3://grok-cli-forensic-immutable/manifests/2025-12-08/OTHERS.json`

### M-DISC Blu-ray (Optionnel)
- Disque: `GROK_FORENSIC_2025-12-08`
- Format: ISO 9660 + Rock Ridge
- Hash ISO: [À remplir après gravage]
- Localisation: [Coffre-fort / Safe]

---

## 🌐 STOCKAGE IPFS

### Pinata.cloud
- CODE CID: `QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- DOCS CID: `QmYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY`
- OTHERS CID: `QmZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ`

### URLs Publiques
- CODE: `https://gateway.pinata.cloud/ipfs/QmXXX...`
- DOCS: `https://gateway.pinata.cloud/ipfs/QmYYY...`
- OTHERS: `https://gateway.pinata.cloud/ipfs/QmZZZ...`

---

## 🔍 USAGE FORENSIQUE

### Vérifier Intégrité d'un Fichier
```bash
# 1. Obtenir hash du fichier
sha256sum suspicious_file.ts

# 2. Chercher dans manifest
cat secure_integrity_manifest_CODE.json | jq '.files["path/to/suspicious_file.ts"].sha256'

# 3. Comparer
# Si différent → fichier modifié depuis 2025-12-08
```

### Détecter Régression
```bash
# Comparer manifests de deux dates
diff <(jq -S '.files' manifest_2025-12-07.json) \
     <(jq -S '.files' manifest_2025-12-08.json)
```

### Analyse Temporelle
```bash
# Extraire fichiers modifiés entre deux snapshots
# → Identifier les changements légitimes vs malveillants
```

---

## 📊 COÛTS ESTIMÉS

| Service | Coût |
|---------|------|
| AWS S3 Glacier Deep Archive | $0.01/mois |
| IPFS Pinata (Free tier) | $0/mois |
| OpenTimestamps | Gratuit |
| TSA FreeTSA | Gratuit |
| Sigstore | Gratuit |
| M-DISC (optionnel) | $5 one-time |
| **TOTAL** | **~$0.12/an** |

---

## ✅ STATUT

- [x] 3 Manifests créés (CODE, DOCS, OTHERS)
- [x] Ancrages OTS créés
- [x] Ancrages TSA créés
- [ ] Ancrages Sigstore (à faire manuellement)
- [ ] Upload AWS S3 Glacier
- [ ] Upload IPFS Pinata
- [ ] Gravure M-DISC (optionnel)

---

**Base Forensique Immuable Établie** 🔐
**Toute modification future sera détectable** ✅
EOF
```

---

## 📝 RÉSUMÉ DES COMMANDES

### Ancrage Sigstore (Interactif)
```bash
cd /home/zack/GROK_CLI/grok-cli
conda activate LLM_API_SESSION_SECURED
sigstore sign secure_integrity_manifest_CODE.json --bundle logs/anchors/sigstore/manifest_CODE.sigstore.bundle.json
sigstore sign secure_integrity_manifest_DOCS.json --bundle logs/anchors/sigstore/manifest_DOCS.sigstore.bundle.json
sigstore sign secure_integrity_manifest_OTHERS.json --bundle logs/anchors/sigstore/manifest_OTHERS.sigstore.bundle.json
```

### Upload AWS S3 Glacier (Après config)
```bash
aws s3 cp secure_integrity_manifest_CODE.json s3://grok-cli-forensic-immutable/manifests/2025-12-08/CODE.json --storage-class DEEP_ARCHIVE
aws s3 cp secure_integrity_manifest_DOCS.json s3://grok-cli-forensic-immutable/manifests/2025-12-08/DOCS.json --storage-class DEEP_ARCHIVE
aws s3 cp secure_integrity_manifest_OTHERS.json s3://grok-cli-forensic-immutable/manifests/2025-12-08/OTHERS.json --storage-class DEEP_ARCHIVE
```

### Upload IPFS Pinata (Via API)
```bash
# Remplacer YOUR_API_KEY et YOUR_SECRET
curl -X POST "https://api.pinata.cloud/pinning/pinFileToIPFS" \
  -H "pinata_api_key: YOUR_API_KEY" \
  -H "pinata_secret_api_key: YOUR_SECRET" \
  -F "file=@secure_integrity_manifest_CODE.json"
```

---

## ⚠️ IMPORTANT

1. **Sauvegarder les CIDs IPFS** - Sans eux, impossible de retrouver les fichiers
2. **Tester les récupérations** - Vérifier qu'on peut retriever depuis WORM/IPFS
3. **Documenter les accès** - Garder credentials AWS/Pinata en sécurité
4. **Valider les ancrages** - Vérifier OTS après ~1h (confirmation Bitcoin)

---

**Procédures créées:** 2025-12-08 00:15
**Status:** ✅ Prêt pour déploiement
