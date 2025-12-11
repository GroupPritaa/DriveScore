# DriveScoreLogger - 驾驶评分日志隐私上链 DApp

基于 FHEVM 全同态加密技术的驾驶评分日志隐私上链应用。

## 项目结构

```
action/
├── drive-score-contracts/    # 智能合约项目
└── drive-score-frontend/     # 前端项目
```

## 快速开始

### 1. 安装依赖

#### 合约项目
```bash
cd drive-score-contracts
npm install
```

#### 前端项目
```bash
cd drive-score-frontend
npm install
```

### 2. 本地开发（Mock 模式）

#### 启动 Hardhat 节点
```bash
cd drive-score-contracts
npx hardhat node --verbose
```

#### 部署合约
```bash
# 在另一个终端
cd drive-score-contracts
npx hardhat deploy --network localhost
```

#### 生成 ABI
```bash
cd drive-score-frontend
npm run genabi
```

#### 启动前端（Mock 模式）
```bash
cd drive-score-frontend
npm run dev:mock
```

前端将自动检测本地 Hardhat 节点并使用 Mock FHEVM 实例。

### 3. 测试网部署（Relayer 模式）

#### 部署到 Sepolia
```bash
cd drive-score-contracts
npx hardhat deploy --network sepolia
```

#### 生成 ABI（包含 Sepolia 地址）
```bash
cd drive-score-frontend
npm run genabi
```

#### 启动前端（Relayer 模式）
```bash
cd drive-score-frontend
npm run dev
```

前端将使用 `@zama-fhe/relayer-sdk` 与 Sepolia 测试网交互。

## 技术栈

### 合约
- **Solidity**: ^0.8.27
- **FHEVM**: @fhevm/solidity ^0.9.1
- **Hardhat**: ^2.26.0
- **@fhevm/hardhat-plugin**: ^0.3.0-1

### 前端
- **React**: ^18.3.1
- **Vite**: ^5.3.1
- **TypeScript**: ^5.5.3
- **Tailwind CSS**: ^3.4.4
- **@zama-fhe/relayer-sdk**: 0.3.0-5
- **@fhevm/mock-utils**: 0.3.0-1

## 核心功能

1. **加密评分记录**: 使用 FHEVM 加密 0-100 的驾驶安全评分
2. **趋势分析**: 在加密状态下计算改善/下降趋势
3. **均值统计**: 累加加密评分并计算平均值
4. **连续天数追踪**: 记录连续安全驾驶天数
5. **数据可视化**: 评分趋势图表和里程分布统计
6. **历史记录**: 查看所有提交记录（加密存储）

## ✨ 深色主题 UI

前端采用深色主题设计，包含 4 个核心页面：
- ⚡ **控制台**: 关键数据概览和快捷操作
- 📋 **记录评分**: 交互式评分记录界面
- 📚 **历史日志**: 查看和解密历史评分
- 📊 **数据分析**: 可视化数据图表和智能洞察

UI 风格采用深色主题 + 橙色/红色渐变，与驾驶01的蓝紫色风格完全不同。

## 合约接口

### DriveScoreLogger.sol

- `recordDriveScore(encryptedScore, inputProof, distanceCategory)`: 记录加密评分
- `getScoreTrend(userAddress)`: 获取趋势差值（加密）
- `getAverageCalculationData(userAddress)`: 获取累加值和计数
- `getLatestRecord(userAddress)`: 获取最新记录
- `getUserStatistics(userAddress)`: 获取用户统计信息

## 注意事项

1. **本地开发**: 确保 Hardhat 节点运行在 `http://localhost:8545`
2. **测试网**: 需要配置 `INFURA_API_KEY` 和 `MNEMONIC`
3. **ABI 生成**: 每次部署合约后需要重新生成 ABI
4. **钱包连接**: 需要 MetaMask 或其他 EIP-1193 兼容钱包

## 开发命令

### 合约
```bash
npm run compile      # 编译合约
npm run test         # 运行测试
npm run deploy:localhost  # 部署到本地
npm run deploy:sepolia    # 部署到 Sepolia
```

### 前端
```bash
npm run dev         # 开发模式（Relayer）
npm run dev:mock    # 开发模式（Mock）
npm run build       # 构建生产版本
npm run genabi      # 生成 ABI 文件
```

## 许可证

MIT

