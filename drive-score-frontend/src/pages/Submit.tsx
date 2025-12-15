import { useState } from 'react'
import { ethers } from 'ethers'
import { DriveScoreLoggerABI, DriveScoreLoggerAddresses } from '../abi'

interface SubmitProps {
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

export default function Submit({ wallet, fhevm }: SubmitProps) {
  const [score, setScore] = useState<number>(85)
  const [distanceCategory, setDistanceCategory] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const getContract = () => {
    if (!wallet.chainId || !wallet.signer) return null
    const chainIdStr = wallet.chainId.toString()
    const address = DriveScoreLoggerAddresses[chainIdStr as keyof typeof DriveScoreLoggerAddresses]
    if (!address || address.address === ethers.ZeroAddress) return null
    return new ethers.Contract(address.address, DriveScoreLoggerABI.abi, wallet.signer)
  }

  const submitScore = async () => {
    if (!fhevm.instance || !wallet.signer) {
      setMessage({ type: 'error', text: 'FHEVM_NOT_READY | WALLET_NOT_CONNECTED' })
      return
    }

    if (score < 0 || score > 100) {
      setMessage({ type: 'error', text: 'SCORE_OUT_OF_RANGE [0-100]' })
      return
    }

    setIsSubmitting(true)
    setMessage({ type: 'info', text: 'ENCRYPTING_DATA...' })

    try {
      const contract = getContract()
      if (!contract) {
        setMessage({ type: 'error', text: 'CONTRACT_NOT_DEPLOYED' })
        return
      }

      const contractAddress = await contract.getAddress()
      const userAddress = await wallet.signer.getAddress()

      const input = fhevm.instance.createEncryptedInput(contractAddress, userAddress)
      input.add32(score)
      const enc = await input.encrypt()

      setMessage({ type: 'info', text: 'SUBMITTING_TO_BLOCKCHAIN...' })
      
      const tx = await contract.recordDriveScore(enc.handles[0], enc.inputProof, distanceCategory)
      
      setMessage({ type: 'info', text: `TX_HASH: ${tx.hash.slice(0, 10)}...` })

      await tx.wait()
      
      setMessage({ type: 'success', text: '✓ RECORD_SUBMITTED | DATA_ENCRYPTED_ON_CHAIN' })
    } catch (error: any) {
      console.error('Submit error:', error)
      setMessage({ type: 'error', text: `ERROR: ${error.message || 'UNKNOWN_ERROR'}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { text: 'EXCELLENT', color: 'from-green-400 to-emerald-400', emoji: '⬢' }
    if (score >= 70) return { text: 'GOOD', color: 'from-cyan-400 to-blue-400', emoji: '◆' }
    if (score >= 50) return { text: 'AVERAGE', color: 'from-yellow-400 to-orange-400', emoji: '▲' }
    return { text: 'POOR', color: 'from-red-400 to-rose-400', emoji: '▼' }
  }

  const getDistanceInfo = (level: number) => {
    const info = [
      { icon: '?', name: 'UNKNOWN', desc: 'NO_DISTANCE_DATA', color: 'from-gray-500 to-gray-600' },
      { icon: '◆', name: 'SHORT [0-20KM]', desc: 'URBAN_COMMUTE', color: 'from-cyan-500 to-blue-500' },
      { icon: '◇', name: 'MEDIUM [20-50KM]', desc: 'INTER_ZONE', color: 'from-purple-500 to-pink-500' },
      { icon: '▲', name: 'LONG [50KM+]', desc: 'LONG_DISTANCE', color: 'from-green-500 to-emerald-500' },
    ]
    return info[level] || info[0]
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
          <p className="text-gray-400 font-rajdhani text-lg tracking-wider">CONNECT_WALLET_TO_RECORD</p>
        </div>
      </div>
    )
  }

  const contractAvailable = getContract() !== null
  const scoreLevel = getScoreLevel(score)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20"></div>
        <div className="scan-line absolute inset-0"></div>
        <div className="relative glass-morphism border-2 border-neon-cyan/30 p-8">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="absolute inset-0 bg-neon-cyan blur-xl opacity-50"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-neon-cyan to-neon-blue rounded flex items-center justify-center text-4xl">
                ◆
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-cyan to-neon-blue bg-clip-text">
                RECORD_DRIVE_SCORE
              </h1>
              <p className="text-gray-400 font-rajdhani tracking-wide">QUANTUM_ENCRYPTED_DATA_SUBMISSION</p>
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
                  CHAIN_ID: {wallet.chainId || 'UNKNOWN'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提交表单 */}
      {contractAvailable && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-cyan-900/10"></div>
          <div className="scan-line absolute inset-0"></div>
          <div className="relative glass-morphism border-2 border-neon-purple/30 p-8 space-y-8">
            {/* 安全评分 */}
            <div>
              <label className="block text-sm font-orbitron text-gray-400 tracking-wider mb-4">
                SAFETY_SCORE [0-100]
              </label>
              
              {/* 评分显示 - 大型科技面板 */}
              <div className="relative overflow-hidden mb-6">
                <div className={`absolute inset-0 bg-gradient-to-r ${scoreLevel.color} opacity-20 blur-xl`}></div>
                <div className="relative glass-morphism border-2 border-gray-600/30 p-8 text-center">
                  <div className={`text-8xl mb-4 text-transparent bg-gradient-to-r ${scoreLevel.color} bg-clip-text font-orbitron font-bold`}>
                    {scoreLevel.emoji}
                  </div>
                  <div className={`text-6xl font-bold font-orbitron text-transparent bg-gradient-to-r ${scoreLevel.color} bg-clip-text mb-4`}>
                    {score}
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <div className={`h-1 w-16 bg-gradient-to-r ${scoreLevel.color}`}></div>
                    <div className={`text-lg font-orbitron text-transparent bg-gradient-to-r ${scoreLevel.color} bg-clip-text`}>
                      {scoreLevel.text}
                    </div>
                    <div className={`h-1 w-16 bg-gradient-to-r ${scoreLevel.color}`}></div>
                  </div>
                </div>
              </div>

              {/* 评分滑块 - 科技风格 */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-neon-purple"
                  style={{
                    background: `linear-gradient(to right, #a855f7 0%, #ec4899 ${score}%, #1f1f29 ${score}%, #1f1f29 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 font-orbitron mt-2">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>

              {/* 数字输入 */}
              <div className="mt-4 relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full px-6 py-4 bg-cyber-card border-2 border-neon-purple/30 rounded text-center text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple to-neon-pink bg-clip-text focus:border-neon-purple/50 focus:outline-none"
                />
              </div>
            </div>

            {/* 里程等级 */}
            <div>
              <label className="block text-sm font-orbitron text-gray-400 tracking-wider mb-4">
                DISTANCE_CATEGORY
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((level) => {
                  const info = getDistanceInfo(level)
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDistanceCategory(level)}
                      className={`relative overflow-hidden group ${
                        distanceCategory === level ? 'border-2' : 'border'
                      }`}
                      style={{
                        borderColor: distanceCategory === level ? 'var(--neon-purple)' : 'rgba(168, 85, 247, 0.2)'
                      }}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${info.color} ${
                        distanceCategory === level ? 'opacity-20' : 'opacity-0 group-hover:opacity-10'
                      } transition-opacity`}></div>
                      <div className={`relative glass-morphism p-4 ${
                        distanceCategory === level ? 'bg-cyber-card/80' : 'bg-cyber-card/40'
                      }`}>
                        <div className={`text-3xl mb-2 ${
                          distanceCategory === level
                            ? `text-transparent bg-gradient-to-r ${info.color} bg-clip-text`
                            : 'text-gray-500'
                        }`}>
                          {info.icon}
                        </div>
                        <div className={`font-orbitron text-sm mb-1 ${
                          distanceCategory === level
                            ? `text-transparent bg-gradient-to-r ${info.color} bg-clip-text font-bold`
                            : 'text-gray-500'
                        }`}>
                          {info.name}
                        </div>
                        <div className="text-xs text-gray-600 font-rajdhani">{info.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 隐私说明 */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-green-600/10"></div>
              <div className="relative glass-morphism border border-green-500/30 p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🔐</div>
                  <div>
                    <h4 className="font-orbitron text-green-400 tracking-wider mb-1">ENCRYPTION_PROTOCOL</h4>
                    <p className="text-sm text-green-300/70 font-rajdhani">
                      DATA_ENCRYPTED_WITH_FHEVM_QUANTUM_PROTECTION · ON_CHAIN_PRIVACY_GUARANTEED
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 提交按钮 */}
            <button
              onClick={submitScore}
              disabled={isSubmitting || fhevm.status !== 'ready'}
              className={`w-full py-5 font-orbitron font-bold tracking-wider text-lg relative overflow-hidden group ${
                isSubmitting || fhevm.status !== 'ready'
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/50'
                  : 'bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan border-2 border-transparent'
              }`}
            >
              <div className={`absolute inset-0 ${
                !(isSubmitting || fhevm.status !== 'ready')
                  ? 'bg-gradient-to-r from-neon-cyan via-neon-pink to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity'
                  : ''
              }`}></div>
              <span className="relative flex items-center justify-center space-x-2">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>SUBMITTING...</span>
                  </>
                ) : fhevm.status !== 'ready' ? (
                  <span>FHEVM_NOT_READY</span>
                ) : (
                  <span>◆ SUBMIT_RECORD</span>
                )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 消息提示 */}
      {message && (
        <div className={`relative overflow-hidden ${
          message.type === 'success' ? 'border-2 border-green-500/50' :
          message.type === 'error' ? 'border-2 border-red-500/50' :
          'border-2 border-cyan-500/50'
        }`}>
          <div className={`absolute inset-0 ${
            message.type === 'success' ? 'bg-green-600/10' :
            message.type === 'error' ? 'bg-red-600/10' :
            'bg-cyan-600/10'
          } animate-pulse`}></div>
          <div className="relative glass-morphism p-6">
            <p className={`font-rajdhani tracking-wider ${
              message.type === 'success' ? 'text-green-300' :
              message.type === 'error' ? 'text-red-300' :
              'text-cyan-300'
            }`}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {contractAvailable && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-cyan-600/10"></div>
          <div className="relative glass-morphism border border-cyan-500/30 p-6">
            <h4 className="font-orbitron text-cyan-400 tracking-wider mb-3 flex items-center space-x-2">
              <span>◆</span>
              <span>SYSTEM_INFO</span>
            </h4>
            <ul className="text-sm text-cyan-300/70 font-rajdhani space-y-2">
              <li>· ONE_SUBMISSION_PER_24H</li>
              <li>· CONTINUOUS_RECORDS_INCREASE_STREAK</li>
              <li>· HIGHER_SCORE_INDICATES_SAFER_DRIVING</li>
              <li>· DATA_VIEWABLE_IN_HISTORY_AND_ANALYTICS</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

