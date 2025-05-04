/**
 * Interface pour les données envoyées lors de la connexion.
 */
export interface LoginCredentials {
  email: string;      // Ou username si votre API l'attend
  password: string;
}

/**
 * Interface pour la réponse attendue de l'endpoint de connexion.
 */
export interface LoginResponse {
  access_token: string;
  token_type: string; // Généralement 'bearer'
}

/**
 * Interface pour un compte OAuth (comme Google)
 */
export interface OAuthAccount {
  id: string;
  oauth_name: string;
  account_id: string;
  account_email: string;
}

/**
 * Interface représentant les données d'inscription d'un utilisateur.
 * TOUS les champs sont requis par l'API même s'ils sont null.
 */
export interface SignupData {
  email: string;
  password: string;
  pseudo: string | null;
  picture: string | null;
  given_name: string | null;
  family_name: string | null;
  locale: string | null;
}

/**
 * Interface pour représenter un utilisateur lu depuis l'API.
 * (Aligné avec le schéma UserRead de FastAPI)
 */
export interface UserRead {
  id: string; // UUID est une chaîne de caractères en TS/JS
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  pseudo?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  oauth_accounts?: OAuthAccount[];
}

/**
 * Interface pour la réponse de l'autorisation OAuth
 */
export interface OAuthAuthorizationResponse {
  authorization_url: string;
} 