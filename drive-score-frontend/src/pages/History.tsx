import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { DriveScoreLoggerABI, DriveScoreLoggerAddresses } from '../abi'
import { FhevmDecryptionSignature } from '../fhevm/FhevmDecryptionSignature'
import { GenericStringInMemoryStorage } from '../fhevm/GenericStringStorage'

interface HistoryProps {
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

interface Record {
  recordTime: number
  distanceCategory: number
  score: number | null
  encScore: string
}

export default function History({ wallet, fhevm }: HistoryProps) {
  const [records, setRecords] = useState<Record[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const storage = new GenericStringInMemoryStorage()

  const getContract = () => {
    if (!wallet.chainId || !wallet.signer) return null
    const chainIdStr = wallet.chainId.toString()
    const address = DriveScoreLoggerAddresses[chainIdStr as keyof typeof DriveScoreLoggerAddresses]
    if (!address || address.address === ethers.ZeroAddress) return null
    return new ethers.Contract(address.address, DriveScoreLoggerABI.abi, wallet.signer)
  }

  const loadRecords = async () => {
    if (!wallet.signer || !fhevm.instance) return
    
    setIsLoading(true)
    try {
      const contract = getContract()
      if (!contract) return

      const userAddress = await wallet.signer.getAddress()
      const recordCount = await contract.getRecordCount(userAddress)
      
      const loadedRecords: Record[] = []
      for (let i = 0; i < Number(recordCount); i++) {
        const [recordTime, distanceCategory, encScore] = await contract.getRecordByIndex(userAddress, i)
        loadedRecords.push({
          recordTime: Number(recordTime),
          distanceCategory: Number(distanceCategory),
          score: null,
          encScore: encScore,
        })
      }

      setRecords(loadedRecords.reverse())
    } catch (error) {
      console.error('Failed to load records:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const decryptScores = async () => {
    if (!wallet.signer || !fhevm.instance || records.length === 0) return
    
    setIsDecrypting(true)
    try {
      const contract = getContract()
      if (!contract) return

      const contractAddress = await contract.getAddress()
      const sig = await FhevmDecryptionSignature.loadOrSign(
        fhevm.instance,
        [contractAddress],
        wallet.signer,
        storage
      )

      if (!sig) return

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
            console.error('Decrypt error for record:', error)
            return record
          }
        })
      )

      setRecords(decryptedRecords)
    } catch (error) {
      console.error('Failed to decrypt scores:', error)
    } finally {
      setIsDecrypting(false)
    }
  }

  useEffect(() => {
    if (wallet.isConnected && fhevm.instance) {
      loadRecords()
    }
  }, [wallet.isConnected, fhevm.instance])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '.').replace(', ', '_')
  }

  const getDistanceInfo = (level: number) => {
    const info = [
      { icon: '?', name: 'UNKNOWN', color: 'from-gray-500 to-gray-600' },
      { icon: '◆', name: 'SHORT', color: 'from-cyan-500 to-blue-500' },
      { icon: '◇', name: 'MEDIUM', color: 'from-purple-500 to-pink-500' },
      { icon: '▲', name: 'LONG', color: 'from-green-500 to-emerald-500' },
    ]
    return info[level] || info[0]
  }

  const getScoreLevel = (score: number | null) => {
    if (score === null) return { emoji: '■', color: 'text-gray-600' }
    if (score >= 90) return { emoji: '⬢', color: 'text-green-400' }
    if (score >= 70) return { emoji: '◆', color: 'text-cyan-400' }
    if (score >= 50) return { emoji: '▲', color: 'text-yellow-400' }
    return { emoji: '▼', color: 'text-red-400' }
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
          <p className="text-gray-400 font-rajdhani text-lg tracking-wider">CONNECT_WALLET_TO_VIEW_HISTORY</p>
        </div>
      </div>
    )
  }

  const contractAvailable = getContract() !== null

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-cyan-600/20"></div>
        <div className="scan-line absolute inset-0"></div>
        <div className="relative glass-morphism border-2 border-neon-green/30 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-neon-green blur-xl opacity-50"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-neon-green to-emerald-600 rounded flex items-center justify-center text-4xl">
                  ▲
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-green to-emerald-400 bg-clip-text">
                  HISTORY_LOG
                </h1>
                <p className="text-gray-400 font-rajdhani tracking-wide">ENCRYPTED_DRIVE_RECORDS</p>
              </div>
            </div>
            
            {records.length > 0 && records.some(r => r.score === null) && (
              <button
                onClick={decryptScores}
                disabled={isDecrypting}
                className="relative px-6 py-3 bg-gradient-to-r from-neon-green to-emerald-500 rounded font-orbitron text-white text-sm tracking-wider overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-neon-green opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center space-x-2">
                  {isDecrypting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>DECRYPTING</span>
                    </>
                  ) : (
                    <span>◆ DECRYPT_ALL</span>
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

      {isLoading && contractAvailable && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-neon-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 font-rajdhani tracking-wider">LOADING_RECORDS...</p>
          </div>
        </div>
      )}

      {!isLoading && contractAvailable && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record, index) => {
            const distanceInfo = getDistanceInfo(record.distanceCategory)
            const scoreLevel = getScoreLevel(record.score)
            return (
              <div key={index} className="relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-card/50 to-cyber-card/30"></div>
                <div className="scan-line absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative glass-morphism border border-gray-600/30 group-hover:border-neon-purple/30 p-5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={`text-5xl ${scoreLevel.color}`}>
                        {scoreLevel.emoji}
                      </div>
                      <div className="flex-1">
                        <div className="font-orbitron text-gray-300 text-sm mb-1">{formatDate(record.recordTime)}</div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded text-xs font-orbitron text-transparent bg-gradient-to-r ${distanceInfo.color} bg-clip-text border border-gray-600/30`}>
                            {distanceInfo.icon} {distanceInfo.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-5xl font-bold font-orbitron ${
                        record.score !== null ? scoreLevel.color : 'text-gray-700'
                      }`}>
                        {record.score !== null ? record.score : '■■■'}
                      </div>
                      <div className="text-xs text-gray-600 font-rajdhani mt-1">
                        {record.score !== null ? 'SCORE' : 'ENCRYPTED'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && contractAvailable && records.length === 0 && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-pink-900/10 to-cyan-900/10"></div>
          <div className="scan-line absolute inset-0"></div>
          <div className="relative glass-morphism border-2 border-neon-purple/30 p-12 text-center">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-cyan blur-2xl opacity-30"></div>
              <div className="relative text-7xl">▲</div>
            </div>
            <h3 className="text-3xl font-bold font-orbitron text-transparent bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan bg-clip-text mb-4">
              NO_RECORDS_FOUND
            </h3>
            <p className="text-gray-400 font-rajdhani text-lg mb-8 tracking-wider">
              SYSTEM_EMPTY · SUBMIT_FIRST_RECORD
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

      {contractAvailable && records.length > 0 && (
        <>
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-green-600/10"></div>
            <div className="relative glass-morphism border border-green-500/30 p-6">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">🔐</div>
                <div>
                  <h4 className="font-orbitron text-green-400 tracking-wider mb-1">PRIVACY_PROTOCOL</h4>
                  <p className="text-sm text-green-300/70 font-rajdhani">
                    ALL_DATA_ENCRYPTED_ON_CHAIN · DECRYPT_WITH_YOUR_KEY_ONLY
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20"></div>
            <div className="relative glass-morphism border border-neon-purple/30 p-6">
              <h3 className="font-orbitron text-purple-400 tracking-wider mb-4">STATISTICS</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-3xl font-bold font-orbitron text-purple-400">{records.length}</div>
                  <div className="text-xs text-gray-500 font-rajdhani">TOTAL</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-orbitron text-green-400">
                    {records.filter(r => r.score !== null).length}
                  </div>
                  <div className="text-xs text-gray-500 font-rajdhani">DECRYPTED</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-orbitron text-cyan-400">
                    {records.filter(r => r.score !== null && r.score >= 90).length}
                  </div>
                  <div className="text-xs text-gray-500 font-rajdhani">EXCELLENT</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-orbitron text-pink-400">
                    {records.filter(r => r.distanceCategory === 3).length}
                  </div>
                  <div className="text-xs text-gray-500 font-rajdhani">LONG_DIST</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

