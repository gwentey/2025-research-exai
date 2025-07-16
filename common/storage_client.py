"""
Storage client factory for handling both MinIO and Azure Blob Storage backends.

This module provides a unified interface for object storage operations
across different environments (development with MinIO, production with Azure).
"""

import os
import logging
from abc import ABC, abstractmethod
from typing import Optional, Union, Any
from io import BytesIO

logger = logging.getLogger(__name__)


class StorageClientError(Exception):
    """Base exception for storage client errors."""
    pass


class StorageClient(ABC):
    """Abstract base class for storage clients."""
    
    @abstractmethod
    def upload_file(self, file_data: Union[bytes, BytesIO], object_path: str) -> str:
        """Upload file to storage backend."""
        pass
    
    @abstractmethod
    def download_file(self, object_path: str) -> bytes:
        """Download file from storage backend."""
        pass
    
    @abstractmethod
    def delete_file(self, object_path: str) -> bool:
        """Delete file from storage backend."""
        pass
    
    @abstractmethod
    def list_files(self, prefix: str = "") -> list:
        """List files in storage backend with optional prefix."""
        pass


class MinIOStorageClient(StorageClient):
    """MinIO storage client implementation."""
    
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, container_name: str):
        try:
            from minio import Minio
            from minio.error import S3Error
            
            # Remove http:// or https:// prefix for MinIO client
            endpoint_clean = endpoint_url.replace('http://', '').replace('https://', '')
            secure = endpoint_url.startswith('https://')
            
            self.client = Minio(
                endpoint_clean,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure
            )
            self.container_name = container_name
            self.S3Error = S3Error
            
            # Test connection
            self.client.list_buckets()
            logger.info(f"Successfully connected to MinIO at {endpoint_url}")
            
        except ImportError:
            raise StorageClientError("minio package not installed. Install with: pip install minio>=7.0.0")
        except Exception as e:
            raise StorageClientError(f"Failed to connect to MinIO: {str(e)}")
    
    def upload_file(self, file_data: Union[bytes, BytesIO], object_path: str) -> str:
        """Upload file to MinIO bucket."""
        try:
            # Ensure bucket exists
            if not self.client.bucket_exists(self.container_name):
                self.client.make_bucket(self.container_name)
                logger.info(f"Created bucket: {self.container_name}")
            
            # Handle both bytes and BytesIO
            if isinstance(file_data, bytes):
                file_data = BytesIO(file_data)
            
            # Get file size
            file_data.seek(0, 2)  # Seek to end
            file_size = file_data.tell()
            file_data.seek(0)  # Reset to beginning
            
            self.client.put_object(
                self.container_name,
                object_path,
                file_data,
                length=file_size
            )
            
            storage_path = f"{self.container_name}/{object_path}"
            logger.info(f"Uploaded file to MinIO: {storage_path}")
            return storage_path
            
        except self.S3Error as e:
            raise StorageClientError(f"MinIO upload error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"Upload failed: {str(e)}")
    
    def download_file(self, object_path: str) -> bytes:
        """Download file from MinIO bucket."""
        try:
            response = self.client.get_object(self.container_name, object_path)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except self.S3Error as e:
            raise StorageClientError(f"MinIO download error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"Download failed: {str(e)}")
    
    def delete_file(self, object_path: str) -> bool:
        """Delete file from MinIO bucket."""
        try:
            self.client.remove_object(self.container_name, object_path)
            logger.info(f"Deleted file from MinIO: {object_path}")
            return True
        except self.S3Error as e:
            logger.error(f"MinIO delete error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Delete failed: {str(e)}")
            return False
    
    def list_files(self, prefix: str = "") -> list:
        """List files in MinIO bucket with optional prefix."""
        try:
            objects = self.client.list_objects(self.container_name, prefix=prefix)
            return [obj.object_name for obj in objects]
        except self.S3Error as e:
            raise StorageClientError(f"MinIO list error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"List failed: {str(e)}")


class AzureBlobStorageClient(StorageClient):
    """Azure Blob Storage client implementation."""
    
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, container_name: str):
        try:
            from azure.storage.blob import BlobServiceClient
            from azure.core.exceptions import AzureError
            
            # Build connection string for Azure
            connection_string = (
                f"DefaultEndpointsProtocol=https;"
                f"AccountName={access_key};"
                f"AccountKey={secret_key};"
                f"EndpointSuffix=core.windows.net"
            )
            
            self.client = BlobServiceClient.from_connection_string(connection_string)
            self.container_name = container_name
            self.AzureError = AzureError
            
            # Test connection
            self.client.get_account_information()
            logger.info(f"Successfully connected to Azure Blob Storage")
            
        except ImportError:
            raise StorageClientError("azure-storage-blob package not installed. Install with: pip install azure-storage-blob>=12.0.0")
        except Exception as e:
            raise StorageClientError(f"Failed to connect to Azure Blob Storage: {str(e)}")
    
    def upload_file(self, file_data: Union[bytes, BytesIO], object_path: str) -> str:
        """Upload file to Azure Blob Storage."""
        try:
            # Ensure container exists
            try:
                self.client.create_container(self.container_name)
                logger.info(f"Created container: {self.container_name}")
            except Exception:
                # Container might already exist
                pass
            
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=object_path
            )
            
            # Handle both bytes and BytesIO
            if isinstance(file_data, BytesIO):
                file_data.seek(0)
                data = file_data.read()
            else:
                data = file_data
            
            blob_client.upload_blob(data, overwrite=True)
            
            storage_path = f"{self.container_name}/{object_path}"
            logger.info(f"Uploaded file to Azure Blob Storage: {storage_path}")
            return storage_path
            
        except self.AzureError as e:
            raise StorageClientError(f"Azure upload error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"Upload failed: {str(e)}")
    
    def download_file(self, object_path: str) -> bytes:
        """Download file from Azure Blob Storage."""
        try:
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=object_path
            )
            return blob_client.download_blob().readall()
        except self.AzureError as e:
            raise StorageClientError(f"Azure download error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"Download failed: {str(e)}")
    
    def delete_file(self, object_path: str) -> bool:
        """Delete file from Azure Blob Storage."""
        try:
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=object_path
            )
            blob_client.delete_blob()
            logger.info(f"Deleted file from Azure Blob Storage: {object_path}")
            return True
        except self.AzureError as e:
            logger.error(f"Azure delete error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Delete failed: {str(e)}")
            return False
    
    def list_files(self, prefix: str = "") -> list:
        """List files in Azure Blob Storage container with optional prefix."""
        try:
            container_client = self.client.get_container_client(self.container_name)
            blobs = container_client.list_blobs(name_starts_with=prefix)
            return [blob.name for blob in blobs]
        except self.AzureError as e:
            raise StorageClientError(f"Azure list error: {str(e)}")
        except Exception as e:
            raise StorageClientError(f"List failed: {str(e)}")


def get_storage_client() -> StorageClient:
    """
    Factory function to get the appropriate storage client based on environment configuration.
    
    Returns:
        StorageClient: Configured storage client (MinIO or Azure)
    """
    storage_type = os.environ.get("STORAGE_TYPE", "minio").lower()
    
    if storage_type == "azure":
        # Configuration Azure Blob Storage
        account_name = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME")
        account_key = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")
        
        if not account_name or not account_key:
            logger.warning("Azure storage credentials not found, falling back to MinIO")
            storage_type = "minio"
        else:
            container_name = os.environ.get("STORAGE_BUCKET", "exai-datasets")
            # Pour Azure, l'endpoint est construit à partir du nom du compte
            endpoint = f"https://{account_name}.blob.core.windows.net"
            return AzureBlobStorageClient(endpoint, account_name, account_key, container_name)
    
    if storage_type == "minio":
        # Configuration MinIO - utilise le port 6700 par défaut
        endpoint = os.environ.get("MINIO_ENDPOINT", "http://minio-service.exai.svc.cluster.local:6700")
        access_key = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
        
        bucket_name = os.environ.get("STORAGE_BUCKET", "exai-datasets")
        return MinIOStorageClient(endpoint, access_key, secret_key, bucket_name)
    
    raise ValueError(f"Unsupported storage type: {storage_type}") 