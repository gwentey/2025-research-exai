# Configuration Terraform pour l'infrastructure Azure ibis-x
terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# Configuration du provider Azure
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Variables importées depuis variables.tf

# Génération de noms uniques
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  storage_name    = replace("${local.resource_prefix}stg${random_integer.storage_suffix.result}", "-", "")
  acr_name       = replace("${local.resource_prefix}acr${random_integer.acr_suffix.result}", "-", "")
}

# Génération de suffixes aléatoires pour les noms uniques
resource "random_integer" "storage_suffix" {
  min = 1000
  max = 9999
}

resource "random_integer" "acr_suffix" {
  min = 1000
  max = 9999
}

# Groupe de ressources principal
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Compte de stockage Azure pour les datasets
resource "azurerm_storage_account" "ibis-x_storage" {
  name                     = local.storage_name
  resource_group_name      = azurerm_resource_group.main.name
  location                = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  # Activation des fonctionnalités avancées
  https_traffic_only_enabled = true
  min_tls_version          = "TLS1_2"

  # Configuration des fonctionnalités blob
  blob_properties {
    versioning_enabled       = true
    change_feed_enabled      = true
    change_feed_retention_in_days = 7
    
    # Configuration des suppressions soft delete
    delete_retention_policy {
      days = 7
    }
    
    container_delete_retention_policy {
      days = 7
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "DatasetStorage"
    ManagedBy   = "Terraform"
  }
}

# Container pour les datasets ibis-x
resource "azurerm_storage_container" "ibis-x_datasets" {
  name                  = "ibis-x-datasets"
  storage_account_name  = azurerm_storage_account.ibis-x_storage.name
  container_access_type = "private"
}

# Container pour les modèles ML
resource "azurerm_storage_container" "ibis-x_models" {
  name                  = "ibis-x-models"
  storage_account_name  = azurerm_storage_account.ibis-x_storage.name
  container_access_type = "private"
}

# Container pour les rapports et résultats
resource "azurerm_storage_container" "ibis-x_reports" {
  name                  = "ibis-x-reports"
  storage_account_name  = azurerm_storage_account.ibis-x_storage.name
  container_access_type = "private"
}

# Azure Container Registry pour les images Docker
resource "azurerm_container_registry" "ibis-x_acr" {
  name                = local.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  sku                = "Basic"
  admin_enabled      = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "ContainerImages"
    ManagedBy   = "Terraform"
  }
}

# Azure Kubernetes Service (AKS)
resource "azurerm_kubernetes_cluster" "ibis-x_aks" {
  name                = "${local.resource_prefix}-aks"
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix         = "${local.resource_prefix}-aks"
  kubernetes_version = var.kubernetes_version

  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_D2s_v3"
    
    # Configuration du stockage
    os_disk_size_gb = 100
    os_disk_type    = "Managed"
    
    # Configuration réseau
    vnet_subnet_id = azurerm_subnet.aks_subnet.id
  }

  # Identité managée pour AKS
  identity {
    type = "SystemAssigned"
  }

  # Configuration réseau
  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    
    # Configuration DNS
    dns_service_ip     = "10.1.0.10"
    service_cidr       = "10.1.0.0/16"
  }

  # Configuration de monitoring
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.ibis-x_logs.id
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Réseau virtuel pour AKS
resource "azurerm_virtual_network" "ibis-x_vnet" {
  name                = "${local.resource_prefix}-vnet"
  address_space       = ["10.0.0.0/8"]
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Sous-réseau pour AKS
resource "azurerm_subnet" "aks_subnet" {
  name                 = "aks-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.ibis-x_vnet.name
  address_prefixes     = ["10.240.0.0/16"]
}

# Groupe de sécurité réseau pour AKS
resource "azurerm_network_security_group" "aks_nsg" {
  name                = "${local.resource_prefix}-aks-nsg"
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # Autoriser le trafic HTTP entrant
  security_rule {
    name                       = "AllowHTTP"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Autoriser le trafic HTTPS entrant
  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Autoriser le trafic SSH pour la gestion (optionnel)
  security_rule {
    name                       = "AllowSSH"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "NetworkSecurity"
    ManagedBy   = "Terraform"
  }
}

# Association du NSG au sous-réseau AKS
resource "azurerm_subnet_network_security_group_association" "aks_subnet_nsg" {
  subnet_id                 = azurerm_subnet.aks_subnet.id
  network_security_group_id = azurerm_network_security_group.aks_nsg.id
}

# Workspace Log Analytics pour monitoring
resource "azurerm_log_analytics_workspace" "ibis-x_logs" {
  name                = "${local.resource_prefix}-logs"
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                = "PerGB2018"
  retention_in_days  = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "Monitoring"
    ManagedBy   = "Terraform"
  }
}

# Attribution des rôles pour AKS et ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.ibis-x_acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.ibis-x_aks.kubelet_identity[0].object_id
}

# Attribution des rôles pour AKS et Storage
resource "azurerm_role_assignment" "aks_storage_contributor" {
  scope                = azurerm_storage_account.ibis-x_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_kubernetes_cluster.ibis-x_aks.identity[0].principal_id
}

# Application Insights pour le monitoring des applications
resource "azurerm_application_insights" "ibis-x_insights" {
  name                = "${local.resource_prefix}-insights"
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id       = azurerm_log_analytics_workspace.ibis-x_logs.id
  application_type   = "web"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "ApplicationMonitoring"
    ManagedBy   = "Terraform"
  }
}

# IP publique pour l'ingress controller
resource "azurerm_public_ip" "ibis-x_ingress_ip" {
  name                = "${local.resource_prefix}-ingress-ip"
  resource_group_name = azurerm_kubernetes_cluster.ibis-x_aks.node_resource_group
  location           = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                = "Standard"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "IngressController"
    ManagedBy   = "Terraform"
  }
} 
