# Déclarations globales des arguments pour les versions
ARG NODE_VERSION=20
ARG NGINX_VERSION=1.25

# --- Étape 1: Build ---
# Utiliser une image Node.js LTS (Long Term Support) comme base pour la construction
# La version est définie par l'ARG global
FROM node:${NODE_VERSION}-alpine as build

# Argument pour définir l'environnement de build Angular (dev par défaut)
ARG ANGULAR_ENV=development

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier les fichiers de dépendances
# Copier package.json ET package-lock.json (ou yarn.lock si utilisé)
COPY package.json package-lock.json* ./

# Installer les dépendances du projet
# Utiliser --legacy-peer-deps si nécessaire pour résoudre des conflits de dépendances fréquents avec les templates
RUN npm install --legacy-peer-deps

# Copier tous les fichiers du projet dans le conteneur
COPY . .

# Construire l'application Angular en utilisant l'argument ANGULAR_ENV
# La valeur par défaut 'development' sera utilisée si l'ARG n'est pas fourni au moment du build
RUN npm run build -- --configuration ${ANGULAR_ENV}

# --- Étape 2: Serve ---
# Utiliser une image Nginx légère pour servir les fichiers statiques
# La version est définie par l'ARG global
# Plus besoin de déclarer ARG NGINX_VERSION ici
FROM nginx:${NGINX_VERSION}-alpine

# Supprimer la configuration Nginx par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier notre propre configuration Nginx (doit exister dans le dossier frontend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés de l'application Angular depuis l'étape de build
# Le chemin source /app/dist/Spike doit correspondre à l'outputPath dans angular.json
COPY --from=build /app/dist/Spike /usr/share/nginx/html

# Exposer le port 80 pour Nginx
EXPOSE 80

# Commande par défaut pour démarrer Nginx
CMD ["nginx", "-g", "daemon off;"] 