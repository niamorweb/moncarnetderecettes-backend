# 🍳 Mon Carnet de Recettes — API Backend (NestJS)

> **Cœur transactionnel et moteur de génération de documents pour la plateforme Mon Carnet de Recettes.**

Cette API fournit une architecture robuste et sécurisée pour la gestion de recettes, l'orchestration de médias et la génération dynamique de fichiers PDF. Conçue avec une approche modulaire, elle garantit une séparation claire des responsabilités et un typage strict de bout en bout.

🔗 **Lien vers le Frontend (Nuxt 3) :** [https://github.com/niamorweb/moncarnetderecettes-backend](https://github.com/niamorweb/moncarnetderecettes-backend)

---

## 🏗 Architecture & Design Patterns

Le backend est structuré autour du framework **NestJS**, privilégiant la maintenabilité et la scalabilité :

- **Architecture Modulaire :** Organisation par domaines fonctionnels (`Auth`, `Recipes`, `Categories`, `PDF`).
- **Data Access Layer :** Utilisation de **Prisma ORM** pour un accès typé à la base de données **PostgreSQL**.
- **Validation & DTOs :** Sécurisation des entrées via `class-validator` et `Mapped Types` pour garantir l'intégrité des données reçues.
- **Dependency Injection :** Utilisation intensive des providers pour faciliter les tests et le découplage du code.

## 🛠 Stack Technique

- **Framework :** [NestJS](https://nestjs.com/) (Node.js)
- **Langage :** TypeScript (Mode strict)
- **Base de données :** PostgreSQL
- **ORM :** [Prisma](https://www.prisma.io/)
- **Authentification :** Passport.js & JWT Strategy
- **Gestion de Médias :** Cloudinary SDK (Upload & Optimisation)
- **Infrastructure :** Déploiement sur **Railway** avec gestion des variables d'environnement.

---

## 🔒 Sécurité & Authentification

- **JWT Auth :** Système d'authentification sans état (stateless) avec extraction sécurisée via les headers.
- **Auth Guards :** Protection granulaire des routes pour assurer que chaque utilisateur n'accède qu'à ses propres données (User Isolation).
- **Password Hashing :** Utilisation de `bcrypt` pour le hachage sécurisé des identifiants.
- **CORS Configuration :** Restrictions d'accès limitées au domaine du frontend.

---

## ✨ Fonctionnalités Backend

- **CRUD Avancé :** Gestion complexe des recettes incluant les relations avec les catégories et les images.
- **Moteur de Génération PDF :** Algorithme de mise en page pour transformer les données JSON en documents PDF prêts à l'impression.
- **Upload de Médias :** Intégration transparente avec Cloudinary pour le stockage des photos de recettes.
- **Bulk Operations :** Endpoints optimisés pour le déplacement ou la suppression groupée de recettes (Bulk Move/Delete).
- **Logging & Error Handling :** Gestion centralisée des exceptions via les filtres NestJS.

---

## 📂 Structure du projet

```text
src/
├── auth/           # Stratégies JWT, Login, Inscription
├── recipes/        # Logique métier des recettes (Services, Controllers)
├── categories/     # Gestion de l'organisation thématique
├── stripe/         # Gestion des paiements et webhooks
├── cloudinary/     # Setup et config du service de médias
├── profiles/       # Gestion des données utilisateurs (Table Profiles)
├── guards/         # Protections avancées des routes API
├── resend/         # Intégration du service d'envoi d'emails
├── prisma/         # Schéma de base de données et migrations
└── main.ts         # Point d'entrée de l'application
```
