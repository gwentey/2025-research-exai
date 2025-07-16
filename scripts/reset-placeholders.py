#!/usr/bin/env python3
# Ce script remet les placeholders dans les fichiers de secrets
# Utile avant de pousser le code dans Git

import re
import sys
import os
from pathlib import Path

def reset_placeholders(file_path, placeholders):
    """Réinitialise les valeurs des secrets avec les placeholders originaux"""
    try:
        # Lire le contenu actuel
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        new_lines = []
        updated = False
        # Parcourir chaque ligne pour trouver et remplacer
        for line in lines:
            stripped_line = line.strip()
            found_match = False
            for key, placeholder in placeholders.items():
                # Cherche la clé au début de la ligne (après l'indentation)
                # Ex: "  secret-key: ..."
                pattern = r"^\s*" + re.escape(key) + r":.*" 
                if re.match(pattern, stripped_line):
                    # Recalculer l'indentation
                    indentation = line[:line.find(key)]
                    # Construire la nouvelle ligne avec le placeholder
                    new_line = f"{indentation}{key}: {placeholder}\n"
                    new_lines.append(new_line)
                    updated = True
                    found_match = True
                    print(f"  -> Remplacement de '{key}' dans {os.path.basename(file_path)}")
                    break # Clé trouvée pour cette ligne, passer à la suivante
            if not found_match:
                new_lines.append(line) # Garder la ligne originale si aucune clé ne correspondait

        # Réécrire le fichier seulement si des changements ont été faits
        if updated:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"✅ Placeholders restaurés dans {file_path}")
        else:
            print(f"ℹ️ Aucun placeholder à restaurer trouvé pour les clés spécifiées dans {file_path}")
            
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la restauration des placeholders dans {file_path}: {str(e)}")
        return False

def main():
    # Définir les mappings entre les clés dans le fichier et les placeholders
    base_placeholders = {
        "database-url": "REPLACE_WITH_DATABASE_URL",
        "secret-key": "REPLACE_WITH_SECRET_KEY",
        "google-client-id": "REPLACE_WITH_GOOGLE_CLIENT_ID",
        "google-client-secret": "REPLACE_WITH_GOOGLE_CLIENT_SECRET",
        "oauth-redirect-url": "REPLACE_WITH_LOCAL_REDIRECT_URL" # Clé commune, mais valeur différente dans le patch
    }
    
    azure_placeholders = {
        "oauth-redirect-url": "REPLACE_WITH_OAUTH_REDIRECT_URL_PROD" # Clé commune, mais placeholder spécifique Azure
    }
    
    kaggle_placeholders = {
        "username": "REPLACE_WITH_KAGGLE_USERNAME",
        "key": "REPLACE_WITH_KAGGLE_KEY"
    }
    
    base_secrets_file = None
    azure_patch_file = None
    kaggle_secrets_file = None
    
    # Rechercher les fichiers cibles directement
    print("Recherche des fichiers de secrets et de patch...")
    for root, dirs, files in os.walk("k8s"):
        for file in files:
            if file == "gateway-secrets.yaml":
                base_secrets_file = os.path.join(root, file)
                print(f"  Trouvé fichier de base: {base_secrets_file}")
            elif file == "oauth-redirect-patch.yaml":
                azure_patch_file = os.path.join(root, file)
                print(f"  Trouvé fichier patch Azure: {azure_patch_file}")
            elif file == "kaggle-secrets.yaml":
                kaggle_secrets_file = os.path.join(root, file)
                print(f"  Trouvé fichier secrets Kaggle: {kaggle_secrets_file}")

    if not base_secrets_file and not azure_patch_file and not kaggle_secrets_file:
        print("❌ ERREUR: Aucun fichier de secrets trouvé dans k8s/.")
        sys.exit(1)
        
    success1 = True
    if base_secrets_file:
        print(f"\nTraitement de {base_secrets_file}...")
        success1 = reset_placeholders(base_secrets_file, base_placeholders)
    else:
         print("⚠️ ATTENTION: Fichier gateway-secrets.yaml non trouvé.")
         
    success2 = True
    if azure_patch_file:
        print(f"\nTraitement de {azure_patch_file}...")
        success2 = reset_placeholders(azure_patch_file, azure_placeholders)
    else:
        print("⚠️ ATTENTION: Fichier oauth-redirect-patch.yaml non trouvé.")
    
    success3 = True
    if kaggle_secrets_file:
        print(f"\nTraitement de {kaggle_secrets_file}...")
        success3 = reset_placeholders(kaggle_secrets_file, kaggle_placeholders)
    else:
        print("⚠️ ATTENTION: Fichier kaggle-secrets.yaml non trouvé.")
    
    print("-" * 30) # Séparateur
    if success1 and success2 and success3:
        print("✅ Tous les placeholders applicables ont été réinitialisés avec succès.")
        print("   Vous pouvez maintenant committer vos changements sans exposer de secrets.")
    else:
        print("⚠️ Des erreurs sont survenues lors de la réinitialisation des placeholders.")
        sys.exit(1)

if __name__ == "__main__":
    main() 