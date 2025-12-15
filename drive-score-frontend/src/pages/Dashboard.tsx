import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import { DriveScoreLoggerABI, DriveScoreLoggerAddresses } from '../abi'
import { FhevmDecryptionSignature } from '../fhevm/FhevmDecryptionSignature'
import { GenericStringInMemoryStorage } from '../fhevm/GenericStringStorage'

interface DashboardProps {
  wallet: {
    provider: any
    chainId: number | undefined
    accounts: string[]
    signer: any
    isConnected: boolean
  }
  fhevm: {
    instance: any
    status: string
    error: Error | undefined
  }
}

export default function Dashboard({ wallet, fhevm }: DashboardProps) {
  const [stats, setStats] = useState({
    continuousDays: 0,
    totalRecords: 0,
    averageScore: null as number | null,
    scoreTrend: null as number | null,
    lastRecordTime: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [isDecrypted, setIsDecrypted] = useState(false)
  const storage = new GenericStringInMemoryStorage()

  const getContract = () => {
    if (!wallet.chainId || !wallet.signer) return null
    const chainIdStr = wallet.chainId.toString()
    const address = DriveScoreLoggerAddresses[chainIdStr as keyof typeof DriveScoreLoggerAddresses]
    if (!address || address.address === ethers.ZeroAddress) return null
    return new ethers.Contract(address.address, DriveScoreLoggerABI.abi, wallet.signer)
  }

  const loadBasicStats = async () => {
    if (!wallet.signer) return
    
    setIsLoading(true)
    try {
      const contract = getContract()
      if (!contract) return

      const userAddress = await wallet.signer.getAddress()
      const [recordCount, days, lastTime] = await contract.getUserStatistics(userAddress)

      setStats(prev => ({
        ...prev,
        continuousDays: Number(days),
        totalRecords: Number(recordCount),
        lastRecordTime: Number(lastTime),
      }))
    } catch (error) {
      console.error('Failed to load basic stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const decryptAndLoadStats = async () => {
    if (!wallet.signer || !fhevm.instance) return
    
    setIsDecrypting(true)
    try {
      const contract = getContract()
      if (!contract) return

      const userAddress = await wallet.signer.getAddress()
      const contractAddress = await contract.getAddress()

      let average = null
      if (stats.totalRecords > 0) {
        const [encTotal, count] = await contract.getAverageCalculationData(userAddress)
        const sig = await FhevmDecryptionSignature.loadOrSign(
          fhevm.instance,
          [contractAddress],
          wallet.signer,
          storage
        )
        if (sig) {
          try {
            const totalResult = await fhevm.instance.userDecrypt(
              [{ handle: encTotal, contractAddress }],
              sig.privateKey,
              sig.publicKey,
              sig.signature,
              sig.contractAddresses,
              sig.userAddress,
              sig.startTimestamp,
              sig.durationDays
            )
            // 处理解密结果
            const total = Number(totalResult[encTotal])
            if (!isNaN(total) && total >= 0) {
              average = total / Number(count)
              console.log('Decrypted average:', average, 'total:', total, 'count:', count)
            } else {
              console.warn('Invalid decrypted total:', totalResult, 'encTotal:', encTotal)
            }
          } catch (error) {
            console.error('Failed to decrypt average:', error)
          }
        }
      }

      let trend = null
      if (stats.totalRecords >= 2) {
        const encTrend = await contract.getScoreTrend(userAddress)
        const sig = await FhevmDecryptionSignature.loadOrSign(
          fhevm.instance,
          [contractAddress],
          wallet.signer,
          storage
        )
        if (sig) {
          try {
            const trendResult = await fhevm.instance.userDecrypt(
              [{ handle: encTrend, contractAddress }],
              sig.privateKey,
              sig.publicKey,
              sig.signature,
              sig.contractAddresses,
              sig.userAddress,
              sig.startTimestamp,
              sig.durationDays
            )
            // 处理解密结果
            trend = Number(trendResult[encTrend])
            if (isNaN(trend)) {
              console.warn('Invalid decrypted trend:', trendResult, 'encTrend:', encTrend)
              trend = null
            } else {
              console.log('Decrypted trend:', trend)
            }
          } catch (error) {
            console.error('Failed to decrypt trend:', error)
          }
        }
      }

      console.log('Decryption results:', { average, trend, totalRecords: stats.totalRecords })
      setStats(prev => ({
        ...prev,
        averageScore: average,
        scoreTrend: trend,
      }))
      setIsDecrypted(true)
      console.log('Stats updated, isDecrypted:', true)
    } catch (error) {
      console.error('Failed to decrypt stats:', error)
      alert(`解密失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsDecrypting(false)
    }
  }

  useEffect(() => {
    if (wallet.isConnected) {
      loadBasicStats()
      setIsDecrypted(false)
      setStats(prev => ({
        ...prev,
        averageScore: null,
        scoreTrend: null,
      }))
    }
  }, [wallet.isConnected])

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'NO_DATA'
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '.').replace(', ', '_')
  }

  if (!wallet.isConnected) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center">
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-cyan blur-2xl opacity-50 animate-pulse"></div>
            <div className="relative text-8xl">🔒</div>
          </div>
          <h2 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan bg-clip-text mb-4">
            ACCESS_DENIED
          </h2>
          <p className="text-gray-400 font-rajdhani text-lg tracking-wider">CONNECT_WALLET_TO_PROCEED</p>
        </div>
      </div>
    )
  }

  const contractAvailable = getContract() !== null

  return (
    <div className="space-y-6">
      {/* 标题横幅 - 赛博朋克风格 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-cyan-600/20 animate-gradient"></div>
        <div className="scan-line absolute inset-0"></div>
        <div className="relative glass-morphism border-2 border-neon-purple/30 p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                <h1 className="text-4xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-cyan bg-clip-text">
                  CONTROL_PANEL
                </h1>
              </div>
              <p className="text-gray-400 font-rajdhani text-lg tracking-wider">
                QUANTUM_ENCRYPTED_DRIVE_MONITORING_SYSTEM
              </p>
            </div>
            <div className="hidden md:block relative">
              <div className="absolute inset-0 bg-neon-purple/20 blur-xl"></div>
              <div className="relative text-7xl opacity-30">⚡</div>
            </div>
          </div>
        </div>
      </div>

      {/* 合约未部署警告 */}
      {!contractAvailable && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 animate-pulse"></div>
          <div className="relative glass-morphism border-2 border-red-500/50 p-6">
            <div className="flex items-start space-x-4">
              <div className="text-4xl">⚠</div>
              <div>
                <h3 className="text-xl font-bold font-orbitron text-red-400 mb-2">CONTRACT_NOT_DEPLOYED</h3>
                <p className="text-red-300/80 font-rajdhani">
                  CHAIN_ID: {wallet.chainId || 'UNKNOWN'} · EXPECTED: 31337 OR 11155111
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 解密提示卡片 */}
      {contractAvailable && !isDecrypted && stats.totalRecords > 0 && (
        <div className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-purple-600/10 to-pink-600/10"></div>
          <div className="scan-line absolute inset-0"></div>
          <div className="relative glass-morphism border-2 border-neon-purple/30 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-neon-purple blur-lg opacity-50 animate-pulse"></div>
                  <div className="relative w-16 h-16 bg-gradient-to-br from-neon-purple to-neon-pink rounded flex items-center justify-center text-4xl">
                    🔐
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-cyan bg-clip-text mb-1">
                    ENCRYPTED_DATA_DETECTED
                  </h3>
                  <p className="text-gray-400 font-rajdhani tracking-wide">
                    DECRYPT_TO_VIEW_QUANTUM_PROTECTED_METRICS
                  </p>
                </div>
              </div>
              <button
                onClick={decryptAndLoadStats}
                disabled={isDecrypting || !fhevm.instance || fhevm.status !== 'ready'}
                className={`relative px-8 py-4 font-orbitron font-bold tracking-wider overflow-hidden group ${
                  isDecrypting || !fhevm.instance || fhevm.status !== 'ready'
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/50'
                    : 'bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan border-2 border-transparent'
                }`}
              >
                <div className={`absolute inset-0 ${
                  !(isDecrypting || !fhevm.instance || fhevm.status !== 'ready')
                    ? 'bg-gradient-to-r from-neon-cyan via-neon-pink to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity'
                    : ''
                }`}></div>
                <span className="relative flex items-center space-x-2">
                  {isDecrypting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>DECRYPTING</span>
                    </>
                  ) : fhevm.status !== 'ready' ? (
                    <span>FHEVM_NOT_READY</span>
                  ) : (
                    <span>◆ DECRYPT_NOW</span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解密成功提示 */}
      {contractAvailable && isDecrypted && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
          <div className="relative glass-morphism border-2 border-green-500/50 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center text-cyber-bg font-bold">✓</div>
              <p className="text-green-300 font-rajdhani tracking-wider">DECRYPTION_SUCCESSFUL · DATA_UNLOCKED</p>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片网格 - 科技面板风格 */}
      {contractAvailable && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 连续天数 */}
          <div className="relative overflow-hidden group hover-float">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-purple/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🔥</div>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">CONTINUOUS_DAYS</h3>
                <p className="text-4xl font-bold font-orbitron text-neon-purple">
                  {stats.continuousDays}
                </p>
                <div className="h-1 bg-gradient-to-r from-neon-purple to-neon-pink opacity-30"></div>
                <p className="text-xs text-gray-500 font-rajdhani">STREAK_MAINTAINED</p>
              </div>
            </div>
          </div>

          {/* 平均评分 */}
          <div className="relative overflow-hidden group hover-float">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/20 to-blue-600/20"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-cyan/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">⭐</div>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">AVG_SCORE</h3>
                <p className="text-4xl font-bold font-orbitron text-neon-cyan">
                  {isDecrypting 
                    ? '...' 
                    : isDecrypted && stats.averageScore !== null 
                      ? stats.averageScore.toFixed(1) 
                      : stats.totalRecords > 0
                        ? '■■■'
                        : '0'}
                </p>
                <div className="h-1 bg-gradient-to-r from-neon-cyan to-neon-blue opacity-30"></div>
                <p className="text-xs text-gray-500 font-rajdhani">
                  {isDecrypted && stats.averageScore !== null ? 'MAX_100' : stats.totalRecords > 0 ? 'ENCRYPTED' : 'NO_DATA'}
                </p>
              </div>
            </div>
          </div>

          {/* 趋势 */}
          <div className="relative overflow-hidden group hover-float">
            <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-emerald-600/20"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-green/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">
                  {stats.scoreTrend === null ? '▬' : stats.scoreTrend > 0 ? '▲' : stats.scoreTrend < 0 ? '▼' : '▬'}
                </div>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-neon-green border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">TREND</h3>
                <p className={`text-4xl font-bold font-orbitron ${
                  isDecrypting
                    ? 'text-gray-500'
                    : isDecrypted 
                      ? stats.scoreTrend === null ? 'text-gray-500' :
                        stats.scoreTrend > 0 ? 'text-green-400' :
                        stats.scoreTrend < 0 ? 'text-red-400' : 'text-gray-400'
                      : stats.totalRecords >= 2 ? 'text-gray-600' : 'text-gray-700'
                }`}>
                  {isDecrypting
                    ? '...'
                    : isDecrypted 
                      ? stats.scoreTrend !== null ? `${stats.scoreTrend > 0 ? '+' : ''}${stats.scoreTrend}` : '--'
                      : stats.totalRecords >= 2
                        ? '■■■'
                        : '--'}
                </p>
                <div className={`h-1 ${
                  isDecrypted && stats.scoreTrend !== null
                    ? stats.scoreTrend > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                      stats.scoreTrend < 0 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                      'bg-gray-700'
                    : 'bg-gray-700'
                } opacity-30`}></div>
                <p className="text-xs text-gray-500 font-rajdhani">
                  {isDecrypted && stats.scoreTrend !== null ? 'VS_PREVIOUS' : stats.totalRecords >= 2 ? 'ENCRYPTED' : 'NEED_2_RECORDS'}
                </p>
              </div>
            </div>
          </div>

          {/* 记录总数 */}
          <div className="relative overflow-hidden group hover-float">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-600/20 to-rose-600/20"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-pink/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">◆</div>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-neon-pink border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">TOTAL_RECORDS</h3>
                <p className="text-4xl font-bold font-orbitron text-neon-pink">
                  {stats.totalRecords}
                </p>
                <div className="h-1 bg-gradient-to-r from-neon-pink to-neon-rose opacity-30"></div>
                <p className="text-xs text-gray-500 font-rajdhani">ACCUMULATED</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快捷操作按钮 */}
      {contractAvailable && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/submit" className="group">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 group-hover:from-cyan-600/30 group-hover:to-blue-600/30 transition-all"></div>
              <div className="relative glass-morphism border-2 border-neon-cyan/30 group-hover:border-neon-cyan/50 p-6 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-neon-cyan blur-lg opacity-50"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-neon-cyan to-neon-blue rounded flex items-center justify-center text-3xl">
                      ◆
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-cyan to-neon-blue bg-clip-text mb-1">
                      RECORD_SCORE
                    </h3>
                    <p className="text-gray-400 font-rajdhani tracking-wide">SUBMIT_NEW_DRIVE_DATA</p>
                  </div>
                  <div className="ml-auto text-2xl text-neon-cyan group-hover:translate-x-2 transition-transform">→</div>
                </div>
              </div>
            </div>
          </Link>

          <Link to="/analytics" className="group">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 group-hover:from-purple-600/30 group-hover:to-pink-600/30 transition-all"></div>
              <div className="relative glass-morphism border-2 border-neon-purple/30 group-hover:border-neon-purple/50 p-6 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-neon-purple blur-lg opacity-50"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-neon-purple to-neon-pink rounded flex items-center justify-center text-3xl">
                      ◇
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-pink bg-clip-text mb-1">
                      ANALYTICS
                    </h3>
                    <p className="text-gray-400 font-rajdhani tracking-wide">VIEW_DETAILED_METRICS</p>
                  </div>
                  <div className="ml-auto text-2xl text-neon-purple group-hover:translate-x-2 transition-transform">→</div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 最新信息 */}
      {contractAvailable && stats.lastRecordTime > 0 && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/20 to-gray-700/20"></div>
          <div className="relative glass-morphism border-2 border-gray-600/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm text-gray-500 font-orbitron tracking-wider mb-2">LAST_SUBMISSION</h3>
                <p className="text-xl font-orbitron text-gray-300">{formatDate(stats.lastRecordTime)}</p>
              </div>
              <Link
                to="/history"
                className="px-6 py-3 bg-gradient-to-r from-neon-purple to-neon-pink rounded font-orbitron text-white text-sm tracking-wider hover:from-neon-pink hover:to-neon-purple transition-all"
              >
                VIEW_HISTORY
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {contractAvailable && stats.totalRecords === 0 && !isLoading && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-cyan-900/10"></div>
          <div className="scan-line absolute inset-0"></div>
          <div className="relative glass-morphism border-2 border-neon-purple/30 p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-cyan blur-2xl opacity-30"></div>
              <div className="relative text-7xl">⚡</div>
            </div>
            <h3 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan bg-clip-text mb-4">
              SYSTEM_READY
            </h3>
            <p className="text-gray-400 font-rajdhani text-lg mb-8 tracking-wider">
              NO_DATA_FOUND · INITIALIZE_FIRST_RECORD
            </p>
            <Link
              to="/submit"
              className="inline-block px-8 py-4 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan rounded font-orbitron text-white font-bold tracking-wider hover:shadow-2xl hover:shadow-neon-purple/50 transition-all"
            >
              ◆ START_RECORDING
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

