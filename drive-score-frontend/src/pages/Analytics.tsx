import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DriveScoreLoggerABI, DriveScoreLoggerAddresses } from '../abi'
import { FhevmDecryptionSignature } from '../fhevm/FhevmDecryptionSignature'
import { GenericStringInMemoryStorage } from '../fhevm/GenericStringStorage'

interface AnalyticsProps {
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

interface ChartDataPoint {
  date: string
  score: number
  distanceCategory: number
}

export default function Analytics({ wallet, fhevm }: AnalyticsProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [stats, setStats] = useState({
    average: null as number | null,
    highest: null as number | null,
    lowest: null as number | null,
    trend: null as number | null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const storage = new GenericStringInMemoryStorage()

  const getContract = () => {
    if (!wallet.chainId || !wallet.signer) return null
    const chainIdStr = wallet.chainId.toString()
    const address = DriveScoreLoggerAddresses[chainIdStr as keyof typeof DriveScoreLoggerAddresses]
    if (!address || address.address === ethers.ZeroAddress) return null
    return new ethers.Contract(address.address, DriveScoreLoggerABI.abi, wallet.signer)
  }

  const loadAnalytics = async () => {
    if (!wallet.signer || !fhevm.instance) return
    
    setIsLoading(true)
    try {
      const contract = getContract()
      if (!contract) return

      const userAddress = await wallet.signer.getAddress()
      const contractAddress = await contract.getAddress()
      const recordCount = await contract.getRecordCount(userAddress)
      
      if (Number(recordCount) === 0) {
        setIsLoading(false)
        return
      }

      const records = []
      for (let i = 0; i < Number(recordCount); i++) {
        const [recordTime, distanceCategory, encScore] = await contract.getRecordByIndex(userAddress, i)
        records.push({
          recordTime: Number(recordTime),
          distanceCategory: Number(distanceCategory),
          encScore: encScore,
        })
      }

      const sig = await FhevmDecryptionSignature.loadOrSign(
        fhevm.instance,
        [contractAddress],
        wallet.signer,
        storage
      )

      if (!sig) {
        setIsLoading(false)
        return
      }

      const decryptedRecords = await Promise.all(
        records.map(async (record) => {
          try {
            const result = await fhevm.instance.userDecrypt(
              [{ handle: record.encScore, contractAddress }],
              sig.privateKey,
              sig.publicKey,
              sig.signature,
              sig.contractAddresses,
              sig.userAddress,
              sig.startTimestamp,
              sig.durationDays
            )
            return {
              ...record,
              score: Number(result[record.encScore]),
            }
          } catch (error) {
            return { ...record, score: 0 }
          }
        })
      )

      const data: ChartDataPoint[] = decryptedRecords.map(record => ({
        date: new Date(record.recordTime * 1000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace('/', '.'),
        score: record.score,
        distanceCategory: record.distanceCategory,
      }))

      setChartData(data)

      const scores = decryptedRecords.map(r => r.score)
      const average = scores.reduce((a, b) => a + b, 0) / scores.length
      const highest = Math.max(...scores)
      const lowest = Math.min(...scores)
      
      let trend = null
      if (scores.length >= 2) {
        trend = scores[scores.length - 1] - scores[scores.length - 2]
      }

      setStats({ average, highest, lowest, trend })
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (wallet.isConnected && fhevm.instance) {
      loadAnalytics()
    }
  }, [wallet.isConnected, fhevm.instance])

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
          <p className="text-gray-400 font-rajdhani text-lg tracking-wider">CONNECT_WALLET_TO_VIEW_ANALYTICS</p>
        </div>
      </div>
    )
  }

  const contractAvailable = getContract() !== null

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-cyan-600/20"></div>
        <div className="scan-line absolute inset-0"></div>
        <div className="relative glass-morphism border-2 border-neon-pink/30 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-neon-pink blur-xl opacity-50"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-neon-pink to-neon-purple rounded flex items-center justify-center text-4xl">
                  ◇
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-pink to-neon-purple bg-clip-text">
                  ANALYTICS_SYSTEM
                </h1>
                <p className="text-gray-400 font-rajdhani tracking-wide">DATA_VISUALIZATION_MODULE</p>
              </div>
            </div>
            
            {chartData.length > 0 && (
              <button
                onClick={loadAnalytics}
                disabled={isLoading}
                className="relative px-6 py-3 bg-gradient-to-r from-neon-pink to-neon-purple rounded font-orbitron text-white text-sm tracking-wider overflow-hidden group disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-pink opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center space-x-2">
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>LOADING</span>
                    </>
                  ) : (
                    <span>◇ REFRESH</span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!contractAvailable && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 animate-pulse"></div>
          <div className="relative glass-morphism border-2 border-red-500/50 p-6">
            <div className="flex items-start space-x-4">
              <div className="text-4xl">⚠</div>
              <div>
                <h3 className="text-xl font-bold font-orbitron text-red-400 mb-2">CONTRACT_NOT_DEPLOYED</h3>
                <p className="text-red-300/80 font-rajdhani">CHAIN_ID: {wallet.chainId || 'UNKNOWN'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && contractAvailable && chartData.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-neon-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 font-rajdhani tracking-wider">PROCESSING_DATA...</p>
          </div>
        </div>
      )}

      {!isLoading && contractAvailable && chartData.length > 0 && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20"></div>
              <div className="relative glass-morphism border-2 border-neon-purple/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">AVG</h3>
                  <span className="text-2xl">◆</span>
                </div>
                <p className="text-4xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-pink bg-clip-text">
                  {stats.average !== null ? stats.average.toFixed(1) : '--'}
                </p>
                <div className="h-1 bg-gradient-to-r from-neon-purple to-neon-pink opacity-30 mt-2"></div>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-emerald-600/20"></div>
              <div className="relative glass-morphism border-2 border-neon-green/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">HIGH</h3>
                  <span className="text-2xl">▲</span>
                </div>
                <p className="text-4xl font-bold font-orbitron text-green-400">
                  {stats.highest !== null ? stats.highest : '--'}
                </p>
                <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500 opacity-30 mt-2"></div>
              </div>
            </div>

            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-red-600/20"></div>
              <div className="relative glass-morphism border-2 border-orange-500/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">LOW</h3>
                  <span className="text-2xl">▼</span>
                </div>
                <p className="text-4xl font-bold font-orbitron text-orange-400">
                  {stats.lowest !== null ? stats.lowest : '--'}
                </p>
                <div className="h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-30 mt-2"></div>
              </div>
            </div>

            <div className={`relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${
                stats.trend === null ? 'from-gray-800/20 to-gray-700/20' :
                stats.trend > 0 ? 'from-green-600/20 to-emerald-600/20' :
                stats.trend < 0 ? 'from-red-600/20 to-orange-600/20' :
                'from-gray-800/20 to-gray-700/20'
              }`}></div>
              <div className={`relative glass-morphism border-2 ${
                stats.trend === null ? 'border-gray-600/30' :
                stats.trend > 0 ? 'border-green-500/30' :
                stats.trend < 0 ? 'border-red-500/30' :
                'border-gray-600/30'
              } p-6`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-gray-500 font-orbitron tracking-wider">TREND</h3>
                  <span className="text-2xl">
                    {stats.trend === null ? '▬' : stats.trend > 0 ? '▲' : stats.trend < 0 ? '▼' : '▬'}
                  </span>
                </div>
                <p className={`text-4xl font-bold font-orbitron ${
                  stats.trend === null ? 'text-gray-600' :
                  stats.trend > 0 ? 'text-green-400' :
                  stats.trend < 0 ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {stats.trend !== null ? `${stats.trend > 0 ? '+' : ''}${stats.trend}` : '--'}
                </p>
                <div className={`h-1 ${
                  stats.trend === null ? 'bg-gray-700' :
                  stats.trend > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                  stats.trend < 0 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                  'bg-gray-700'
                } opacity-30 mt-2`}></div>
              </div>
            </div>
          </div>

          {/* 评分趋势图 */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-purple-900/10 to-pink-900/10"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-cyan/30 p-6">
              <h2 className="text-xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text mb-6 flex items-center space-x-2">
                <span>◆</span>
                <span>SCORE_TREND</span>
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168, 85, 247, 0.2)" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontFamily: 'Orbitron' }} />
                  <YAxis domain={[0, 100]} stroke="#9ca3af" style={{ fontFamily: 'Orbitron' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(19, 19, 26, 0.95)', 
                      border: '2px solid #a855f7',
                      borderRadius: '8px',
                      color: '#e0e0ff',
                      fontFamily: 'Rajdhani'
                    }} 
                  />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontFamily: 'Orbitron' }} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#a855f7" 
                    strokeWidth={3}
                    name="SCORE"
                    dot={{ fill: '#a855f7', r: 5, strokeWidth: 2, stroke: '#ec4899' }}
                    activeDot={{ r: 7, fill: '#ec4899' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 里程分布图 */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-orange-900/10"></div>
            <div className="scan-line absolute inset-0"></div>
            <div className="relative glass-morphism border-2 border-neon-purple/30 p-6">
              <h2 className="text-xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-pink bg-clip-text mb-6 flex items-center space-x-2">
                <span>◇</span>
                <span>DISTANCE_DISTRIBUTION</span>
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168, 85, 247, 0.2)" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontFamily: 'Orbitron' }} />
                  <YAxis stroke="#9ca3af" style={{ fontFamily: 'Orbitron' }} />
                  <Tooltip 
                    formatter={(value) => {
                      const names = ['UNKNOWN', 'SHORT', 'MEDIUM', 'LONG']
                      return names[value as number] || 'UNKNOWN'
                    }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(19, 19, 26, 0.95)', 
                      border: '2px solid #a855f7',
                      borderRadius: '8px',
                      color: '#e0e0ff',
                      fontFamily: 'Rajdhani'
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontFamily: 'Orbitron' }} />
                  <Bar 
                    dataKey="distanceCategory" 
                    fill="url(#barGradient)"
                    name="CATEGORY"
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI洞察 */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-cyan-900/20"></div>
            <div className="relative glass-morphism border border-neon-purple/30 p-6">
              <h3 className="font-orbitron text-purple-400 tracking-wider mb-4 flex items-center space-x-2">
                <span>◆</span>
                <span>AI_INSIGHTS</span>
              </h3>
              <div className="space-y-2 text-sm text-gray-300 font-rajdhani">
                {stats.average !== null && stats.average >= 85 && (
                  <p>▸ EXCELLENT_PERFORMANCE · MAINTAIN_CURRENT_STANDARDS</p>
                )}
                {stats.average !== null && stats.average < 70 && (
                  <p>▸ IMPROVEMENT_REQUIRED · FOCUS_ON_SAFETY_PROTOCOLS</p>
                )}
                {stats.trend !== null && stats.trend > 0 && (
                  <p>▸ POSITIVE_TREND_DETECTED · CONTINUOUS_IMPROVEMENT</p>
                )}
                {stats.trend !== null && stats.trend < 0 && (
                  <p>▸ NEGATIVE_TREND_ALERT · ATTENTION_NEEDED</p>
                )}
                {chartData.filter(d => d.distanceCategory === 3).length > chartData.length * 0.5 && (
                  <p>▸ FREQUENT_LONG_DISTANCE · REST_RECOMMENDED</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!isLoading && contractAvailable && chartData.length === 0 && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-cyan-900/10"></div>
          <div className="scan-line absolute inset-0"></div>
          <div className="relative glass-morphism border-2 border-neon-purple/30 p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-cyan blur-2xl opacity-30"></div>
              <div className="relative text-7xl">◇</div>
            </div>
            <h3 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan bg-clip-text mb-4">
              NO_DATA_AVAILABLE
            </h3>
            <p className="text-gray-400 font-rajdhani text-lg mb-8 tracking-wider">
              MINIMUM_2_RECORDS_REQUIRED
            </p>
            <a
              href="/submit"
              className="inline-block px-8 py-4 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan rounded font-orbitron text-white font-bold tracking-wider hover:shadow-2xl hover:shadow-neon-purple/50 transition-all"
            >
              ◆ START_RECORDING
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

