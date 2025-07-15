# EXAI - Plateforme d'expérimentation Explainable AI (XAI) avec pipeline ML

[![Statut du Projet](https://img.shields.io/badge/statut-Proof%20of%20Concept%20(PoC)-blue)](https://github.com/votre-organisation/2025-research-exai) <!-- Optionnel: Mettez à jour le lien si public -->

Ce projet académique est une plateforme de démonstration (Proof of Concept) visant à explorer l'intégration d'un pipeline de Machine Learning avec des capacités d'Intelligence Artificielle Explicable (XAI), le tout dans une architecture microservices.

**Objectifs principaux :**
1.  Faciliter la **sélection de datasets** selon des critères variés (techniques, éthiques, métier).
2.  Guider les utilisateurs, même **non-experts**, à travers un **pipeline ML complet**.
3.  **Recommander et appliquer des techniques XAI** adaptées au contexte.

---

## 📚 Documentation Principale (Antora)

**Toute la documentation technique et utilisateur détaillée se trouve dans notre documentation dédiée générée avec Antora.**

➡️ **Consultez la documentation en ligne ici :** [https://gwentey.github.io/2025-research-exai/](https://gwentey.github.io/2025-research-exai/)

Vous y trouverez :
- Le guide d'installation complet (Prérequis, Minikube, Docker, etc.)
- Les instructions de déploiement détaillées (Kubernetes, Docker Compose)
- Le guide utilisateur des fonctionnalités
- L'architecture technique
- Les informations pour contribuer au projet

---

## 🚀 Démarrage Ultra-Rapide

**Installation simplifiée avec Makefile intelligent** :

```bash
# 1. Cloner le projet
git clone <URL_DU_DEPOT>
cd 2025-research-exai

# 2. Créer le fichier .env (voir documentation)
cp .env.example .env  # Et modifier les valeurs

# 3. Installation complète en une commande
make dev
```

**🎯 C'est tout !** Le Makefile gère automatiquement :
- ✅ Vérification des prérequis
- ✅ Démarrage de Minikube
- ✅ Déploiement de tous les services
- ✅ Migrations de base de données automatiques
- ✅ Affichage des logs en temps réel

**Accès aux services :**
- Frontend : http://localhost:8080
- API : http://localhost:9000/docs

➡️ **Documentation complète :** [Guide de démarrage détaillé](https://gwentey.github.io/2025-research-exai/)

---

## Auteurs

- Projet EXAI - Master 2 MIAGE
