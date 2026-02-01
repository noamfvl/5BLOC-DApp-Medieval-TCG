# Medieval TCG - Guide Utilisateur

## Presentation

Medieval TCG est un jeu de cartes a collectionner decentralise sur la blockchain Ethereum. Collectionnez des cartes medievales (chevaliers, mages, dragons...) et echangez-les avec d'autres joueurs.

## Demarrage

### 1. Installer MetaMask

1. Telecharger l'extension MetaMask sur https://metamask.io
2. Creer un portefeuille ou importer un existant
3. Passer sur le reseau de test Sepolia :
   - Cliquer sur le selecteur de reseau en haut
   - Activer "Afficher les reseaux de test" dans les parametres
   - Selectionner "Sepolia"

### 2. Obtenir des ETH de test

1. Aller sur https://sepoliafaucet.com
2. Entrer votre adresse MetaMask
3. Recevoir des ETH gratuits pour les tests

### 3. Se connecter a l'application

1. Ouvrir l'application dans votre navigateur
2. Cliquer sur "Connecter MetaMask"
3. Approuver la connexion dans MetaMask

## Inscription

Avant de jouer, vous devez vous inscrire :

1. Entrer un pseudo (20 caracteres maximum)
2. Cliquer sur "S'inscrire"
3. Confirmer la transaction dans MetaMask

## Les Cartes

### Types de cartes

| Type | Description |
|------|-------------|
| Knight | Chevalier - combattant de melee |
| Mage | Mage - lanceur de sorts |
| Archer | Archer - attaque a distance |
| Castle | Chateau - structure defensive |
| Dragon | Dragon - creature legendaire (Epic uniquement) |
| Spell | Sort - carte magique |

### Raretes

| Rarete | Points de base | Multiplicateur |
|--------|----------------|----------------|
| Common | 100 pts | x1.0 |
| Uncommon | 250 pts | x1.2 |
| Rare | 500 pts | x1.5 |
| Epic | 1000 pts | x2.0 |

### Limite de possession

Chaque joueur peut posseder un maximum de 4 cartes.

## Echanges

### Proposer un echange

1. Aller dans la section "Proposer un Echange"
2. Entrer l'adresse du destinataire
3. Indiquer les IDs de vos cartes a offrir (ex: 1,2)
4. Indiquer les IDs des cartes demandees (ex: 3)
5. Cliquer sur "Proposer"
6. Confirmer dans MetaMask

### Repondre a un echange

Dans la section "Echanges en Attente", vous pouvez :
- Accepter un echange propose
- Refuser un echange
- Annuler un echange que vous avez propose

### Regles d'echange

- Le ratio de valeur doit etre entre 50% et 200% pour etre accepte
- Un delai de 5 minutes (cooldown) est requis entre deux transactions
- Apres un echange accepte, votre compte est verrouille pendant 10 minutes

## Consulter une carte

Cliquez sur une carte pour afficher ses details :
- Nom et type
- Attaque et defense
- Rarete et valeur
- Lien IPFS des metadonnees

## Messages d'erreur courants

| Message | Signification |
|---------|---------------|
| "Cooldown de 5 minutes actif" | Attendez 5 minutes avant la prochaine transaction |
| "Compte verrouille pendant 10 minutes" | Attendez apres un echange accepte |
| "Limite de 4 cartes atteinte" | Vous avez deja 4 cartes |
| "Echange non equitable" | Le ratio de valeur n'est pas entre 50% et 200% |
