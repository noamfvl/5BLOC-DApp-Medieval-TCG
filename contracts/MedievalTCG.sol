// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MedievalTCG
 * @dev TCG decentralise sur Ethereum
 */
contract MedievalTCG is ERC721, ERC721URIStorage, Ownable {

    // Enums
    enum CardType { Knight, Mage, Archer, Castle, Dragon, Spell }
    enum Rarity { Common, Uncommon, Rare, Epic }
    enum TradeStatus { Pending, Accepted, Rejected, Cancelled }

    // Structs compactes
    struct Card {
        uint64 cardId;
        uint16 attack;
        uint16 defense;
        CardType cardType;
        Rarity rarity;
        uint40 createdAt;
        uint40 lastTransferAt;
        uint40 lockedUntil;
        bool isTradeable;
        string name;
        string ipfsHash;
    }

    struct User {
        uint40 lastTxAt;
        uint40 lockUntil;
        uint32 tradesCompleted;
        bool isRegistered;
        string username;
    }

    struct Trade {
        address proposer;
        address receiver;
        uint64[] proposerCards;
        uint64[] receiverCards;
        TradeStatus status;
        uint40 expiresAt;
    }

    // Constantes
    uint8 public constant MAX_CARDS = 4;
    uint40 public constant COOLDOWN = 5 minutes;
    uint40 public constant LOCK_TIME = 10 minutes;
    uint40 public constant TRADE_EXPIRY = 24 hours;

    // Variables
    uint64 private _cardId = 1;
    uint64 private _tradeId = 1;
    bool public paused;

    mapping(uint64 => Card) public cards;
    mapping(address => User) public users;
    mapping(uint64 => Trade) public trades;
    mapping(address => uint64[]) public userCards;
    mapping(uint64 => address[]) public cardHistory;

    // Events
    event UserRegistered(address indexed user);
    event CardMinted(uint64 indexed id, address indexed to);
    event TradeProposed(uint64 indexed id, address indexed from, address indexed to);
    event TradeFinalized(uint64 indexed id, TradeStatus status);

    constructor() ERC721("Medieval TCG", "MTCG") Ownable(msg.sender) {}

    // Modifiers
    modifier notPaused() { require(!paused, "Paused"); _; }
    modifier registered() { require(users[msg.sender].isRegistered, "Not registered"); _; }
    modifier canTransact() {
        require(block.timestamp >= users[msg.sender].lastTxAt + COOLDOWN, "Cooldown");
        require(block.timestamp >= users[msg.sender].lockUntil, "Locked");
        _;
    }

    // === FONCTIONS PRINCIPALES ===

    function registerUser(string calldata _name) external notPaused {
        require(!users[msg.sender].isRegistered, "Exists");
        require(bytes(_name).length > 0 && bytes(_name).length <= 20, "Name");
        users[msg.sender] = User(0, 0, 0, true, _name);
        emit UserRegistered(msg.sender);
    }

    function mintCard(
        address _to,
        string calldata _name,
        CardType _type,
        Rarity _rarity,
        string calldata _ipfs
    ) external onlyOwner notPaused {
        require(users[_to].isRegistered, "Not registered");
        require(userCards[_to].length < MAX_CARDS, "Max cards");
        require(bytes(_name).length <= 32, "Name");
        if (_type == CardType.Dragon) require(_rarity == Rarity.Epic, "Dragon=Epic");

        uint64 id = _cardId++;
        (uint16 atk, uint16 def) = _calcStats(_type, _rarity);

        cards[id] = Card({
            cardId: id,
            attack: atk,
            defense: def,
            cardType: _type,
            rarity: _rarity,
            createdAt: uint40(block.timestamp),
            lastTransferAt: uint40(block.timestamp),
            lockedUntil: 0,
            isTradeable: true,
            name: _name,
            ipfsHash: _ipfs
        });

        _safeMint(_to, id);
        _setTokenURI(id, _ipfs);
        userCards[_to].push(id);

        emit CardMinted(id, _to);
    }

    function proposeTrade(
        address _to,
        uint64[] calldata _myCards,
        uint64[] calldata _theirCards
    ) external notPaused registered canTransact {
        require(_to != msg.sender, "Self");
        require(_myCards.length > 0 || _theirCards.length > 0, "Empty");
        require(_myCards.length <= 4 && _theirCards.length <= 4, "Too many");
        require(users[_to].isRegistered, "Receiver");

        // Verifier propriete
        for (uint i = 0; i < _myCards.length; i++) {
            require(ownerOf(_myCards[i]) == msg.sender, "Not owner");
        }
        for (uint i = 0; i < _theirCards.length; i++) {
            require(ownerOf(_theirCards[i]) == _to, "Not theirs");
        }

        // Verifier limites
        require(
            userCards[msg.sender].length - _myCards.length + _theirCards.length <= MAX_CARDS &&
            userCards[_to].length - _theirCards.length + _myCards.length <= MAX_CARDS,
            "Limit"
        );

        uint64 id = _tradeId++;
        trades[id] = Trade({
            proposer: msg.sender,
            receiver: _to,
            proposerCards: _myCards,
            receiverCards: _theirCards,
            status: TradeStatus.Pending,
            expiresAt: uint40(block.timestamp + TRADE_EXPIRY)
        });

        users[msg.sender].lastTxAt = uint40(block.timestamp);
        emit TradeProposed(id, msg.sender, _to);
    }

    function acceptTrade(uint64 _id) external notPaused registered canTransact {
        Trade storage t = trades[_id];
        require(t.receiver == msg.sender, "Not receiver");
        require(t.status == TradeStatus.Pending, "Not pending");
        require(block.timestamp <= t.expiresAt, "Expired");

        // Verifier equite (50-200%)
        uint256 offered = _calcValue(t.proposerCards);
        uint256 requested = _calcValue(t.receiverCards);
        if (requested > 0) {
            uint256 ratio = (offered * 100) / requested;
            require(ratio >= 50 && ratio <= 200, "Unfair");
        }

        // Transferer cartes
        for (uint i = 0; i < t.proposerCards.length; i++) {
            _transferCard(t.proposerCards[i], t.proposer, msg.sender);
        }
        for (uint i = 0; i < t.receiverCards.length; i++) {
            _transferCard(t.receiverCards[i], msg.sender, t.proposer);
        }

        t.status = TradeStatus.Accepted;

        // Appliquer lock
        uint40 lockTime = uint40(block.timestamp + LOCK_TIME);
        users[msg.sender].lockUntil = lockTime;
        users[t.proposer].lockUntil = lockTime;
        users[msg.sender].lastTxAt = uint40(block.timestamp);
        users[t.proposer].lastTxAt = uint40(block.timestamp);
        users[msg.sender].tradesCompleted++;
        users[t.proposer].tradesCompleted++;

        emit TradeFinalized(_id, TradeStatus.Accepted);
    }

    function rejectTrade(uint64 _id) external notPaused {
        Trade storage t = trades[_id];
        require(t.receiver == msg.sender, "Not receiver");
        require(t.status == TradeStatus.Pending, "Not pending");
        t.status = TradeStatus.Rejected;
        emit TradeFinalized(_id, TradeStatus.Rejected);
    }

    function cancelTrade(uint64 _id) external notPaused {
        Trade storage t = trades[_id];
        require(t.proposer == msg.sender, "Not proposer");
        require(t.status == TradeStatus.Pending, "Not pending");
        t.status = TradeStatus.Cancelled;
        emit TradeFinalized(_id, TradeStatus.Cancelled);
    }

    // === FONCTIONS DE LECTURE ===

    function getUserCards(address _user) external view returns (uint64[] memory) {
        return userCards[_user];
    }

    function getCard(uint64 _id) external view returns (Card memory) {
        return cards[_id];
    }

    function getTrade(uint64 _id) external view returns (Trade memory) {
        return trades[_id];
    }

    function getCardValue(uint64 _id) public view returns (uint256) {
        Card storage c = cards[_id];
        uint256 v = _rarityValue(c.rarity);
        if (c.cardType == CardType.Dragon) v += 200;
        else if (c.cardType == CardType.Spell) v += 100;
        return v;
    }

    function canTransactNow(address _user) external view returns (bool, string memory) {
        User storage u = users[_user];
        if (!u.isRegistered) return (false, "Not registered");
        if (block.timestamp < u.lastTxAt + COOLDOWN) return (false, "Cooldown");
        if (block.timestamp < u.lockUntil) return (false, "Locked");
        return (true, "OK");
    }

    // === ADMIN ===

    function setPaused(bool _p) external onlyOwner { paused = _p; }

    // === INTERNES ===

    function _calcStats(CardType _t, Rarity _r) internal pure returns (uint16 atk, uint16 def) {
        uint16[6] memory baseAtk = [uint16(50), 80, 60, 0, 100, 0];
        uint16[6] memory baseDef = [uint16(50), 20, 30, 100, 60, 0];
        uint8[4] memory mult = [uint8(10), 12, 15, 20]; // x10
        atk = (baseAtk[uint(_t)] * mult[uint(_r)]) / 10;
        def = (baseDef[uint(_t)] * mult[uint(_r)]) / 10;
    }

    function _rarityValue(Rarity _r) internal pure returns (uint256) {
        uint256[4] memory vals = [uint256(100), 250, 500, 1000];
        return vals[uint(_r)];
    }

    function _calcValue(uint64[] storage _cards) internal view returns (uint256 total) {
        for (uint i = 0; i < _cards.length; i++) {
            total += getCardValue(_cards[i]);
        }
    }

    function _transferCard(uint64 _id, address _from, address _to) internal {
        _transfer(_from, _to, _id);
        cards[_id].lastTransferAt = uint40(block.timestamp);
        cardHistory[_id].push(_from);
        _removeUserCard(_from, _id);
        userCards[_to].push(_id);
    }

    function _removeUserCard(address _user, uint64 _id) internal {
        uint64[] storage arr = userCards[_user];
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == _id) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return;
            }
        }
    }

    // === OVERRIDES ===

    function tokenURI(uint256 id) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(id);
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(id);
    }
}
