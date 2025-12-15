import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
  wallet: {
    provider: any
    chainId: number | undefined
    accounts: string[]
    signer: any
    isConnected: boolean
    connect: () => Promise<void>
  }
  fhevm: {
    instance: any
    status: string
    error: Error | undefined
  }
}

export default function Layout({ children, wallet, fhevm }: LayoutProps) {
  const location = useLocation()

  const navigation = [
    { name: 'CONTROL', path: '/', icon: '⚡', color: 'from-purple-500 to-pink-500' },
    { name: 'RECORD', path: '/submit', icon: '◆', color: 'from-cyan-500 to-blue-500' },
    { name: 'HISTORY', path: '/history', icon: '▲', color: 'from-green-500 to-emerald-500' },
    { name: 'ANALYTICS', path: '/analytics', icon: '◇', color: 'from-pink-500 to-rose-500' },
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-cyber-bg relative overflow-hidden">
      {/* 背景网格和光效 */}
      <div className="fixed inset-0 bg-cyber-grid bg-grid opacity-30 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10 pointer-events-none"></div>
      
      {/* 顶部装饰线 */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-neon-purple to-transparent opacity-50 z-50"></div>

      {/* 顶部导航栏 - 赛博朋克风格 */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-morphism border-b border-neon-purple/30">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/5 via-transparent to-cyan-900/5"></div>
        <div className="scan-line absolute inset-0"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo - 科技感设计 */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-purple to-neon-pink blur-md opacity-50"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-neon-purple to-neon-pink rounded flex items-center justify-center text-white font-bold text-2xl transform rotate-45">
                  <span className="transform -rotate-45">⚡</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold font-orbitron bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan bg-clip-text text-transparent">
                  DRIVE_SCORE
                </h1>
                <p className="text-xs text-gray-400 font-rajdhani tracking-wider">QUANTUM ENCRYPTED</p>
              </div>
            </div>

            {/* 连接信息 - 科技面板风格 */}
            <div className="flex items-center space-x-3">
              {wallet.isConnected ? (
                <>
                  <div className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded backdrop-blur-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                    <span className="text-sm text-green-400 font-orbitron tracking-wider">
                      {wallet.accounts[0]?.slice(0, 4)}...{wallet.accounts[0]?.slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded backdrop-blur-sm">
                    <span className="text-xs text-cyan-400 font-orbitron">
                      {wallet.chainId === 31337 ? 'LOCAL' : wallet.chainId === 11155111 ? 'SEPOLIA' : `CHAIN:${wallet.chainId}`}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded backdrop-blur-sm border ${
                    fhevm.status === 'ready' 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}>
                    <span className={`text-xs font-orbitron ${
                      fhevm.status === 'ready' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      FHEVM:{fhevm.status.toUpperCase()}
                    </span>
                  </div>
                </>
              ) : (
                <button
                  onClick={wallet.connect}
                  className="relative px-6 py-3 bg-gradient-to-r from-neon-purple to-neon-pink rounded font-orbitron text-white text-sm tracking-wider overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-pink to-neon-purple opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <span className="relative">CONNECT_WALLET</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <div className="relative z-10 pt-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-12 gap-6">
          {/* 侧边栏导航 - 垂直科技面板 */}
          <aside className="col-span-12 lg:col-span-2">
            <nav className="lg:sticky lg:top-28 space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block relative group ${
                    isActive(item.path) ? 'nav-active' : ''
                  }`}
                >
                  <div className={`relative overflow-hidden ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r ' + item.color + ' p-[2px]'
                      : 'bg-cyber-border p-[1px]'
                  }`}>
                    <div className={`relative px-4 py-4 backdrop-blur-sm ${
                      isActive(item.path)
                        ? 'bg-cyber-card/80'
                        : 'bg-cyber-card/40 group-hover:bg-cyber-card/60'
                    }`}>
                      {isActive(item.path) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-scan"></div>
                      )}
                      <div className="flex items-center space-x-3">
                        <span className={`text-2xl ${
                          isActive(item.path)
                            ? 'text-transparent bg-gradient-to-r ' + item.color + ' bg-clip-text'
                            : 'text-gray-400 group-hover:text-gray-300'
                        }`}>
                          {item.icon}
                        </span>
                        <span className={`font-orbitron tracking-wider text-sm ${
                          isActive(item.path)
                            ? 'text-transparent bg-gradient-to-r ' + item.color + ' bg-clip-text font-bold'
                            : 'text-gray-400 group-hover:text-gray-300'
                        }`}>
                          {item.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isActive(item.path) && (
                    <div className={`absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b ${item.color} shadow-lg neon-glow`}></div>
                  )}
                </Link>
              ))}
            </nav>

            {/* 状态指示器 */}
            <div className="hidden lg:block mt-8 p-4 bg-cyber-card/40 border border-neon-purple/20 rounded backdrop-blur-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-orbitron">SYSTEM</span>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-orbitron">ENCRYPT</span>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-orbitron">SECURE</span>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </aside>

          {/* 主要内容区域 */}
          <main className="col-span-12 lg:col-span-10">
            <div className="relative">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-50 z-50"></div>

      {/* 页脚 */}
      <footer className="relative z-10 mt-12 py-6 border-t border-neon-purple/20 glass-morphism">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-400 font-rajdhani tracking-wider">
            <span className="text-neon-purple">FHEVM</span> QUANTUM ENCRYPTION · 
            <span className="text-neon-cyan mx-2">PRIVACY</span> PROTECTED · 
            <span className="text-neon-pink">SECURE</span> BY DESIGN
          </p>
        </div>
      </footer>

      {/* 角落装饰 */}
      <div className="fixed top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-neon-purple/30 pointer-events-none"></div>
      <div className="fixed top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-neon-pink/30 pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-neon-cyan/30 pointer-events-none"></div>
      <div className="fixed bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-neon-purple/30 pointer-events-none"></div>
    </div>
  )
}

