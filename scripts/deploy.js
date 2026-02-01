const { ethers } = require("hardhat");

async function main() {
  console.log("Deploiement de Medieval TCG...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploye par:", deployer.address);

  const MedievalTCG = await ethers.getContractFactory("MedievalTCG");
  const medievalTCG = await MedievalTCG.deploy();
  await medievalTCG.waitForDeployment();

  const address = await medievalTCG.getAddress();
  console.log("MedievalTCG deploye a:", address);

  console.log("\n--- Configuration ---");
  console.log("MAX_CARDS_PER_USER:", await medievalTCG.MAX_CARDS_PER_USER());
  console.log("COOLDOWN_DURATION:", await medievalTCG.COOLDOWN_DURATION(), "secondes");
  console.log("CRITICAL_LOCK_DURATION:", await medievalTCG.CRITICAL_LOCK_DURATION(), "secondes");

  console.log("\n--- Deploiement termine! ---");
  console.log("Copiez cette adresse pour l'utiliser dans le frontend:");
  console.log(address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
