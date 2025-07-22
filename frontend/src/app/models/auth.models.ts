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
  education_level: string | null;
  age: number | null;
  ai_familiarity: number | null;
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
  education_level?: string;
  age?: number;
  ai_familiarity?: number;
}

/**
 * Interface pour la réponse de l'autorisation OAuth
 */
export interface OAuthAuthorizationResponse {
  authorization_url: string;
}

/**
 * Interface pour les données de mise à jour du profil utilisateur.
 * Seuls les champs modifiables sont inclus.
 */
export interface UserUpdate {
  pseudo?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  locale?: string | null;
  education_level?: string | null;
  age?: number | null;
  ai_familiarity?: number | null;
}

/**
 * Interface pour la mise à jour du mot de passe.
 */
export interface PasswordUpdate {
  current_password: string;
  new_password: string;
}

/**
 * Interface pour l'upload d'image de profil.
 */
export interface ProfilePictureUpload {
  picture: string; // Base64 ou URL de l'image
}

/**
 * Interface pour les données d'onboarding.
 */
export interface OnboardingData {
  education_level: string;
  age: number;
  ai_familiarity: number;
}

/**
 * Interface pour la suppression de compte.
 */
export interface AccountDeletionRequest {
  email_confirmation: string; // Email pour confirmer la suppression (insensible à la casse)
}

/**
 * Interface pour la réponse de suppression de compte.
 */
export interface AccountDeletionResponse {
  message: string;
  success: boolean;
}

/**
 * Énumération pour les niveaux d'éducation.
 */
export enum EducationLevel {
  NO_FORMAL = 'no_formal',
  HIGH_SCHOOL = 'high_school',
  BACHELOR = 'bachelor',
  MASTER = 'master',
  PHD = 'phd',
  OTHER = 'other'
} 
