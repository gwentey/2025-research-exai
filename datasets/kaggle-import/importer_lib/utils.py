"""
Fonctions utilitaires pour le pipeline d'importation,
notamment pour la configuration des chemins Python.
"""
import sys
from pathlib import Path

def setup_paths():
    """
    Ajoute les chemins nécessaires au sys.path pour permettre les imports
    depuis n'importe quel point d'entrée.
    """
    # Chemin vers le répertoire 'importer_lib'
    importer_lib_dir = Path(__file__).parent.absolute()
    
    # Chemin vers la racine du projet ('2025-research-exai')
    project_root = importer_lib_dir.parent.parent.parent
    
    # Chemins des modules de service
    common_module_path = project_root / "common"
    service_selection_app_path = project_root / "service-selection" / "app"
    
    paths_to_add = [
        str(project_root),
        str(common_module_path),
        str(service_selection_app_path)
    ]
    
    for path in paths_to_add:
        if path not in sys.path:
            sys.path.insert(0, path)
