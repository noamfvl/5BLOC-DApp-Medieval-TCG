// Configuration
const CONTRACT_ADDRESS = "0xFA920C0835e36B15Dcd95045B250703c661cC5EC";

// ABI du contrat (fonctions principales)
const CONTRACT_ABI = [
    // Events
    "event UserRegistered(address indexed user)",
    "event CardMinted(uint64 indexed id, address indexed to)",
    "event TradeProposed(uint64 indexed id, address indexed from, address indexed to)",
    "event TradeFinalized(uint64 indexed id, uint8 status)",

    // Constantes
    "function MAX_CARDS() view returns (uint8)",
    "function COOLDOWN() view returns (uint40)",
    "function LOCK_TIME() view returns (uint40)",

    // Fonctions de lecture
    "function users(address) view returns (uint40 lastTxAt, uint40 lockUntil, uint32 tradesCompleted, bool isRegistered, string username)",
    "function getCard(uint64 _id) view returns (tuple(uint64 cardId, uint16 attack, uint16 defense, uint8 cardType, uint8 rarity, uint40 createdAt, uint40 lastTransferAt, uint40 lockedUntil, bool isTradeable, string name, string ipfsHash))",
    "function getUserCards(address _user) view returns (uint64[])",
    "function getTrade(uint64 _id) view returns (tuple(address proposer, address receiver, uint64[] proposerCards, uint64[] receiverCards, uint8 status, uint40 expiresAt))",
    "function getCardValue(uint64 _id) view returns (uint256)",
    "function canTransactNow(address _user) view returns (bool, string)",
    "function owner() view returns (address)",

    // Fonctions d'ecriture
    "function registerUser(string _name)",
    "function mintCard(address _to, string _name, uint8 _type, uint8 _rarity, string _ipfs)",
    "function proposeTrade(address _to, uint64[] _myCards, uint64[] _theirCards)",
    "function acceptTrade(uint64 _id)",
    "function rejectTrade(uint64 _id)",
    "function cancelTrade(uint64 _id)"
];

// Types et raretés
const CARD_TYPES = ["Knight", "Mage", "Archer", "Castle", "Dragon", "Spell"];
const RARITIES = ["Common", "Uncommon", "Rare", "Epic"];
const RARITY_CLASSES = ["common", "uncommon", "rare", "epic"];

// Gateway IPFS pour afficher les images
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Convertir ipfs:// en URL HTTP
function ipfsToHttp(ipfsUrl) {
    if (!ipfsUrl || ipfsUrl === "ipfs://") return null;
    if (ipfsUrl.startsWith("ipfs://")) {
        return IPFS_GATEWAY + ipfsUrl.replace("ipfs://", "");
    }
    if (ipfsUrl.startsWith("Qm") || ipfsUrl.startsWith("bafy")) {
        return IPFS_GATEWAY + ipfsUrl;
    }
    return ipfsUrl;
}

// Variables globales
let provider;
let signer;
let contract;
let currentAccount;
let isOwner = false;

// Elements DOM
const connectBtn = document.getElementById("connect-btn");
const walletInfo = document.getElementById("wallet-info");
const walletAddress = document.getElementById("wallet-address");
const userStatus = document.getElementById("user-status");

const registerSection = document.getElementById("register-section");
const userSection = document.getElementById("user-section");
const cardsSection = document.getElementById("cards-section");
const adminSection = document.getElementById("admin-section");
const tradeSection = document.getElementById("trade-section");
const pendingTradesSection = document.getElementById("pending-trades-section");

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
    connectBtn.addEventListener("click", connectWallet);
    document.getElementById("register-btn").addEventListener("click", registerUser);
    document.getElementById("mint-btn").addEventListener("click", mintCard);
    document.getElementById("propose-trade-btn").addEventListener("click", proposeTrade);

    // Verifier si MetaMask est deja connecté
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", () => window.location.reload());
    }
});

// Connexion au wallet
async function connectWallet() {
    if (!window.ethereum) {
        showNotification("MetaMask n'est pas installe!", "error");
        return;
    }

    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);

        if (accounts.length === 0) {
            showNotification("Aucun compte connecte", "error");
            return;
        }

        signer = await provider.getSigner();
        currentAccount = await signer.getAddress();

        // Verifier l'adresse du contrat
        if (CONTRACT_ADDRESS === "VOTRE_ADRESSE_CONTRAT_ICI") {
            showNotification("Configurez l'adresse du contrat dans app.js!", "error");
            return;
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Verifier si c'est le owner
        const ownerAddress = await contract.owner();
        isOwner = ownerAddress.toLowerCase() === currentAccount.toLowerCase();

        // Mettre a jour l'UI
        connectBtn.classList.add("hidden");
        walletInfo.classList.remove("hidden");
        walletAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;

        await checkUserStatus();
        showNotification("Wallet connecte!", "success");

    } catch (error) {
        console.error(error);
        showNotification("Erreur de connexion: " + error.message, "error");
    }
}

// Verifier le statut de l'utilisateur
async function checkUserStatus() {
    try {
        const user = await contract.users(currentAccount);

        if (user.isRegistered) {
            userStatus.textContent = "Inscrit";
            registerSection.classList.add("hidden");
            userSection.classList.remove("hidden");
            cardsSection.classList.remove("hidden");
            tradeSection.classList.remove("hidden");
            pendingTradesSection.classList.remove("hidden");

            document.getElementById("display-username").textContent = user.username;
            document.getElementById("trades-count").textContent = user.tradesCompleted.toString();

            // Verifier cooldown/lock
            const [canTransact, status] = await contract.canTransactNow(currentAccount);
            document.getElementById("transaction-status").textContent = canTransact ? "Pret" : status;
            document.getElementById("transaction-status").style.color = canTransact ? "#2ecc71" : "#e74c3c";

            await loadUserCards();
            await loadPendingTrades();

        } else {
            userStatus.textContent = "Non inscrit";
            registerSection.classList.remove("hidden");
            userSection.classList.add("hidden");
            cardsSection.classList.add("hidden");
            tradeSection.classList.add("hidden");
            pendingTradesSection.classList.add("hidden");
        }

        // Afficher section admin si owner
        if (isOwner) {
            adminSection.classList.remove("hidden");
        }

    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + error.message, "error");
    }
}

// Inscription
async function registerUser() {
    const username = document.getElementById("username").value.trim();

    if (!username || username.length > 20) {
        showNotification("Pseudo invalide (1-20 caracteres)", "error");
        return;
    }

    try {
        showNotification("Transaction en cours...", "success");
        const tx = await contract.registerUser(username);
        await tx.wait();
        showNotification("Inscription reussie!", "success");
        await checkUserStatus();
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

// Charger les cartes de l'utilisateur
async function loadUserCards() {
    try {
        const cardIds = await contract.getUserCards(currentAccount);
        document.getElementById("cards-count").textContent = cardIds.length;

        const cardsGrid = document.getElementById("cards-grid");
        cardsGrid.innerHTML = "";

        for (const cardId of cardIds) {
            const card = await contract.getCard(cardId);
            const value = await contract.getCardValue(cardId);
            cardsGrid.appendChild(createCardElement(card, value));
        }

    } catch (error) {
        console.error(error);
    }
}

// Creer un element carte
function createCardElement(card, value) {
    const rarityClass = RARITY_CLASSES[card.rarity];
    const imageUrl = ipfsToHttp(card.ipfsHash);
    const div = document.createElement("div");
    div.className = `game-card ${rarityClass}`;
    div.style.cursor = "pointer";
    div.innerHTML = `
        <div class="card-header">
            <span class="card-name">${card.name}</span>
            <span class="card-id">#${card.cardId}</span>
        </div>
        ${imageUrl ? `<div class="card-image"><img src="${imageUrl}" alt="${card.name}" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>${CARD_TYPES[card.cardType]}</div>'"></div>` : `<div class="card-image"><div class="no-image">${CARD_TYPES[card.cardType]}</div></div>`}
        <div class="card-type">${CARD_TYPES[card.cardType]}</div>
        <div class="card-stats">
            <div class="stat">
                <div class="stat-value" style="color: #e74c3c;">${card.attack}</div>
                <div class="stat-label">Attaque</div>
            </div>
            <div class="stat">
                <div class="stat-value" style="color: #3498db;">${card.defense}</div>
                <div class="stat-label">Defense</div>
            </div>
        </div>
        <div class="card-rarity rarity-${rarityClass}">${RARITIES[card.rarity]}</div>
        <div class="card-value">${value} pts</div>
    `;

    // Ajouter le click pour ouvrir le modal
    div.addEventListener("click", () => openCardModal(card, value, imageUrl));

    return div;
}

// Ouvrir le modal avec les details de la carte
function openCardModal(card, value, imageUrl) {
    const modal = document.getElementById("card-modal");
    const modalImage = document.getElementById("modal-image");

    // Remplir les informations
    document.getElementById("modal-name").textContent = card.name + " #" + card.cardId;
    document.getElementById("modal-type").textContent = CARD_TYPES[card.cardType];
    document.getElementById("modal-attack").textContent = card.attack;
    document.getElementById("modal-defense").textContent = card.defense;
    document.getElementById("modal-value").textContent = value + " pts";
    document.getElementById("modal-ipfs").textContent = card.ipfsHash || "Pas d'IPFS";

    // Rareté avec style
    const rarityEl = document.getElementById("modal-rarity");
    rarityEl.textContent = RARITIES[card.rarity];
    rarityEl.className = `rarity-${RARITY_CLASSES[card.rarity]}`;

    // Image
    if (imageUrl) {
        modalImage.src = imageUrl;
        modalImage.style.display = "block";
        modalImage.onerror = () => {
            modalImage.style.display = "none";
        };
    } else {
        modalImage.style.display = "none";
    }

    // Afficher le modal
    modal.classList.remove("hidden");
}

// Fermer le modal
function closeModal() {
    document.getElementById("card-modal").classList.add("hidden");
}

// Fermer le modal en cliquant en dehors
document.addEventListener("click", (e) => {
    const modal = document.getElementById("card-modal");
    if (e.target === modal) {
        closeModal();
    }
});

// Fermer avec Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModal();
    }
});

// Minter une carte (admin)
async function mintCard() {
    const to = document.getElementById("mint-to").value.trim();
    const name = document.getElementById("mint-name").value.trim();
    const type = parseInt(document.getElementById("mint-type").value);
    const rarity = parseInt(document.getElementById("mint-rarity").value);
    const ipfs = document.getElementById("mint-ipfs").value.trim() || "ipfs://";

    if (!to || !name) {
        showNotification("Remplissez tous les champs", "error");
        return;
    }

    try {
        showNotification("Mint en cours...", "success");
        const tx = await contract.mintCard(to, name, type, rarity, ipfs);
        await tx.wait();
        showNotification("Carte mintee!", "success");

        // Recharger si c'est pour nous
        if (to.toLowerCase() === currentAccount.toLowerCase()) {
            await loadUserCards();
        }
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

// Proposer un echange
async function proposeTrade() {
    const to = document.getElementById("trade-to").value.trim();
    const myCardsStr = document.getElementById("trade-my-cards").value.trim();
    const theirCardsStr = document.getElementById("trade-their-cards").value.trim();

    if (!to) {
        showNotification("Entrez l'adresse du destinataire", "error");
        return;
    }

    const myCards = myCardsStr ? myCardsStr.split(",").map(s => parseInt(s.trim())) : [];
    const theirCards = theirCardsStr ? theirCardsStr.split(",").map(s => parseInt(s.trim())) : [];

    if (myCards.length === 0 && theirCards.length === 0) {
        showNotification("Selectionnez au moins une carte", "error");
        return;
    }

    try {
        showNotification("Proposition en cours...", "success");
        const tx = await contract.proposeTrade(to, myCards, theirCards);
        await tx.wait();
        showNotification("Echange propose!", "success");
        await checkUserStatus();
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

// Charger les echanges en attente
async function loadPendingTrades() {
    const tradesList = document.getElementById("pending-trades-list");
    tradesList.innerHTML = "<p style='color: #888;'>Chargement...</p>";

    try {
        let foundTrades = [];

        // Parcourir les trades recents (simplification)
        for (let i = 1; i <= 50; i++) {
            try {
                const trade = await contract.getTrade(i);

                // Verifier si le trade existe (proposer != address(0))
                if (trade.proposer === "0x0000000000000000000000000000000000000000") {
                    continue;
                }

                // Verifier si le trade nous concerne et est pending (status = 0)
                if (Number(trade.status) === 0 &&
                    (trade.proposer.toLowerCase() === currentAccount.toLowerCase() ||
                     trade.receiver.toLowerCase() === currentAccount.toLowerCase())) {

                    foundTrades.push({ id: i, trade: trade });
                }
            } catch (e) {
                // Trade n'existe pas, continuer
                continue;
            }
        }

        tradesList.innerHTML = "";

        if (foundTrades.length === 0) {
            tradesList.innerHTML = "<p style='color: #888;'>Aucun echange en attente</p>";
        } else {
            for (const item of foundTrades) {
                tradesList.appendChild(createTradeElement(item.id, item.trade));
            }
        }

    } catch (error) {
        console.error(error);
        tradesList.innerHTML = "<p style='color: #e74c3c;'>Erreur de chargement</p>";
    }
}

// Creer un element trade
function createTradeElement(tradeId, trade) {
    const isProposer = trade.proposer.toLowerCase() === currentAccount.toLowerCase();
    const otherAddress = isProposer ? trade.receiver : trade.proposer;
    const shortOther = `${otherAddress.slice(0, 6)}...${otherAddress.slice(-4)}`;

    const div = document.createElement("div");
    div.className = "trade-item";
    div.innerHTML = `
        <div class="trade-header">
            <strong>Echange #${tradeId}</strong>
            <span class="trade-status ${isProposer ? 'sent' : 'received'}">${isProposer ? "Envoye" : "Recu"}</span>
        </div>
        <p class="trade-with">${isProposer ? "Vers" : "De"}: <code>${shortOther}</code></p>
        <div class="trade-cards">
            <div class="trade-side">
                <h4>${isProposer ? "Vous offrez" : "Il offre"}</h4>
                <p>Cartes: ${trade.proposerCards.length > 0 ? trade.proposerCards.map(c => "#" + c).join(", ") : "Aucune"}</p>
            </div>
            <div class="trade-side">
                <h4>${isProposer ? "Vous demandez" : "Il demande"}</h4>
                <p>Cartes: ${trade.receiverCards.length > 0 ? trade.receiverCards.map(c => "#" + c).join(", ") : "Aucune"}</p>
            </div>
        </div>
        <div class="trade-actions">
            ${isProposer
                ? `<button class="btn btn-danger" onclick="cancelTrade(${tradeId})">Annuler</button>`
                : `<button class="btn btn-success" onclick="acceptTrade(${tradeId})">Accepter</button>
                   <button class="btn btn-danger" onclick="rejectTrade(${tradeId})">Refuser</button>`
            }
        </div>
    `;
    return div;
}

// Actions sur les trades
async function acceptTrade(tradeId) {
    try {
        showNotification("Acceptation en cours...", "success");
        const tx = await contract.acceptTrade(tradeId);
        await tx.wait();
        showNotification("Echange accepte!", "success");
        await checkUserStatus();
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

async function rejectTrade(tradeId) {
    try {
        showNotification("Refus en cours...", "success");
        const tx = await contract.rejectTrade(tradeId);
        await tx.wait();
        showNotification("Echange refuse!", "success");
        await loadPendingTrades();
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

async function cancelTrade(tradeId) {
    try {
        showNotification("Annulation en cours...", "success");
        const tx = await contract.cancelTrade(tradeId);
        await tx.wait();
        showNotification("Echange annule!", "success");
        await loadPendingTrades();
    } catch (error) {
        console.error(error);
        showNotification("Erreur: " + (error.reason || error.message), "error");
    }
}

// Gestion du changement de compte
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        window.location.reload();
    } else if (accounts[0].toLowerCase() !== currentAccount.toLowerCase()) {
        console.log("Changement de compte detecte:", accounts[0]);
        currentAccount = accounts[0];
        // Mettre a jour l'affichage de l'adresse
        walletAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        // Recharger les donnees
        checkUserStatus();
        showNotification("Compte change!", "success");
    }
}

// Notification
function showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove("hidden");

    setTimeout(() => {
        notification.classList.add("hidden");
    }, 4000);
}
