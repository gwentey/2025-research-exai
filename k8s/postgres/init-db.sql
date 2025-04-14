-- Script d'initialisation pour la base de données PostgreSQL exai_db

-- Création de la table datasets
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,          -- Identifiant unique auto-incrémenté
    name VARCHAR(255) NOT NULL,     -- Nom du jeu de données
    description TEXT,               -- Description détaillée
    file_path VARCHAR(512),         -- Chemin vers le fichier de données (si applicable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Date de création
);

-- Vous pouvez ajouter d'autres commandes ici, par exemple pour insérer des données initiales:
-- INSERT INTO datasets (name, description) VALUES ('Mon premier dataset', 'Description initiale'); 