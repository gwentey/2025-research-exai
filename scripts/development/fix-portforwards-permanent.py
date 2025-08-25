#!/usr/bin/env python3
"""
utilisé pour le make dev
Solution permanente pour les crashes de port-forward
Nettoie automatiquement les processus kubectl fantômes et redémarre les port-forwards
MULTI-PLATEFORME: Windows et macOS
"""

import subprocess
import time
import sys
import signal
import platform
from typing import List, Tuple

# Détection OS
IS_WINDOWS = platform.system() == 'Windows'
IS_MACOS = platform.system() == 'Darwin'

def run_command(cmd: str, timeout: int = 10) -> Tuple[int, str, str]:
    """Exécute une commande avec gestion d'erreurs"""
    try:
        result = subprocess.run(cmd.split(), capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='ignore')
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def get_port_processes(port: int) -> List[int]:
    """Récupère les PIDs des processus qui occupent un port"""
    pids = []
    
    if IS_WINDOWS:
        code, stdout, stderr = run_command(f"netstat -ano")
        if code != 0:
            return []
        
        for line in stdout.split('\n'):
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    try:
                        pid = int(parts[-1])
                        pids.append(pid)
                    except ValueError:
                        continue
    else:
        # macOS/Linux: utiliser lsof
        code, stdout, stderr = run_command(f"lsof -ti :{port}")
        if code == 0:
            for line in stdout.strip().split('\n'):
                if line.strip():
                    try:
                        pid = int(line.strip())
                        pids.append(pid)
                    except ValueError:
                        continue
    
    return pids

def kill_kubectl_zombies():
    """Nettoie intelligemment les processus kubectl (préserve les logs)"""
    print("🧹 Nettoyage intelligent des processus kubectl...")
    
    # Vérifier d'abord si des ports sont occupés
    occupied_ports = []
    services = [
        ("frontend", 8080),
        ("api-gateway-service", 9000),
        ("minio-service", 6700),
        ("postgresql-service", 5432),
        ("redis", 6379)
    ]
    
    for service_name, port in services:
        port_pids = get_port_processes(port)
        if port_pids:
            occupied_ports.append(port)
    
    if not occupied_ports:
        print("✅ Aucun port occupé - pas de nettoyage nécessaire")
        return True
    
    print(f"🔍 Ports occupés détectés: {occupied_ports}")
    
    # Obtenir les processus kubectl selon l'OS
    kubectl_pids = []
    
    if IS_WINDOWS:
        # Windows: utiliser tasklist
        code, stdout, stderr = run_command("tasklist")
        if code != 0:
            print(f"❌ Impossible de lister les processus: {stderr}")
            return False
        
        for line in stdout.split('\n'):
            if 'kubectl.exe' in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    try:
                        pid = int(parts[1])
                        kubectl_pids.append(pid)
                    except (ValueError, IndexError):
                        continue
    else:
        # macOS/Linux: utiliser ps aux
        code, stdout, stderr = run_command("ps aux")
        if code != 0:
            print(f"❌ Impossible de lister les processus: {stderr}")
            return False
        
        for line in stdout.split('\n'):
            if 'kubectl' in line and 'port-forward' in line:
                parts = line.strip().split()
                if len(parts) >= 2:
                    try:
                        pid = int(parts[1])
                        kubectl_pids.append(pid)
                    except (ValueError, IndexError):
                        continue
    
    if not kubectl_pids:
        print("✅ Aucun processus kubectl à nettoyer")
        return True
    
    print(f"🔍 Trouvé {len(kubectl_pids)} processus kubectl: {kubectl_pids}")
    
    # Tuer les processus selon l'OS
    for pid in kubectl_pids:
        if IS_WINDOWS:
            code, _, _ = run_command(f"taskkill /F /PID {pid}")
        else:
            # Sur macOS: d'abord essayer gentiment, puis forcer
            code, _, _ = run_command(f"kill -TERM {pid}")
            if code != 0:
                # Si kill -TERM échoue, forcer avec kill -KILL
                code, _, _ = run_command(f"kill -KILL {pid}")
        
        if code == 0:
            print(f"✅ Processus kubectl PID {pid} terminé")
        else:
            print(f"⚠️  Impossible de terminer le processus PID {pid}")
    
    time.sleep(2)  # Attendre que les ports se libèrent
    return True

def check_port_free(port: int) -> bool:
    """Vérifie qu'un port est libre"""
    pids = get_port_processes(port)
    return len(pids) == 0

def start_port_forward(service: str, local_port: int, target_port: int) -> subprocess.Popen:
    """Démarre un port-forward en arrière-plan"""
    cmd = f"kubectl port-forward -n ibis-x service/{service} {local_port}:{target_port}"
    print(f"🚀 Démarrage: {cmd}")
    
    try:
        if IS_WINDOWS:
            # Windows: utiliser Popen normal
            process = subprocess.Popen(
                cmd.split(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
        else:
            # macOS/Linux: utiliser nohup pour détacher le processus
            import os
            process = subprocess.Popen(
                cmd.split(),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid  # Créer un nouveau groupe de processus
            )
        return process
    except Exception as e:
        print(f"❌ Erreur lors du démarrage du port-forward: {e}")
        return None

def test_service_health(url: str, service_name: str) -> bool:
    """Test la santé d'un service"""
    try:
        import requests
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print(f"✅ {service_name}: OK (HTTP {response.status_code})")
            return True
        else:
            print(f"⚠️  {service_name}: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ {service_name}: {e}")
        return False

def main():
    print("=" * 60)
    print("🔧 SOLUTION PERMANENTE - RÉPARATION PORT-FORWARDS")
    print("=" * 60)
    
    # Configuration des services
    services = [
        ("frontend", 8080, 80, "http://localhost:8080"),
        ("api-gateway-service", 9000, 80, "http://localhost:9000/health"),
        ("minio-service", 6700, 80, "http://localhost:6700/minio/health/ready"),
        ("postgresql-service", 5432, 5432, None),  # Pas de health check HTTP
        ("redis", 6379, 6379, None)  # Pas de health check HTTP
    ]
    
    # Étape 1: Nettoyer les processus zombies
    if not kill_kubectl_zombies():
        print("❌ Échec du nettoyage des processus zombies")
        sys.exit(1)
    
    # Étape 2: Vérifier que les ports sont libres
    print("\n🔍 Vérification de la libération des ports...")
    for service, local_port, target_port, health_url in services:
        if not check_port_free(local_port):
            print(f"❌ Port {local_port} encore occupé pour {service}")
            pids = get_port_processes(local_port)
            print(f"   PIDs occupants: {pids}")
            # Forcer la libération selon l'OS
            for pid in pids:
                if IS_WINDOWS:
                    run_command(f"taskkill /F /PID {pid}")
                else:
                    # Sur macOS: d'abord essayer gentiment, puis forcer si nécessaire
                    print(f"   Tentative d'arrêt du PID {pid}...")
                    run_command(f"kill -TERM {pid}")
                    time.sleep(0.5)
                    # Vérifier si le processus existe encore
                    code, _, _ = run_command(f"kill -0 {pid}")
                    if code == 0:
                        print(f"   PID {pid} résistant - arrêt forcé...")
                        run_command(f"kill -KILL {pid}")
            time.sleep(1)
        else:
            print(f"✅ Port {local_port} libre pour {service}")
    
    # Étape 3: Démarrer les port-forwards
    print("\n🚀 Démarrage des port-forwards...")
    processes = []
    
    for service, local_port, target_port, health_url in services:
        process = start_port_forward(service, local_port, target_port)
        if process:
            processes.append((service, process, health_url))
            time.sleep(2)  # Délai entre les démarrages
    
    # Étape 4: Attendre la stabilisation
    print("\n⏳ Attente de la stabilisation (10 secondes)...")
    time.sleep(10)
    
    # Étape 5: Tester la santé des services
    print("\n🏥 Test de santé des services...")
    healthy_services = 0
    total_services = 0
    
    for service, process, health_url in processes:
        # Vérifier que le processus est toujours vivant
        if IS_WINDOWS:
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                print(f"❌ {service}: Processus crashé")
                print(f"   STDERR: {stderr}")
                continue
        else:
            # Sur macOS, on vérifie différemment car le processus est détaché
            try:
                if process.poll() is not None:
                    print(f"❌ {service}: Processus crashé")
                    continue
            except:
                # Le processus est détaché, on suppose qu'il fonctionne
                pass
        
        # Test de santé HTTP si disponible
        if health_url:
            if test_service_health(health_url, service):
                healthy_services += 1
            total_services += 1
        else:
            print(f"✅ {service}: Processus actif (pas de test HTTP)")
            healthy_services += 1
            total_services += 1
    
    # Étape 6: Résultats
    print("\n" + "=" * 60)
    print("📊 RÉSULTATS")
    print("=" * 60)
    print(f"Services sains: {healthy_services}/{len(services)}")
    
    if healthy_services == len(services):
        print("🎉 SUCCÈS: Tous les port-forwards sont opérationnels !")
        print("\n💡 Pour éviter les futurs problèmes:")
        print("   - Utiliser ce script au lieu de make start-portforwards")
        print("   - En cas de problème, relancer ce script")
        print("   - Ne pas terminer les port-forwards avec Ctrl+C brutal")
    else:
        print("⚠️  ATTENTION: Certains services ne répondent pas")
        print("   Vérifiez les logs Kubernetes avec:")
        print("   kubectl logs -n ibis-x -l app=<service-name>")
    
    print(f"\n🔧 Port-forwards actifs:")
    for service, local_port, target_port, _ in services:
        print(f"   - {service}: localhost:{local_port} -> {target_port}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Arrêt demandé par l'utilisateur")
        print("Les port-forwards continuent de tourner en arrière-plan")
        sys.exit(0)
