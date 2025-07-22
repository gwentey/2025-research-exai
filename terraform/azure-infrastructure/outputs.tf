# Outputs pour récupérer les informations importantes
output "resource_group_name" {
  description = "Nom du groupe de ressources"
  value       = azurerm_resource_group.main.name
}

output "storage_account_name" {
  description = "Nom du compte de stockage Azure"
  value       = azurerm_storage_account.ibis-x_storage.name
}

output "storage_account_primary_key" {
  description = "Clé primaire du compte de stockage"
  value       = azurerm_storage_account.ibis-x_storage.primary_access_key
  sensitive   = true
}

output "storage_connection_string" {
  description = "Chaîne de connexion du stockage"
  value       = azurerm_storage_account.ibis-x_storage.primary_connection_string
  sensitive   = true
}

output "storage_containers" {
  description = "Liste des containers créés"
  value = {
    datasets = azurerm_storage_container.ibis-x_datasets.name
    models   = azurerm_storage_container.ibis-x_models.name
    reports  = azurerm_storage_container.ibis-x_reports.name
  }
}

output "acr_name" {
  description = "Nom de l'Azure Container Registry"
  value       = azurerm_container_registry.ibis-x_acr.name
}

output "acr_login_server" {
  description = "URL du serveur de connexion ACR"
  value       = azurerm_container_registry.ibis-x_acr.login_server
}

output "acr_admin_username" {
  description = "Nom d'utilisateur admin ACR"
  value       = azurerm_container_registry.ibis-x_acr.admin_username
}

output "acr_admin_password" {
  description = "Mot de passe admin ACR"
  value       = azurerm_container_registry.ibis-x_acr.admin_password
  sensitive   = true
}

output "aks_cluster_name" {
  description = "Nom du cluster AKS"
  value       = azurerm_kubernetes_cluster.ibis-x_aks.name
}

output "aks_cluster_fqdn" {
  description = "FQDN du cluster AKS"
  value       = azurerm_kubernetes_cluster.ibis-x_aks.fqdn
}

output "aks_kube_config" {
  description = "Configuration kubectl pour AKS"
  value       = azurerm_kubernetes_cluster.ibis-x_aks.kube_config_raw
  sensitive   = true
}

output "aks_node_resource_group" {
  description = "Groupe de ressources des nœuds AKS"
  value       = azurerm_kubernetes_cluster.ibis-x_aks.node_resource_group
}

output "public_ip_address" {
  description = "Adresse IP publique pour l'ingress"
  value       = azurerm_public_ip.ibis-x_ingress_ip.ip_address
}

output "log_analytics_workspace_id" {
  description = "ID du workspace Log Analytics"
  value       = azurerm_log_analytics_workspace.ibis-x_logs.id
}

output "application_insights_instrumentation_key" {
  description = "Clé d'instrumentation Application Insights"
  value       = azurerm_application_insights.ibis-x_insights.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Chaîne de connexion Application Insights"
  value       = azurerm_application_insights.ibis-x_insights.connection_string
  sensitive   = true
}

# Outputs formatés pour faciliter l'utilisation
output "kubectl_config_command" {
  description = "Commande pour configurer kubectl"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.main.name} --name ${azurerm_kubernetes_cluster.ibis-x_aks.name}"
}

output "docker_login_command" {
  description = "Commande pour se connecter à ACR"
  value       = "az acr login --name ${azurerm_container_registry.ibis-x_acr.name}"
}

# Outputs pour les secrets Kubernetes
output "storage_secrets_base64" {
  description = "Secrets de stockage encodés en Base64 pour Kubernetes"
  value = {
    azure_storage_account_name = base64encode(azurerm_storage_account.ibis-x_storage.name)
    azure_storage_account_key  = base64encode(azurerm_storage_account.ibis-x_storage.primary_access_key)
    azure_container_name       = base64encode("ibis-x-datasets")
  }
  sensitive = true
}

# URLs complètes pour l'application
output "storage_blob_endpoint" {
  description = "Endpoint du service Blob Storage"
  value       = azurerm_storage_account.ibis-x_storage.primary_blob_endpoint
}

output "infrastructure_summary" {
  description = "Résumé de l'infrastructure créée"
  value = {
    resource_group      = azurerm_resource_group.main.name
    location           = azurerm_resource_group.main.location
    storage_account    = azurerm_storage_account.ibis-x_storage.name
    acr_registry       = azurerm_container_registry.ibis-x_acr.name
    aks_cluster        = azurerm_kubernetes_cluster.ibis-x_aks.name
    public_ip          = azurerm_public_ip.ibis-x_ingress_ip.ip_address
    containers_created = [
      azurerm_storage_container.ibis-x_datasets.name,
      azurerm_storage_container.ibis-x_models.name,
      azurerm_storage_container.ibis-x_reports.name
    ]
  }
} 
