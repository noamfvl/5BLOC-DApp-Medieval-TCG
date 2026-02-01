const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedievalTCG", function () {
  let medievalTCG;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const MedievalTCG = await ethers.getContractFactory("MedievalTCG");
    medievalTCG = await MedievalTCG.deploy();
    await medievalTCG.waitForDeployment();
  });

  describe("Enregistrement", function () {
    it("devrait enregistrer un utilisateur", async function () {
      await medievalTCG.connect(user1).registerUser("Chevalier1");
      const user = await medievalTCG.users(user1.address);
      expect(user.isRegistered).to.be.true;
      expect(user.username).to.equal("Chevalier1");
    });

    it("devrait echouer si deja enregistre", async function () {
      await medievalTCG.connect(user1).registerUser("Test");
      await expect(medievalTCG.connect(user1).registerUser("Test2"))
        .to.be.revertedWith("Exists");
    });
  });

  describe("Mint de Cartes", function () {
    beforeEach(async function () {
      await medievalTCG.connect(user1).registerUser("User1");
    });

    it("devrait minter une carte Knight Common", async function () {
      await medievalTCG.mintCard(user1.address, "Garde", 0, 0, "ipfs://test");
      const card = await medievalTCG.getCard(1);
      expect(card.name).to.equal("Garde");
      expect(card.attack).to.equal(50);
      expect(card.defense).to.equal(50);
    });

    it("devrait minter une carte Mage Rare", async function () {
      await medievalTCG.mintCard(user1.address, "Merlin", 1, 2, "ipfs://test");
      const card = await medievalTCG.getCard(1);
      expect(card.attack).to.equal(120); // 80 * 1.5
      expect(card.defense).to.equal(30);  // 20 * 1.5
    });

    it("devrait echouer si Dragon non Epic", async function () {
      await expect(medievalTCG.mintCard(user1.address, "Dragon", 4, 0, "ipfs://d"))
        .to.be.revertedWith("Dragon=Epic");
    });

    it("devrait accepter Dragon Epic", async function () {
      await medievalTCG.mintCard(user1.address, "Smaug", 4, 3, "ipfs://d");
      const card = await medievalTCG.getCard(1);
      expect(card.attack).to.equal(200); // 100 * 2.0
    });

    it("devrait echouer si limite de 4 cartes", async function () {
      for (let i = 0; i < 4; i++) {
        await medievalTCG.mintCard(user1.address, `C${i}`, 0, 0, `ipfs://${i}`);
      }
      await expect(medievalTCG.mintCard(user1.address, "C5", 0, 0, "ipfs://5"))
        .to.be.revertedWith("Max cards");
    });
  });

  describe("Valeur des Cartes", function () {
    beforeEach(async function () {
      await medievalTCG.connect(user1).registerUser("User1");
    });

    it("devrait calculer correctement les valeurs", async function () {
      await medievalTCG.mintCard(user1.address, "Common", 0, 0, "ipfs://1");
      expect(await medievalTCG.getCardValue(1)).to.equal(100);

      await medievalTCG.mintCard(user1.address, "Uncommon", 0, 1, "ipfs://2");
      expect(await medievalTCG.getCardValue(2)).to.equal(250);

      await medievalTCG.mintCard(user1.address, "Rare", 0, 2, "ipfs://3");
      expect(await medievalTCG.getCardValue(3)).to.equal(500);

      await medievalTCG.mintCard(user1.address, "Epic", 0, 3, "ipfs://4");
      expect(await medievalTCG.getCardValue(4)).to.equal(1000);
    });

    it("devrait ajouter bonus Dragon", async function () {
      await medievalTCG.mintCard(user1.address, "Dragon", 4, 3, "ipfs://d");
      expect(await medievalTCG.getCardValue(1)).to.equal(1200); // 1000 + 200
    });
  });

  describe("Echanges", function () {
    beforeEach(async function () {
      await medievalTCG.connect(user1).registerUser("User1");
      await medievalTCG.connect(user2).registerUser("User2");
      await medievalTCG.mintCard(user1.address, "Card1", 0, 0, "ipfs://1");
      await medievalTCG.mintCard(user2.address, "Card2", 0, 0, "ipfs://2");
    });

    it("devrait proposer un echange", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);
      const trade = await medievalTCG.getTrade(1);
      expect(trade.proposer).to.equal(user1.address);
      expect(trade.receiver).to.equal(user2.address);
      expect(trade.status).to.equal(0); // Pending
    });

    it("devrait accepter un echange", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);

      // Attendre cooldown
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      await medievalTCG.connect(user2).acceptTrade(1);

      expect(await medievalTCG.ownerOf(1)).to.equal(user2.address);
      expect(await medievalTCG.ownerOf(2)).to.equal(user1.address);
    });

    it("devrait refuser un echange", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);
      await medievalTCG.connect(user2).rejectTrade(1);

      const trade = await medievalTCG.getTrade(1);
      expect(trade.status).to.equal(2); // Rejected
    });

    it("devrait annuler un echange", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);
      await medievalTCG.connect(user1).cancelTrade(1);

      const trade = await medievalTCG.getTrade(1);
      expect(trade.status).to.equal(3); // Cancelled
    });
  });

  describe("Cooldown et Lock", function () {
    beforeEach(async function () {
      await medievalTCG.connect(user1).registerUser("User1");
      await medievalTCG.connect(user2).registerUser("User2");
      await medievalTCG.mintCard(user1.address, "C1", 0, 0, "ipfs://1");
      await medievalTCG.mintCard(user2.address, "C2", 0, 0, "ipfs://2");
    });

    it("devrait bloquer pendant cooldown", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);
      await medievalTCG.mintCard(user1.address, "C3", 0, 0, "ipfs://3");

      await expect(medievalTCG.connect(user1).proposeTrade(user2.address, [3], []))
        .to.be.revertedWith("Cooldown");
    });

    it("devrait permettre apres cooldown", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      await medievalTCG.mintCard(user1.address, "C3", 0, 0, "ipfs://3");
      await medievalTCG.connect(user1).proposeTrade(user2.address, [3], []);
    });

    it("devrait appliquer lock apres acceptation", async function () {
      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      await medievalTCG.connect(user2).acceptTrade(1);

      await medievalTCG.mintCard(user1.address, "C3", 0, 0, "ipfs://3");
      await medievalTCG.mintCard(user2.address, "C4", 0, 0, "ipfs://4");

      // Attendre le cooldown (5 min) mais pas le lock (10 min)
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      await expect(medievalTCG.connect(user1).proposeTrade(user2.address, [3], [4]))
        .to.be.revertedWith("Locked");
    });
  });

  describe("Equite des Echanges", function () {
    beforeEach(async function () {
      await medievalTCG.connect(user1).registerUser("User1");
      await medievalTCG.connect(user2).registerUser("User2");
    });

    it("devrait rejeter echange non equitable", async function () {
      await medievalTCG.mintCard(user1.address, "Epic", 0, 3, "ipfs://e"); // 1000 pts
      await medievalTCG.mintCard(user2.address, "Common", 0, 0, "ipfs://c"); // 100 pts

      await medievalTCG.connect(user1).proposeTrade(user2.address, [1], [2]);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      // Ratio = 100/1000 = 10% < 50%
      await expect(medievalTCG.connect(user2).acceptTrade(1))
        .to.be.revertedWith("Unfair");
    });
  });
});
