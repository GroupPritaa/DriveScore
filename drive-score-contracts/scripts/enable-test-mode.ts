import { ethers } from "hardhat";

async function main() {
  // 获取部署的合约地址
  const deployment = await import("../deployments/localhost/DriveScoreLogger.json");
  const contractAddress = deployment.address;

  console.log(`Connecting to contract at: ${contractAddress}`);

  // 获取签名者（部署者账户）
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);

  // 连接到合约
  const DriveScoreLogger = await ethers.getContractFactory("DriveScoreLogger");
  const contract = DriveScoreLogger.attach(contractAddress);

  // 启用测试模式
  console.log("Enabling test mode...");
  const tx = await contract.toggleTestMode(true);
  await tx.wait();

  console.log("✅ Test mode enabled!");
  console.log(`Transaction hash: ${tx.hash}`);

  // 验证测试模式状态
  const testMode = await contract.isTestModeEnabled();
  console.log(`Test mode status: ${testMode}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

