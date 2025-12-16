import { ethers } from "hardhat";

async function main() {
  // 获取部署的合约地址
  const deployment = await import("../deployments/localhost/DriveScoreLogger.json");
  const contractAddress = deployment.address;

  // 从环境变量或命令行参数获取用户地址
  const userAddress = process.env.USER_ADDRESS || process.argv[2];
  
  if (!userAddress) {
    console.error("Usage: USER_ADDRESS=0x... npx hardhat run scripts/reset-user-time.ts --network localhost");
    console.error("Or: npx hardhat run scripts/reset-user-time.ts --network localhost -- --user 0x...");
    console.error("Example: USER_ADDRESS=0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199 npx hardhat run scripts/reset-user-time.ts --network localhost");
    process.exit(1);
  }

  console.log(`Connecting to contract at: ${contractAddress}`);
  console.log(`Resetting record time for user: ${userAddress}`);

  // 获取签名者（部署者账户，即管理员）
  const [deployer] = await ethers.getSigners();
  console.log(`Using admin account: ${deployer.address}`);

  // 连接到合约
  const DriveScoreLogger = await ethers.getContractFactory("DriveScoreLogger");
  const contract = DriveScoreLogger.attach(contractAddress);

  // 检查测试模式
  const testMode = await contract.isTestModeEnabled();
  if (!testMode) {
    console.error("❌ Test mode is not enabled! Please enable it first:");
    console.error("   npx hardhat run scripts/enable-test-mode.ts --network localhost");
    process.exit(1);
  }

  // 重置用户提交时间
  console.log("Resetting user record time...");
  const tx = await contract.resetUserRecordTime(userAddress);
  await tx.wait();

  console.log("✅ User record time reset successfully!");
  console.log(`Transaction hash: ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

