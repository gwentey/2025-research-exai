-- Script d'initialisation pour la base de données PostgreSQL exai_db

-- Suppression de la table existante (si elle existe) pour garantir le bon schéma
DROP TABLE IF EXISTS datasets;

-- Création de la table datasets
CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,                      -- Identifiant unique auto-incrémenté
    name VARCHAR(255) NOT NULL,                 -- Nom du jeu de données
    description TEXT,                           -- Description détaillée
    file_path VARCHAR(512),                     -- Chemin vers le fichier de données
    file_type VARCHAR(50),                      -- Type de fichier (csv, json, etc.)
    row_count INTEGER,                          -- Nombre de lignes
    column_count INTEGER,                       -- Nombre de colonnes
    technical_metadata JSONB,                   -- Métadonnées techniques (format JSON)
    ethical_metadata JSONB,                     -- Métadonnées éthiques (format JSON)
    is_public BOOLEAN DEFAULT FALSE,            -- Le dataset est-il public ?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Date de création
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Date de dernière modification
    created_by VARCHAR(255),                    -- Qui a créé le dataset
    last_modified_by VARCHAR(255)               -- Qui a modifié en dernier
);

-- Vous pouvez ajouter d'autres commandes ici, par exemple pour insérer des données initiales:
-- INSERT INTO datasets (name, description, file_type) VALUES ('Mon premier dataset', 'Description initiale', 'csv'); 