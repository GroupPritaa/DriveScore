import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDriveScoreLogger = await deploy("DriveScoreLogger", {
    from: deployer,
    log: true,
  });

  console.log(`DriveScoreLogger contract deployed at: ${deployedDriveScoreLogger.address}`);
};

