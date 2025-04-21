export const environment = {
  production: false,
  // Revenir à localhost car Skaffold devrait gérer le port-forwarding
  // Utiliser le port local configuré dans skaffold.yaml
  apiUrl: 'http://localhost:9000'
}; 