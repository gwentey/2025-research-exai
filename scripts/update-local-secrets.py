#!/usr/bin/env python3
# Ce script met à jour les secrets pour le développement local
# NE PAS inclure ce fichier dans Git

import os
import base64
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

def base64_encode(value):
    """Encode une chaîne en base64"""
    return base64.b64encode(value.encode()).decode()

def update_secrets_file(file_path, env_vars):
    """Met à jour les placeholders dans le fichier de secrets avec les valeurs encodées en base64"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Remplacer les placeholders par les valeurs encodées
        for key, value in env_vars.items():
            placeholder = f"REPLACE_WITH_{key.upper()}"
            encoded_value = base64_encode(value)
            content = re.sub(placeholder, encoded_value, content)
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        print(f"✅ Fichier mis à jour: {file_path}")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la mise à jour de {file_path}: {str(e)}")
        return False

def main():
    # Charger les variables d'environnement depuis .env
    load_dotenv()
    
    # Définir les mappings entre les placeholders et les variables d'environnement
    env_mappings = {
        "DATABASE_URL": os.getenv("DATABASE_URL"),
        "SECRET_KEY": os.getenv("JWT_SECRET_KEY"),
        "GOOGLE_CLIENT_ID": os.getenv("GOOGLE_CLIENT_ID"),
        "GOOGLE_CLIENT_SECRET": os.getenv("GOOGLE_CLIENT_SECRET"),
        "LOCAL_REDIRECT_URL": os.getenv("OAUTH_REDIRECT_URL") or os.getenv("LOCAL_REDIRECT_URL"),
    }
    
    # Vérifier si toutes les variables nécessaires sont définies
    missing_vars = [key for key, value in env_mappings.items() if not value]
    if missing_vars:
        print(f"❌ ERREUR: Les variables d'environnement suivantes manquent dans .env: {', '.join(missing_vars)}")
        sys.exit(1)
    
    # Afficher les variables qui seront utilisées (pour débogage)
    print("Variables trouvées dans .env:")
    for key, value in env_mappings.items():
        # Masquer les valeurs sensibles
        masked_value = value[:4] + "*" * (len(value) - 8) + value[-4:] if len(value) > 8 else "****"
        print(f"  - {key}: {masked_value}")
    
    # Chercher les fichiers de secrets
    found_files = []
    for root, dirs, files in os.walk("k8s"):
        for file in files:
            if "secret" in file.lower():
                found_files.append(os.path.join(root, file))
    
    # Si nous trouvons gateway-secrets.yaml, c'est notre cible
    target_files = [f for f in found_files if "gateway-secrets.yaml" in f]
    if not target_files:
        print(f"❌ ERREUR: Aucun fichier gateway-secrets.yaml trouvé.")
        print("Fichiers trouvés:", found_files)
        sys.exit(1)
    
    base_secrets_path = target_files[0]
    print(f"Fichier de secrets trouvé: {base_secrets_path}")
    
    # Mettre à jour le fichier de secrets
    success = update_secrets_file(base_secrets_path, env_mappings)
    
    # Mettre à jour le fichier de patch pour Azure si nécessaire
    azure_patch_path = Path("k8s/overlays/azure/oauth-redirect-patch.yaml")
    if azure_patch_path.exists():
        prod_url = os.getenv("OAUTH_REDIRECT_URL_PROD")
        if prod_url:
            update_secrets_file(azure_patch_path, {"OAUTH_REDIRECT_URL_PROD": prod_url})
        else:
            print("⚠️ ATTENTION: OAUTH_REDIRECT_URL_PROD n'est pas défini. Le patch Azure n'a pas été mis à jour.")
    
    if success:
        print("\n🔐 Tous les secrets ont été mis à jour pour le développement local.")
        print("Vous pouvez maintenant exécuter 'skaffold dev'.")
    else:
        print("\n❌ Des erreurs sont survenues lors de la mise à jour des secrets.")
        sys.exit(1)

if __name__ == "__main__":
    main() 