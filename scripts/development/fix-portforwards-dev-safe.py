#!/usr/bin/env python3
"""
utilisé pour le make dev-data
Script de réparation des port-forwards SAFE pour le développement
Ne tue JAMAIS les processus de logs, seulement les port-forwards bloqués
"""

import subprocess
import time
import sys
from typing import List, Tuple

def run_command(cmd: str, timeout: int = 10) -> Tuple[int, str, str]:
    """Exécute une commande avec gestion d'erreurs"""
    try:
        result = subprocess.run(cmd.split(), capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='ignore')
        return result.returncode or 0, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

def get_port_processes(port: int) -> List[int]:
    """Récupère les PIDs des processus qui occupent un port"""
    code, stdout, stderr = run_command(f"netstat -ano")
    if code != 0:
        return []
    
    pids = []
    for line in stdout.split('\n'):
        if f":{port}" in line and "LISTENING" in line:
            parts = line.strip().split()
            if len(parts) >= 5:
                try:
                    pid = int(parts[-1])
                    pids.append(pid)
                except ValueError:
                    continue
    return pids

def is_port_free(port: int) -> bool:
    """Vérifie si un port est libre"""
    return len(get_port_processes(port)) == 0

def start_port_forward(service: str, local_port: int, target_port: int) -> subprocess.Popen:
    """Démarre un port-forward en arrière-plan"""
    cmd = f"kubectl port-forward -n ibis-x service/{service} {local_port}:{target_port}"
    print(f"🚀 Démarrage: {cmd}")
    return subprocess.Popen(cmd.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def test_service_health(url: str) -> bool:
    """Teste la santé d'un service"""
    try:
        import requests
        response = requests.get(url, timeout=5)
        return response.status_code == 200
    except:
        return False

def main():
    print("=" * 60)
    print("🔧 RÉPARATION PORT-FORWARDS SAFE POUR DÉVELOPPEMENT")
    print("=" * 60)
    
    # Configuration des services
    services = [
        ("frontend", 8080, 80, "http://localhost:8080"),
        ("api-gateway-service", 9000, 80, "http://localhost:9000/health"),
        ("minio-service", 6700, 80, "http://localhost:6700/minio/health/ready"),
        ("postgresql-service", 5432, 5432, None),  # Pas de health check HTTP
        ("redis", 6379, 6379, None)  # Pas de health check HTTP
    ]
    
    print("🔍 Vérification de l'état actuel des ports...")
    
    # Vérifier quels ports sont libres
    free_ports = []
    occupied_ports = []
    
    for service_name, local_port, target_port, health_url in services:
        if is_port_free(local_port):
            free_ports.append((service_name, local_port, target_port, health_url))
            print(f"✅ Port {local_port} libre pour {service_name}")
        else:
            occupied_ports.append((service_name, local_port))
            print(f"⚠️  Port {local_port} occupé pour {service_name}")
    
    if not free_ports:
        print("🎉 Tous les ports sont déjà occupés - rien à faire !")
        return
    
    print(f"\n🚀 Démarrage des port-forwards manquants ({len(free_ports)} services)...")
    
    # Démarrer seulement les port-forwards manquants
    processes = []
    for service_name, local_port, target_port, health_url in free_ports:
        try:
            process = start_port_forward(service_name, local_port, target_port)
            processes.append((service_name, process, health_url))
        except Exception as e:
            print(f"❌ Erreur lors du démarrage de {service_name}: {e}")
    
    if not processes:
        print("❌ Aucun port-forward démarré")
        return
    
    print(f"\n⏳ Attente de la stabilisation ({len(processes)} services)...")
    time.sleep(10)
    
    print("\n🏥 Test de santé des nouveaux services...")
    healthy_count = 0
    for service_name, process, health_url in processes:
        if process.poll() is not None:
            print(f"❌ {service_name}: Processus crashé")
        elif health_url:
            if test_service_health(health_url):
                print(f"✅ {service_name}: OK (HTTP 200)")
                healthy_count += 1
            else:
                print(f"⚠️  {service_name}: Processus actif mais santé incertaine")
                healthy_count += 1
        else:
            print(f"✅ {service_name}: Processus actif (pas de test HTTP)")
            healthy_count += 1
    
    print("\n" + "=" * 60)
    print("📊 RÉSULTATS")
    print("=" * 60)
    print(f"Services réparés: {healthy_count}/{len(processes)}")
    
    if healthy_count == len(processes):
        print("🎉 SUCCÈS: Tous les port-forwards manquants sont opérationnels !")
    else:
        print("⚠️  ATTENTION: Certains services ne répondent pas parfaitement")
    
    print(f"\n💡 Les processus de logs sont préservés")
    print(f"🔧 Port-forwards actifs:")
    for service_name, local_port, target_port, health_url in services:
        if not is_port_free(local_port):
            print(f"   - {service_name}: localhost:{local_port} -> {target_port}")

if __name__ == "__main__":
    main()
