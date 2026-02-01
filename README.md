# Medieval TCG - DApp Ethereum

Jeu de cartes a collectionner decentralise sur Ethereum avec theme medieval.

## Prerequis

- Node.js (v18+)
- MetaMask avec le reseau Sepolia configure
- ETH de test Sepolia (via https://sepoliafaucet.com)

## Installation

```bash
cd medieval-tcg-eth
npm install
```

## Deploiement du contrat

Pour deployer le contrat, nous recommandons l'utilisation de Remix IDE (https://remix.ethereum.org) qui permet de compiler et deployer facilement sur Sepolia via MetaMask.

## Utilisation avec Hardhat

Compiler les contrats :
```bash
npm run compile
```

Lancer les tests :
```bash
npm run test
```

Demarrer un noeud local :
```bash
npm run node
```

Deployer localement :
```bash
npm run deploy:local
```

## Frontend

Le frontend se trouve dans le dossier `frontend/`. Pour l'utiliser :

1. Deployer le contrat (via Remix ou Hardhat)
2. Copier l'adresse du contrat deploye dans `frontend/app.js` (variable `CONTRACT_ADDRESS`)
3. Lancer le serveur local :
```bash
npx serve frontend
```
4. Ouvrir l'URL affichee dans un navigateur
5. Connecter MetaMask

### Fonctionnalites du frontend

- Connexion wallet MetaMask
- Inscription utilisateur
- Affichage des cartes possedees
- Mint de cartes (admin uniquement)
- Proposition et gestion des echanges
- Modal de detail des cartes

## Structure du projet

```
medieval-tcg-eth/
  contracts/        Smart contracts Solidity
  test/             Tests unitaires Hardhat
  scripts/          Scripts de deploiement
  frontend/         Interface web
  hardhat.config.js Configuration Hardhat
```

## Contraintes implementees

| Contrainte | Valeur |
|------------|--------|
| Max cartes par utilisateur | 4 |
| Cooldown entre transactions | 5 minutes |
| Lock apres echange | 10 minutes |
| Ratio d'equite | 50% - 200% |
| Dragons | Epic uniquement |

## Types de cartes

- 0 = Knight (Chevalier)
- 1 = Mage
- 2 = Archer
- 3 = Castle (Chateau)
- 4 = Dragon (Epic seulement)
- 5 = Spell (Sort)

## Raretes

- 0 = Common (100 pts)
- 1 = Uncommon (250 pts)
- 2 = Rare (500 pts)
- 3 = Epic (1000 pts)

## Tests unitaires

Les tests couvrent :
- Enregistrement utilisateur et validation du nom
- Mint de cartes et calcul des stats
- Limite de 4 cartes par utilisateur
- Dragons restreints a la rarete Epic
- Proposition, acceptation, refus et annulation d'echanges
- Cooldown de 5 minutes
- Lock critique de 10 minutes
- Validation d'equite des echanges

## Metadonnees IPFS

```json
{
  "name": "Nom de la carte",
  "type": "Knight",
  "rarity": "Common",
  "value": 100,
  "attributes": {
    "attack": 50,
    "defense": 50
  },
  "image": "ipfs://QmImageHash",
  "previousOwners": [],
  "createdAt": "2025-01-30T00:00:00Z",
  "lastTransferAt": "2025-01-30T00:00:00Z"
}
```
