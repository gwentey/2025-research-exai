from celery import Celery
from app.core.config import settings

celery_app = Celery(
    'ml_pipeline',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=['app.tasks']
)

# Configure Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Broker connection configuration (pour Celery 6.0+ compatibility)
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
    
    # Task execution limits optimisés pour ML
    task_soft_time_limit=7200,  # 2 hours soft limit for complex ML tasks
    task_time_limit=7500,       # 2 hours 5 minutes hard limit
    
    # Task routing
    task_routes={
        'app.tasks.train_model': {'queue': 'ml_queue'},
    },
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1,  # Restart worker after each task to free memory
    
    # Result backend configuration
    result_expires=3600 * 24,  # Results expire after 24 hours
    
    # Retry configuration avancée
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    task_retry_backoff=True,
    task_retry_backoff_max=600,  # Maximum 10 minutes
    task_retry_jitter=True,
)

# Configure task tracking avancé
celery_app.conf.update(
    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,
    
    # Monitoring et logging avancé
    worker_log_format='[%(asctime)s: %(levelname)s/%(processName)s] %(message)s',
    worker_task_log_format='[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s',
    
    # Configuration de la queue pour éviter la perte de tâches
    task_always_eager=False,  # Ne jamais exécuter les tâches de manière synchrone
    task_eager_propagates=True,
    
    # Configuration de récupération après erreur
    task_queue_ha_policy='all',
    worker_disable_rate_limits=False,
    
    # Optimisation de la mémoire pour les tâches ML
    worker_max_memory_per_child=2048000,  # 2GB limit par worker
    worker_proc_alive_timeout=4.0,
) 