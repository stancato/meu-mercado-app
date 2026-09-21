import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, RefreshCw, X, Zap, ZapOff } from 'lucide-react'

export function QrScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const streamRef = useRef(null)
  const scanningRef = useRef(true)
  const onScanRef = useRef(onScan)
  const scanLoopRef = useRef(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const handleCodeFound = useCallback((decodedUrl) => {
    scanningRef.current = false
    try {
      navigator?.vibrate?.(200)
    } catch {
      // Ignorar erro de vibração
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    onScanRef.current?.(decodedUrl)
  }, [])

  const scanLoop = useCallback(async () => {
    if (!scanningRef.current) return
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      if (scanningRef.current && scanLoopRef.current) {
        requestAnimationFrame(scanLoopRef.current)
      }
      return
    }

    try {
      // 1. Tentar com BarcodeDetector nativo se suportado
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(video)
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleCodeFound(barcodes[0].rawValue)
            return
          }
        } catch {
          // Fallback para jsQR se BarcodeDetector falhar
        }
      }

      // 2. Fallback via Canvas + jsQR
      const canvas = canvasRef.current || document.createElement('canvas')
      canvasRef.current = canvas
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (ctx && video.videoWidth && video.videoHeight) {
        const maxDim = 800
        const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight))
        const width = Math.floor(video.videoWidth * scale)
        const height = Math.floor(video.videoHeight * scale)

        canvas.width = width
        canvas.height = height
        ctx.drawImage(video, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })

        if (code && code.data) {
          handleCodeFound(code.data)
          return
        }
      }
    } catch {
      // Ignorar erros de frame individual
    }

    if (scanningRef.current && scanLoopRef.current) {
      requestAnimationFrame(scanLoopRef.current)
    }
  }, [handleCodeFound])

  useEffect(() => {
    scanLoopRef.current = scanLoop
  }, [scanLoop])

  // Listar câmeras disponíveis
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices()
      .then((devs) => {
        const videoDevs = devs.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevs)
        // Selecionar de preferência câmera traseira ("back", "environment" ou última da lista)
        const backCamera = videoDevs.find((d) => /back|traseira|environment|rear/i.test(d.label))
        if (backCamera) {
          setSelectedDeviceId(backCamera.deviceId)
        } else if (videoDevs.length > 0) {
          setSelectedDeviceId(videoDevs[videoDevs.length - 1].deviceId)
        }
      })
      .catch(() => {})
  }, [])

  // Inicializar câmera e stream
  useEffect(() => {
    scanningRef.current = true
    let isMounted = true

    async function startCamera() {
      setError('')
      setTorchOn(false)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Seu navegador não possui suporte para acesso à câmera.')
        return
      }

      // Parar stream anterior se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      const constraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          await videoRef.current.play()
        }

        // Verificar suporte a lanterna (torch)
        const track = stream.getVideoTracks()[0]
        if (track?.getCapabilities) {
          const caps = track.getCapabilities()
          setHasTorch(Boolean(caps.torch))
        }

        // Iniciar loop de escaneamento
        requestAnimationFrame(scanLoop)
      } catch (err) {
        if (!isMounted) return
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permissão de acesso à câmera negada. Permita o uso da câmera nas configurações do navegador.')
        } else {
          setError(`Não foi possível iniciar a câmera: ${err.message || 'Erro desconhecido'}`)
        }
      }
    }

    startCamera()

    return () => {
      isMounted = false
      scanningRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [selectedDeviceId, scanLoop])

  // Alternar lanterna
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track?.applyConstraints) return
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }],
      })
      setTorchOn(!torchOn)
    } catch {
      // Falha ao alternar lanterna
    }
  }

  // Alternar câmera (se houver mais de uma)
  const switchCamera = () => {
    if (devices.length <= 1) return
    const currentIndex = devices.findIndex((d) => d.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
  }

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-modal="true">
      <div className="qr-scanner-container">
        <div className="qr-scanner-header">
          <h3>Escanear QR Code da Nota</h3>
          <button type="button" className="qr-close-btn" onClick={onClose} title="Fechar câmera">
            <X size={22} />
          </button>
        </div>

        <div className="qr-video-viewport">
          <video ref={videoRef} className="qr-video-element" autoPlay playsInline muted />
          
          {/* Mira / Viewfinder */}
          <div className="qr-viewfinder">
            <div className="qr-viewfinder-corners" />
            <div className="qr-laser-line" />
          </div>

          {error && (
            <div className="qr-error-box">
              <Camera size={28} />
              <p>{error}</p>
              <button type="button" className="secondary" onClick={() => setSelectedDeviceId((prev) => prev)}>
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div className="qr-scanner-footer">
          <p>Posicione o QR Code impresso no cupom fiscal dentro da mira</p>
          <div className="qr-scanner-actions">
            {hasTorch && (
              <button
                type="button"
                className={`qr-action-btn ${torchOn ? 'active' : ''}`}
                onClick={toggleTorch}
                title={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
              >
                {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
                <span>Lanterna</span>
              </button>
            )}

            {devices.length > 1 && (
              <button
                type="button"
                className="qr-action-btn"
                onClick={switchCamera}
                title="Trocar câmera"
              >
                <RefreshCw size={20} />
                <span>Trocar câmera</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
