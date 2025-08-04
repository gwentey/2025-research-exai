FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY ml-pipeline-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY ml-pipeline-service/app ./app
COPY ml-pipeline-service/alembic ./alembic
COPY ml-pipeline-service/alembic.ini ./
COPY common/ ./common/

# Expose the port the app runs on
EXPOSE 8082

# Default command to run the FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082"] 