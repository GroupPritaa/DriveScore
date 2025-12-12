// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DriveScoreLogger - 驾驶评分日志隐私上链合约
/// @notice 使用 FHEVM 全同态加密保护个人驾驶行为隐私
/// @dev 所有评分数据全加密存储，支持加密状态下的趋势计算和统计
contract DriveScoreLogger is ZamaEthereumConfig {
    /// @notice 驾驶记录结构
    struct DriveRecord {
        euint32 encryptedScore;      // 加密评分 0-100
        uint64 recordTime;            // 上链时间
        uint8 distanceCategory;     // 里程等级: 0=未知, 1=短途(0-20km), 2=中程(20-50km), 3=长程(50km+)
    }

    /// @notice 用户数据统计
    struct UserData {
        euint32 encryptedTotalScore;     // 累加总分（用于均值计算）
        uint32 totalRecords;              // 记录数量
        uint64 lastRecordTime;             // 最后提交时间
        uint16 continuousDays;             // 连续安全驾驶天数
        euint32 encryptedLastScore;       // 上一次评分（用于趋势计算）
        euint32 encryptedScoreChange;     // 评分差值（当前-上次，用于趋势判断）
        DriveRecord[] historyRecords;     // 历史记录数组（最多保留最近50条）
    }

    /// @notice 用户地址到数据统计的映射
    mapping(address => UserData) public userDataMap;

    /// @notice 最大保留记录数
    uint8 public constant MAX_HISTORY_RECORDS = 50;

    /// @notice 每日提交间隔（秒）
    uint256 public constant DAILY_SUBMIT_INTERVAL = 86400; // 24小时

    /// @notice 测试模式：允许绕过时间限制（仅用于开发测试）
    bool public isTestModeEnabled = false;

    /// @notice 管理员地址（用于启用/禁用测试模式）
    address public contractAdmin;

    /// @notice 测试模式切换事件
    event TestModeChanged(bool enabled);

    /// @notice 构造函数
    constructor() {
        contractAdmin = msg.sender;
    }

    /// @notice 切换测试模式（仅管理员）
    function toggleTestMode(bool _enabled) external {
        require(msg.sender == contractAdmin, "Only admin");
        isTestModeEnabled = _enabled;
        emit TestModeChanged(_enabled);
    }

    /// @notice 重置用户提交时间（仅测试模式）
    /// @param userAddress 要重置的用户地址
    function resetUserRecordTime(address userAddress) external {
        require(isTestModeEnabled, "Test mode not enabled");
        require(msg.sender == contractAdmin, "Only admin");
        userDataMap[userAddress].lastRecordTime = 0;
    }

    /// @notice 评分提交事件
    event ScoreRecorded(
        address indexed userAddress,
        uint64 recordTime,
        uint8 distanceCategory
    );

    /// @notice 连续天数更新事件
    event ContinuousDaysChanged(
        address indexed userAddress,
        uint16 continuousDays
    );

    /// @notice 提交驾驶评分
    /// @param encryptedScore 加密的评分值 (0-100)
    /// @param inputProof 输入证明
    /// @param distanceCategory 里程等级 (0=未知, 1=短途, 2=中程, 3=长程)
    function recordDriveScore(
        externalEuint32 encryptedScore,
        bytes calldata inputProof,
        uint8 distanceCategory
    ) external {
        // 1. 验证并转换外部加密输入
        euint32 encryptedValue = FHE.fromExternal(encryptedScore, inputProof);

        // 2. 验证里程等级范围
        require(distanceCategory <= 3, "Invalid distance category");

        // 3. 检查每日提交限制（测试模式下跳过）
        UserData storage userData = userDataMap[msg.sender];
        if (userData.lastRecordTime > 0 && !isTestModeEnabled) {
            require(
                block.timestamp - userData.lastRecordTime >= DAILY_SUBMIT_INTERVAL,
                "Only one submission per day"
            );
        }

        // 4. 更新累加总分（用于均值计算）
        if (userData.totalRecords == 0) {
            // 首次提交，直接赋值
            userData.encryptedTotalScore = encryptedValue;
        } else {
            // 累加
            userData.encryptedTotalScore = FHE.add(userData.encryptedTotalScore, encryptedValue);
        }

        // 5. 计算趋势差值（当前评分 - 上次评分）
        if (userData.totalRecords > 0) {
            // 计算差值：current - previous
            // 如果差值 > 0，表示改善；< 0 表示下降；= 0 表示无变化
            userData.encryptedScoreChange = FHE.sub(encryptedValue, userData.encryptedLastScore);
        } else {
            // 首次提交，差值为0（加密）
            userData.encryptedScoreChange = FHE.sub(encryptedValue, encryptedValue);
        }

        // 6. 更新记录数量
        userData.totalRecords++;

        // 7. 更新连续天数
        if (userData.lastRecordTime == 0) {
            // 首次提交
            userData.continuousDays = 1;
        } else {
            uint256 timeDiff = block.timestamp - userData.lastRecordTime;
            if (timeDiff < DAILY_SUBMIT_INTERVAL + 3600) {
                // 在25小时内提交，视为连续
                userData.continuousDays++;
            } else {
                // 超过25小时，重置连续天数
                userData.continuousDays = 1;
            }
        }

        // 8. 添加新记录
        userData.historyRecords.push(DriveRecord({
            encryptedScore: encryptedValue,
            recordTime: uint64(block.timestamp),
            distanceCategory: distanceCategory
        }));

        // 9. 限制记录数量（保留最近MAX_HISTORY_RECORDS条）
        if (userData.historyRecords.length > MAX_HISTORY_RECORDS) {
            // 移除最旧的记录（简化实现：只保留索引0到MAX_HISTORY_RECORDS-1）
            // 注意：Solidity数组删除操作较昂贵，实际可考虑循环队列
            for (uint256 i = 0; i < userData.historyRecords.length - MAX_HISTORY_RECORDS; i++) {
                delete userData.historyRecords[i];
            }
        }

        // 10. 更新上次评分和时间戳
        userData.encryptedLastScore = encryptedValue;
        userData.lastRecordTime = uint64(block.timestamp);

        // 11. ACL 授权 - 允许合约和用户访问加密数据
        FHE.allowThis(encryptedValue);
        FHE.allowThis(userData.encryptedTotalScore);
        FHE.allowThis(userData.encryptedScoreChange);
        FHE.allowThis(userData.encryptedLastScore);
        
        // 授权用户解密
        FHE.allow(encryptedValue, msg.sender);
        FHE.allow(userData.encryptedTotalScore, msg.sender);
        FHE.allow(userData.encryptedScoreChange, msg.sender);
        FHE.allow(userData.encryptedLastScore, msg.sender);

        emit ScoreRecorded(msg.sender, uint64(block.timestamp), distanceCategory);
        
        if (userData.continuousDays > 1) {
            emit ContinuousDaysChanged(msg.sender, userData.continuousDays);
        }
    }

    /// @notice 获取趋势差值（加密）
    /// @param userAddress 用户地址
    /// @return 加密的评分差值（>0改善, <0下降, =0无变化）
    /// @dev 需要至少2条记录才能计算趋势
    function getScoreTrend(address userAddress) external view returns (euint32) {
        UserData storage userData = userDataMap[userAddress];
        require(userData.totalRecords >= 2, "Insufficient records for trend");
        return userData.encryptedScoreChange;
    }

    /// @notice 获取累加值和计数（用于前端计算均值）
    /// @param userAddress 用户地址
    /// @return encryptedTotal 加密的累加总分
    /// @return recordCount 记录数量
    function getAverageCalculationData(address userAddress) external view returns (euint32 encryptedTotal, uint32 recordCount) {
        UserData storage userData = userDataMap[userAddress];
        return (userData.encryptedTotalScore, userData.totalRecords);
    }

    /// @notice 获取最新记录
    /// @param userAddress 用户地址
    /// @return 最新的驾驶记录
    function getLatestRecord(address userAddress) external view returns (DriveRecord memory) {
        UserData storage userData = userDataMap[userAddress];
        require(userData.historyRecords.length > 0, "No records");
        return userData.historyRecords[userData.historyRecords.length - 1];
    }

    /// @notice 获取用户统计信息（明文部分）
    /// @param userAddress 用户地址
    /// @return recordCount 记录数量
    /// @return continuousDays 连续天数
    /// @return lastRecordTime 最后提交时间
    function getUserStatistics(address userAddress) external view returns (
        uint32 recordCount,
        uint16 continuousDays,
        uint64 lastRecordTime
    ) {
        UserData storage userData = userDataMap[userAddress];
        return (userData.totalRecords, userData.continuousDays, userData.lastRecordTime);
    }

    /// @notice 获取记录数量
    /// @param userAddress 用户地址
    /// @return 记录数量
    function getRecordCount(address userAddress) external view returns (uint256) {
        return userDataMap[userAddress].historyRecords.length;
    }

    /// @notice 获取指定索引的记录（仅返回可公开信息）
    /// @param userAddress 用户地址
    /// @param recordIndex 记录索引
    /// @return recordTime 时间戳
    /// @return distanceCategory 里程等级
    /// @return encryptedScore 加密评分（需要授权才能解密）
    function getRecordByIndex(address userAddress, uint256 recordIndex) external view returns (
        uint64 recordTime,
        uint8 distanceCategory,
        euint32 encryptedScore
    ) {
        UserData storage userData = userDataMap[userAddress];
        require(recordIndex < userData.historyRecords.length, "Index out of bounds");
        DriveRecord storage record = userData.historyRecords[recordIndex];
        return (record.recordTime, record.distanceCategory, record.encryptedScore);
    }
}

