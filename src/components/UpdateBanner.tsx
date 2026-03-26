import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

interface ProgressInfo {
  percent: number
}

interface UpdateInfo {
  version: string
}

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { updates?: typeof import('electron').ipcRenderer } }).electronAPI
    if (!api?.updates) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = api.updates as any

    u.onAvailable((info: UpdateInfo) => {
      setVersion(info.version)
      setState('available')
    })

    u.onProgress((info: ProgressInfo) => {
      setPercent(Math.round(info.percent))
      setState('downloading')
    })

    u.onDownloaded((info: UpdateInfo) => {
      setVersion(info.version)
      setState('ready')
    })
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white text-sm">
      {state === 'available' && (
        <>
          <Download className="w-4 h-4 shrink-0" />
          <span>Version <strong>{version}</strong> is available — downloading in background…</span>
          <button onClick={() => setDismissed(true)} className="ml-auto opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </>
      )}

      {state === 'downloading' && (
        <>
          <Download className="w-4 h-4 shrink-0 animate-pulse" />
          <span>Downloading update… {percent}%</span>
          <div className="flex-1 mx-2 h-1.5 bg-indigo-400 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}

      {state === 'ready' && (
        <>
          <RefreshCw className="w-4 h-4 shrink-0" />
          <span>Version <strong>{version}</strong> is ready — restart to install.</span>
          <button
            onClick={() => (window as unknown as { electronAPI?: { updates?: { install: () => void } } }).electronAPI?.updates?.install()}
            className="ml-auto px-3 py-0.5 bg-white text-indigo-700 rounded font-medium hover:bg-indigo-50 transition-colors"
          >
            Restart & Install
          </button>
          <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}
