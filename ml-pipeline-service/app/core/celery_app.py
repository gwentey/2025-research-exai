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
    
    # Task execution limits
    task_soft_time_limit=3600,  # 1 hour soft limit
    task_time_limit=3900,       # 1 hour 5 minutes hard limit
    
    # Task routing
    task_routes={
        'app.tasks.train_model': {'queue': 'ml_queue'},
    },
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1,  # Restart worker after each task to free memory
    
    # Result backend configuration
    result_expires=3600 * 24,  # Results expire after 24 hours
    
    # Retry configuration
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
)

# Configure task tracking
celery_app.conf.update(
    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,
) 