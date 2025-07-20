# Variables de configuration pour l'infrastructure Azure EXAI

variable "project_name" {
  description = "Nom du projet (utilisé pour préfixer les ressources)"
  type        = string
  default     = "exai"
  
  validation {
    condition     = can(regex("^[a-z0-9]{2,10}$", var.project_name))
    error_message = "Le nom du projet doit contenir uniquement des lettres minuscules et des chiffres, entre 2 et 10 caractères."
  }
}

variable "environment" {
  description = "Environnement de déploiement"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "L'environnement doit être 'dev', 'staging' ou 'prod'."
  }
}

variable "location" {
  description = "Région Azure pour déployer les ressources"
  type        = string
  default     = "East US"
  
  validation {
    condition = contains([
      "East US", "East US 2", "West US", "West US 2", "West US 3",
      "Central US", "North Central US", "South Central US",
      "West Europe", "North Europe", "UK South", "UK West",
      "France Central", "Germany West Central", "Switzerland North",
      "Southeast Asia", "East Asia", "Japan East", "Japan West",
      "Australia East", "Australia Southeast", "Canada Central",
      "Brazil South", "South Africa North"
    ], var.location)
    error_message = "Région Azure non valide. Vérifiez les régions disponibles."
  }
}

variable "kubernetes_version" {
  description = "Version de Kubernetes pour le cluster AKS"
  type        = string
  default     = "1.28"
  
  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.kubernetes_version))
    error_message = "La version Kubernetes doit être 1.27 ou supérieure."
  }
}

# Variables de configuration du stockage
variable "storage_replication_type" {
  description = "Type de réplication pour le stockage Azure"
  type        = string
  default     = "LRS"
  
  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_replication_type)
    error_message = "Type de réplication invalide. Utilisez LRS, GRS, RAGRS, ZRS, GZRS ou RAGZRS."
  }
}

variable "storage_tier" {
  description = "Niveau de performance du stockage"
  type        = string
  default     = "Standard"
  
  validation {
    condition     = contains(["Standard", "Premium"], var.storage_tier)
    error_message = "Le niveau de stockage doit être 'Standard' ou 'Premium'."
  }
}

variable "enable_versioning" {
  description = "Activer le versioning des blobs"
  type        = bool
  default     = true
}

variable "soft_delete_retention_days" {
  description = "Nombre de jours de rétention pour la suppression soft delete"
  type        = number
  default     = 7
  
  validation {
    condition     = var.soft_delete_retention_days >= 1 && var.soft_delete_retention_days <= 365
    error_message = "Les jours de rétention doivent être entre 1 et 365."
  }
}

# Variables de configuration AKS
variable "aks_node_count" {
  description = "Nombre de nœuds dans le pool par défaut d'AKS"
  type        = number
  default     = 2
  
  validation {
    condition     = var.aks_node_count >= 1 && var.aks_node_count <= 10
    error_message = "Le nombre de nœuds doit être entre 1 et 10."
  }
}

variable "aks_node_vm_size" {
  description = "Taille des VMs pour les nœuds AKS"
  type        = string
  default     = "Standard_D2s_v3"
  
  validation {
    condition = contains([
      "Standard_D2s_v3", "Standard_D4s_v3", "Standard_D8s_v3",
      "Standard_B2s", "Standard_B4ms", "Standard_B8ms",
      "Standard_F2s_v2", "Standard_F4s_v2", "Standard_F8s_v2"
    ], var.aks_node_vm_size)
    error_message = "Taille de VM non supportée. Utilisez une taille standard recommandée."
  }
}

variable "aks_node_disk_size" {
  description = "Taille du disque OS pour les nœuds AKS (en GB)"
  type        = number
  default     = 100
  
  validation {
    condition     = var.aks_node_disk_size >= 30 && var.aks_node_disk_size <= 1024
    error_message = "La taille du disque doit être entre 30 et 1024 GB."
  }
}

variable "enable_auto_scaling" {
  description = "Activer l'auto-scaling pour le cluster AKS"
  type        = bool
  default     = false
}

variable "min_node_count" {
  description = "Nombre minimum de nœuds (si auto-scaling activé)"
  type        = number
  default     = 1
  
  validation {
    condition     = var.min_node_count >= 1 && var.min_node_count <= var.max_node_count
    error_message = "Le nombre minimum de nœuds doit être >= 1 et <= au maximum."
  }
}

variable "max_node_count" {
  description = "Nombre maximum de nœuds (si auto-scaling activé)"
  type        = number
  default     = 5
  
  validation {
    condition     = var.max_node_count >= var.min_node_count && var.max_node_count <= 100
    error_message = "Le nombre maximum de nœuds doit être >= au minimum et <= 100."
  }
}

# Variables de configuration ACR
variable "acr_sku" {
  description = "SKU pour Azure Container Registry"
  type        = string
  default     = "Basic"
  
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.acr_sku)
    error_message = "Le SKU ACR doit être 'Basic', 'Standard' ou 'Premium'."
  }
}

variable "acr_admin_enabled" {
  description = "Activer l'authentification admin pour ACR"
  type        = bool
  default     = true
}

# Variables de configuration réseau
variable "vnet_address_space" {
  description = "Espace d'adressage pour le réseau virtuel"
  type        = list(string)
  default     = ["10.0.0.0/8"]
  
  validation {
    condition     = length(var.vnet_address_space) > 0
    error_message = "Au moins un espace d'adressage doit être spécifié."
  }
}

variable "aks_subnet_address_prefix" {
  description = "Préfixe d'adresse pour le sous-réseau AKS"
  type        = string
  default     = "10.240.0.0/16"
}

variable "aks_dns_service_ip" {
  description = "IP du service DNS pour AKS"
  type        = string
  default     = "10.1.0.10"
}

variable "aks_service_cidr" {
  description = "CIDR pour les services AKS"
  type        = string
  default     = "10.1.0.0/16"
}

# Variables de monitoring
variable "log_analytics_retention_days" {
  description = "Nombre de jours de rétention pour Log Analytics"
  type        = number
  default     = 30
  
  validation {
    condition     = var.log_analytics_retention_days >= 30 && var.log_analytics_retention_days <= 730
    error_message = "La rétention doit être entre 30 et 730 jours."
  }
}

variable "enable_application_insights" {
  description = "Activer Application Insights pour le monitoring"
  type        = bool
  default     = true
}

# Variables de sécurité
variable "enable_private_cluster" {
  description = "Créer un cluster AKS privé"
  type        = bool
  default     = false
}

variable "authorized_ip_ranges" {
  description = "Plages IP autorisées pour l'API server AKS (si cluster privé désactivé)"
  type        = list(string)
  default     = []
}

variable "enable_rbac" {
  description = "Activer RBAC pour le cluster AKS"
  type        = bool
  default     = true
}

# Variables de coût et optimisation
variable "spot_instances_enabled" {
  description = "Utiliser des instances spot pour réduire les coûts"
  type        = bool
  default     = false
}

variable "storage_lifecycle_management" {
  description = "Activer la gestion du cycle de vie du stockage"
  type        = bool
  default     = true
}

# Tags personnalisés
variable "additional_tags" {
  description = "Tags supplémentaires à appliquer à toutes les ressources"
  type        = map(string)
  default     = {}
}

# Variables optionnelles pour personnalisation avancée
variable "custom_dns_prefix" {
  description = "Préfixe DNS personnalisé pour AKS (optionnel)"
  type        = string
  default     = ""
}

variable "enable_azure_policy" {
  description = "Activer Azure Policy pour AKS"
  type        = bool
  default     = false
}

variable "enable_secrets_store_csi_driver" {
  description = "Activer le pilote CSI pour Azure Key Vault"
  type        = bool
  default     = false
}

# Variables pour le stockage des containers spécifiques
variable "additional_storage_containers" {
  description = "Containers de stockage supplémentaires à créer"
  type        = list(string)
  default     = []
}

# Configuration backup et disaster recovery
variable "enable_backup" {
  description = "Activer la sauvegarde pour les ressources critiques"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Nombre de jours de rétention pour les sauvegardes"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 9999
    error_message = "La rétention des sauvegardes doit être entre 7 et 9999 jours."
  }
} 