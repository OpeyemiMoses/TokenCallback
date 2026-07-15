const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Token Callback — Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network  : ${network.name} (chainId: ${network.chainId})`);
  console.log(`  Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${ethers.formatEther(balance)} MON`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n⏳ Deploying TokenCallback...");
  const TokenCallback = await ethers.getContractFactory("TokenCallback");
  const contract = await TokenCallback.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log(`\n✅ TokenCallback deployed!`);
  console.log(`   Address : ${address}`);
  console.log(`   Tx hash : ${contract.deploymentTransaction().hash}`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📋 Next steps:");
  console.log(`   1. Copy the contract address above`);
  console.log(`   2. Paste it into frontend/app.js as CONTRACT_ADDRESS`);
  console.log(`   3. Deploy your frontend to GitHub Pages / Vercel`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
