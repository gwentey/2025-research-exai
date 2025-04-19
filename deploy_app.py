#!/usr/bin/env python3
"""
Script de déploiement EXAI - Version multiplateforme

Ce script déploie les composants principaux d'EXAI (PostgreSQL, API Gateway, Service Selection)
sur un cluster Kubernetes et vérifie l'état des pods.
Compatible avec Windows, macOS et Linux.
"""

import os
import sys
import time
import subprocess
import platform

# --- Configuration ---
NAMESPACE = "exai"

# Chemins vers les manifestes K8s (relatifs à la racine du projet)
POSTGRES_K8S_DIR = "k8s/postgres/"
GATEWAY_K8S_DIR = "api-gateway/k8s/"
SELECTION_K8S_DIR = "service-selection/k8s/"

# Labels pour identifier les pods
POSTGRES_LABEL = "app=postgresql"
GATEWAY_LABEL = "app=api-gateway"
SELECTION_LABEL = "app=service-selection"

# Détermine l'exécutable kubectl (ajoute .exe sous Windows si nécessaire)
KUBECTL = "kubectl.exe" if platform.system() == "Windows" else "kubectl"

def print_colored(message, color=None):
    """Affiche un message avec une couleur (si supporté par le terminal)"""
    colors = {
        'green': '\033[92m',
        'yellow': '\033[93m',
        'red': '\033[91m',
        'blue': '\033[94m',
        'bold': '\033[1m',
        'end': '\033[0m'
    }
    
    # Désactive les couleurs sur Windows CMD (sauf Windows Terminal moderne)
    if platform.system() == "Windows" and "TERM" not in os.environ:
        print(message)
        return

    if color and color in colors:
        print(f"{colors[color]}{message}{colors['end']}")
    else:
        print(message)

def run_command(command, exit_on_error=True):
    """Exécute une commande shell et retourne son résultat"""
    try:
        # L'utilisation de shell=True est nécessaire pour certaines commandes complexes
        # mais est généralement déconseillée pour des raisons de sécurité
        result = subprocess.run(command, shell=True, check=True, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print_colored(f"❌ Erreur lors de l'exécution de la commande: {command}", "red")
        print_colored(f"Code de sortie: {e.returncode}", "red")
        print_colored(f"Erreur: {e.stderr}", "red")
        if exit_on_error:
            sys.exit(1)
        return None

def apply_manifests(directory, component_name):
    """Applique les manifestes Kubernetes depuis un répertoire"""
    print_colored("-----------------------------------------------------")
    print_colored(f"🚀 Déploiement de {component_name} depuis {directory}...", "blue")
    
    # Vérifier si le répertoire existe
    if not os.path.exists(directory):
        print_colored(f"❌ Le répertoire {directory} n'existe pas!", "red")
        sys.exit(1)
        
    cmd = f'{KUBECTL} apply -f "{directory}" -n {NAMESPACE}'
    output = run_command(cmd)
    
    if output:
        print_colored(f"✅ Manifestes pour {component_name} appliqués avec succès.", "green")
        if output.strip():
            print(output)

def check_pods(label, component_name):
    """Vérifie l'état des pods correspondant à un label"""
    print_colored("-----------------------------------------------------")
    print_colored(f"🔍 Vérification du statut du pod {component_name} (label: {label})...", "blue")
    
    cmd = f'{KUBECTL} get pods -n {NAMESPACE} -l {label}'
    output = run_command(cmd, exit_on_error=False)
    
    if output:
        print(output)
    else:
        print_colored(f"⚠️ Impossible de vérifier les pods pour {component_name}", "yellow")

def main():
    """Fonction principale du script de déploiement"""
    print_colored("🚀 Démarrage du déploiement EXAI sur le namespace " + 
                  f"'{NAMESPACE}'...", "bold")
    
    # Vérifier si kubectl est installé
    try:
        subprocess.run([KUBECTL, "version", "--client"], 
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_colored("❌ kubectl n'est pas installé ou n'est pas dans le PATH!", "red")
        print_colored("Veuillez installer kubectl avant de continuer.", "red")
        sys.exit(1)
        
    # Vérifier si le namespace existe, le créer si nécessaire
    namespace_check = subprocess.run(
        f'{KUBECTL} get namespace {NAMESPACE}', 
        shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    
    if namespace_check.returncode != 0:
        print_colored(f"⚠️ Le namespace {NAMESPACE} n'existe pas. Création...", "yellow")
        run_command(f'{KUBECTL} create namespace {NAMESPACE}')
    
    # 1. Déployer PostgreSQL
    apply_manifests(POSTGRES_K8S_DIR, "PostgreSQL")
    
    # 2. Déployer API Gateway
    apply_manifests(GATEWAY_K8S_DIR, "API Gateway")
    
    # 3. Déployer Service Selection
    apply_manifests(SELECTION_K8S_DIR, "Service Selection")
    
    # Attendre que les pods démarrent
    print_colored("⏳ Attente de quelques secondes pour que les pods démarrent...", "yellow")
    time.sleep(10)  # Pause pour laisser les pods démarrer
    
    # 4. Vérifier les pods
    check_pods(POSTGRES_LABEL, "PostgreSQL")
    check_pods(GATEWAY_LABEL, "API Gateway")
    check_pods(SELECTION_LABEL, "Service Selection")
    
    # 5. Afficher tous les pods du namespace
    print_colored("-----------------------------------------------------")
    print_colored(f"📊 Tous les pods dans le namespace {NAMESPACE}:", "blue")
    run_command(f'{KUBECTL} get pods -n {NAMESPACE}', exit_on_error=False)
    
    print_colored("-----------------------------------------------------")
    print_colored("🏁 Script de déploiement terminé avec succès! 🎉", "green")
    print_colored("-----------------------------------------------------")
    print_colored("📝 N'oubliez pas d'appliquer les migrations Alembic pour", "yellow")
    print_colored("   initialiser le schéma de la base de données.", "yellow")
    print_colored("   Voir la section 3.4 du guide de démarrage.", "yellow")

if __name__ == "__main__":
    main() 