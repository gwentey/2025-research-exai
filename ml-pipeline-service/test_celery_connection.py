#!/usr/bin/env python
"""
Script de test pour vérifier la connexion Celery et l'envoi de tâches.
Usage: python test_celery_connection.py
"""

import os
import sys
import time
from uuid import uuid4

# Ajouter le répertoire parent au path pour importer nos modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.celery_app import celery_app
from app.tasks import train_model


def test_celery_connection():
    """Test la connexion à Celery et l'envoi d'une tâche."""
    print("🔍 Test de connexion Celery...")
    
    # 1. Vérifier la connexion au broker
    try:
        # Inspecter les workers actifs
        inspector = celery_app.control.inspect()
        active_workers = inspector.active()
        
        if active_workers:
            print(f"✅ Workers actifs trouvés: {list(active_workers.keys())}")
        else:
            print("❌ Aucun worker actif trouvé!")
            print("   Vérifiez que le worker Celery est en cours d'exécution:")
            print("   kubectl logs -n ibis-x -l app=ml-pipeline-celery-worker")
            return False
            
    except Exception as e:
        print(f"❌ Erreur de connexion au broker: {e}")
        print("   Vérifiez que Redis est accessible.")
        return False
    
    # 2. Vérifier les queues
    try:
        queues = inspector.active_queues()
        if queues:
            print(f"✅ Queues actives: {queues}")
        else:
            print("⚠️  Aucune queue active trouvée")
    except Exception as e:
        print(f"❌ Erreur lors de l'inspection des queues: {e}")
    
    # 3. Tester l'envoi d'une tâche
    experiment_id = str(uuid4())
    print(f"\n📤 Envoi d'une tâche de test avec experiment_id: {experiment_id}")
    
    try:
        # Envoyer la tâche
        result = train_model.apply_async(
            args=[experiment_id],
            queue='ml_queue'
        )
        
        print(f"✅ Tâche envoyée avec succès! Task ID: {result.id}")
        
        # Attendre un peu et vérifier le statut
        print("\n⏳ Attente de 5 secondes pour vérifier le statut...")
        time.sleep(5)
        
        # Vérifier le statut
        print(f"📊 Statut de la tâche: {result.state}")
        
        if result.state == 'PENDING':
            print("⚠️  La tâche est toujours en attente. Cela peut indiquer que:")
            print("   - Le worker n'a pas encore récupéré la tâche")
            print("   - Le worker n'écoute pas sur la queue 'ml_queue'")
            print("   - Il y a un problème avec la configuration Celery")
        elif result.state == 'STARTED':
            print("✅ La tâche a démarré!")
        elif result.state == 'SUCCESS':
            print("✅ La tâche s'est terminée avec succès!")
        elif result.state == 'FAILURE':
            print(f"❌ La tâche a échoué: {result.info}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi de la tâche: {e}")
        return False


def check_redis_connection():
    """Vérifie la connexion directe à Redis."""
    print("\n🔍 Test de connexion Redis...")
    
    try:
        import redis
        from app.core.config import settings
        
        # Parser l'URL Redis
        redis_url = settings.CELERY_BROKER_URL
        if redis_url.startswith('redis://'):
            parts = redis_url.replace('redis://', '').split(':')
            host = parts[0]
            port_db = parts[1].split('/')
            port = int(port_db[0])
            db = int(port_db[1]) if len(port_db) > 1 else 0
        else:
            print(f"❌ Format d'URL Redis non reconnu: {redis_url}")
            return False
        
        # Tester la connexion
        r = redis.Redis(host=host, port=port, db=db)
        r.ping()
        print(f"✅ Connexion Redis réussie: {host}:{port}/{db}")
        
        # Vérifier la queue
        queue_length = r.llen('ml_queue')
        print(f"📊 Nombre de tâches en attente dans 'ml_queue': {queue_length}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erreur de connexion Redis: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("🧪 TEST DE CONNEXION CELERY ET REDIS")
    print("=" * 60)
    
    # Test Redis
    redis_ok = check_redis_connection()
    
    # Test Celery
    celery_ok = test_celery_connection()
    
    print("\n" + "=" * 60)
    if redis_ok and celery_ok:
        print("✅ TOUS LES TESTS SONT PASSÉS!")
    else:
        print("❌ CERTAINS TESTS ONT ÉCHOUÉ")
        print("\n📋 Actions recommandées:")
        if not redis_ok:
            print("   1. Vérifier que Redis est en cours d'exécution")
            print("      kubectl get pods -n ibis-x | grep redis")
        if not celery_ok:
            print("   2. Vérifier que le worker Celery est en cours d'exécution")
            print("      kubectl get pods -n ibis-x | grep celery")
            print("   3. Vérifier les logs du worker")
            print("      kubectl logs -n ibis-x -l app=ml-pipeline-celery-worker")
    print("=" * 60)