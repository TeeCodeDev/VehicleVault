import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  MapPin,
  Fuel,
  SwitchCamera,
  RotateCw,
  Zap,
  ZapOff,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { compressImage } from '../utils/imageCompressor.js';
import { formatDisplayDate } from '../utils/format.js';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (data: {
    date?: string | null;
    liters: number | null;
    pricePerLiter: number | null;
    totalCost: number | null;
    receiptPath: string;
    station?: string | null;
    stationAddress?: string | null;
    fuelType?: string | null;
  }) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({ isOpen, onClose, onExtracted }) => {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [engineInfo, setEngineInfo] = useState<{ name: string; isAi: boolean } | null>(null);

  // Live Camera Viewfinder State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Fetch AI engine settings
  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('vv_token');
      fetch('/api/settings/ai', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.provider === 'gemini' && data.hasGeminiKey) {
            setEngineInfo({ name: `Google Gemini (${data.geminiModel || '3.8-flash'})`, isAi: true });
          } else if (data.provider === 'openai' && data.hasOpenaiKey) {
            setEngineInfo({ name: `OpenAI Vision (${data.openaiModel || 'gpt-4o-mini'})`, isAi: true });
          } else {
            setEngineInfo({ name: 'Tesseract OCR (Lokaal)', isAi: false });
          }
        })
        .catch(() => {
          setEngineInfo({ name: 'Tesseract OCR (Lokaal)', isAi: false });
        });
    }
  }, [isOpen]);

  // Clean stop for camera media stream
  const stopCameraStream = (activeStream?: MediaStream | null) => {
    const s = activeStream !== undefined ? activeStream : stream;
    if (s) {
      s.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  };

  // Start live camera stream
  const startCamera = async (targetFacing: 'environment' | 'user' = facingMode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'nl'
          ? 'Je browser ondersteunt geen directe cameratoegang. Gebruik bestand uploaden.'
          : 'Your browser does not support camera access. Please use file upload.'
      );
      return;
    }

    stopCameraStream();
    setCameraLoading(true);
    setCameraError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }

      // Check flashlight/torch capability
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const capabilities = videoTrack.getCapabilities() as any;
        setHasTorch(Boolean(capabilities?.torch));
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('[Camera] Failed to initialize camera:', err);
      setCameraError(
        lang === 'nl'
          ? 'Geen toegang tot camera. Controleer je permissies of gebruik de bestandskiezer.'
          : 'Camera access denied or unavailable. Please check permissions or upload a file.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Lifecycle for camera based on modal state and active tab
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !previewUrl) {
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, activeTab, previewUrl, facingMode]);

  // Reset state on modal close
  const handleClose = () => {
    stopCameraStream();
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setError(null);
    setCameraError(null);
    onClose();
  };

  // Switch facing camera (front <-> back)
  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
  };

  // Toggle flashlight / torch
  const handleToggleTorch = async () => {
    if (!stream || !hasTorch) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Torch constraint error:', e);
      }
    }
  };

  // Capture frame from live viewfinder video
  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const capturedFile = new File([blob], `tankbon_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        const compressed = await compressImage(capturedFile);
        setFile(compressed);
        setPreviewUrl(URL.createObjectURL(compressed));
        setOcrResult(null);
        setError(null);
        stopCameraStream();
      },
      'image/jpeg',
      0.9
    );
  };

  // Rotate preview 90 degrees clockwise
  const handleRotate90 = async () => {
    if (!previewUrl || !file) return;

    const img = new Image();
    img.src = previewUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const rotatedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        setFile(rotatedFile);
        setPreviewUrl(URL.createObjectURL(rotatedFile));
      },
      'image/jpeg',
      0.9
    );
  };

  // Retake photo / choose different file
  const handleRetake = () => {
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setError(null);
    if (activeTab === 'camera') {
      startCamera(facingMode);
    }
  };

  // File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const compressed = await compressImage(selected);
      setFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setOcrResult(null);
      setError(null);
    }
  };

  // Process receipt with OCR/AI
  const handleProcessOcr = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const token = localStorage.getItem('vv_token');
      const res = await fetch('/api/fuel/ocr', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to scan receipt');
      }

      const data = await res.json();
      setOcrResult(data);
    } catch (err: any) {
      setError(err?.message || 'OCR processing failed');
    } finally {
      setLoading(false);
    }
  };

  // Pass extracted data to parent form
  const handleApply = () => {
    if (ocrResult) {
      onExtracted({
        date: ocrResult.extracted?.date || null,
        liters: ocrResult.extracted?.liters ?? null,
        pricePerLiter: ocrResult.extracted?.pricePerLiter ?? null,
        totalCost: ocrResult.extracted?.totalCost ?? null,
        receiptPath: ocrResult.receiptPath,
        station: ocrResult.extracted?.station || null,
        stationAddress: ocrResult.extracted?.stationAddress || null,
        fuelType: ocrResult.extracted?.fuelType || null,
      });
      handleClose();
    }
  };

  const renderEngineBadge = () => {
    const engine = ocrResult?.extracted?.engine;
    if (engine === 'gemini') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          <span>Google Gemini AI</span>
        </span>
      );
    }
    if (engine === 'openai') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span>OpenAI Vision</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        <span>Tesseract OCR (Lokaal)</span>
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-950/70 flex items-center justify-center text-accent-600 dark:text-accent-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t('ocrReceiptScanner')}</h3>
                {engineInfo && (
                  <span
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      engineInfo.isAi
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {engineInfo.isAi ? <Sparkles className="w-2.5 h-2.5 text-indigo-500" /> : null}
                    <span>{engineInfo.name}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {lang === 'nl' ? 'Live viewfinder of upload voor automatische bonherkenning' : 'Live viewfinder or upload for instant receipt scanning'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (only shown before a photo is captured/selected) */}
        {!previewUrl && (
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg transition ${
                activeTab === 'camera'
                  ? 'bg-white dark:bg-slate-700 text-accent-600 dark:text-accent-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{lang === 'nl' ? 'Live Camera' : 'Live Camera'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setActiveTab('upload');
              }}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg transition ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-700 text-accent-600 dark:text-accent-400 shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{lang === 'nl' ? 'Bestand Uploaden' : 'Upload File'}</span>
            </button>
          </div>
        )}

        {/* Global Error message */}
        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3.5">
          {/* TAB 1: LIVE CAMERA VIEWFINDER */}
          {activeTab === 'camera' && !previewUrl && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner aspect-[3/4] max-h-[420px] flex items-center justify-center">
              {/* Camera Error / Permission Fallback */}
              {cameraError ? (
                <div className="p-6 text-center text-slate-300 max-w-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 mx-auto flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-rose-200 font-medium">{cameraError}</p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === 'nl' ? 'Opnieuw proberen' : 'Retry'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-3 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{lang === 'nl' ? 'Bestand kiezen' : 'Choose file'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Live Video Feed */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {cameraLoading && (
                    <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-accent-400" />
                      <span className="text-xs font-medium">{lang === 'nl' ? 'Camera starten...' : 'Starting camera...'}</span>
                    </div>
                  )}

                  {/* Viewfinder Receipt Bounding Box HUD */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
                    {/* Top alignment label */}
                    <div className="bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 shadow-sm mt-1">
                      {lang === 'nl' ? '📄 Plaats de tankbon binnen het kader' : '📄 Frame the receipt inside the box'}
                    </div>

                    {/* Receipt Target Framing Guide */}
                    <div className="relative w-4/5 h-[62%] border border-white/30 rounded-xl bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                      {/* 4 Corner Guides */}
                      <span className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-accent-400 rounded-tl-sm" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-accent-400 rounded-tr-sm" />
                      <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-accent-400 rounded-bl-sm" />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-accent-400 rounded-br-sm" />
                    </div>

                    {/* Bottom Controls Bar */}
                    <div className="w-full flex items-center justify-between px-6 pointer-events-auto pb-2">
                      {/* Torch Button */}
                      {hasTorch ? (
                        <button
                          type="button"
                          onClick={handleToggleTorch}
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition border ${
                            torchOn
                              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg'
                              : 'bg-black/50 hover:bg-black/80 text-white border-white/20'
                          }`}
                          title={lang === 'nl' ? 'Zaklamp aan/uit' : 'Toggle torch'}
                        >
                          {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
                        </button>
                      ) : (
                        <div className="w-11 h-11" />
                      )}

                      {/* Main Shutter Button */}
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        disabled={cameraLoading}
                        className="w-16 h-16 rounded-full bg-white p-1 shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition disabled:opacity-50"
                        title={lang === 'nl' ? 'Foto maken' : 'Take photo'}
                      >
                        <div className="w-13 h-13 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-accent-600 hover:bg-accent-700 transition" />
                        </div>
                      </button>

                      {/* Flip Camera Button */}
                      <button
                        type="button"
                        onClick={handleFlipCamera}
                        className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition"
                        title={lang === 'nl' ? 'Wissel camera' : 'Flip camera'}
                      >
                        <SwitchCamera className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD ZONE */}
          {activeTab === 'upload' && !previewUrl && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-accent-500 dark:hover:border-accent-500 rounded-2xl p-7 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/30">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="receipt-file-input"
              />
              <label htmlFor="receipt-file-input" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-accent-50 dark:bg-accent-950/50 text-accent-600 dark:text-accent-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {t('ocrDropzoneText')}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">JPG, PNG, WEBP of HEIC (max 15MB)</span>
              </label>
            </div>
          )}

          {/* PHOTO CAPTURED / LOADED PREVIEW & ACTIONS */}
          {previewUrl && (
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center max-h-[260px]">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-full max-h-[260px] object-contain"
                />
                <div className="absolute top-2 right-2 flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleRotate90}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm border border-white/10 transition text-xs flex items-center space-x-1 shadow-md"
                    title={lang === 'nl' ? 'Foto 90° draaien' : 'Rotate 90°'}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm border border-white/10 transition text-xs flex items-center space-x-1 shadow-md"
                    title={lang === 'nl' ? 'Opnieuw nemen' : 'Retake'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-semibold">{lang === 'nl' ? 'Opnieuw' : 'Retake'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{file?.name}</p>
                  <p className="text-slate-500 text-[11px]">{Math.round((file?.size || 0) / 1024)} KB geoptimaliseerd</p>
                </div>
                {!ocrResult && (
                  <button
                    type="button"
                    onClick={handleProcessOcr}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center space-x-1.5 transition disabled:opacity-50 shadow-sm shrink-0"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>
                      {loading
                        ? lang === 'nl'
                          ? 'Analyseren...'
                          : 'Analyzing...'
                        : lang === 'nl'
                        ? 'Start Bon Scan'
                        : 'Start Receipt Scan'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OCR PROCESSING SPINNER */}
          {loading && (
            <div className="flex items-center space-x-3 bg-accent-50 dark:bg-accent-950/40 border border-accent-200 dark:border-accent-800/60 p-3 rounded-xl text-xs text-accent-800 dark:text-accent-200">
              <Loader2 className="w-4 h-4 animate-spin text-accent-600 dark:text-accent-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block">
                  {engineInfo?.isAi
                    ? lang === 'nl'
                      ? `Tankbon analyseren met ${engineInfo.name}...`
                      : `Analyzing receipt with ${engineInfo.name}...`
                    : t('scanningReceipt')}
                </span>
                <span className="text-[11px] text-accent-600 dark:text-accent-400">
                  {lang === 'nl'
                    ? 'Datum, liters, bedragen en tankstation worden automatisch herkend...'
                    : 'Extracting date, liters, amounts, and station...'}
                </span>
              </div>
            </div>
          )}

          {/* OCR RESULT PREVIEW */}
          {ocrResult && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {lang === 'nl' ? 'Herkende Gegevens' : 'Recognized Data'}
                  </span>
                  {renderEngineBadge()}
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('ocrSuccess')}</span>
                </span>
              </div>

              {/* Warning if AI failed and fell back to local Tesseract */}
              {ocrResult.extracted?.aiError && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-bold block">
                        {lang === 'nl' ? 'AI Analyse mislukt (teruggevallen op lokale Tesseract OCR):' : 'AI Analysis failed (fell back to local OCR):'}
                      </span>
                      <span className="text-amber-800 dark:text-amber-300 font-mono text-[10px] break-all block mt-0.5">
                        {ocrResult.extracted.aiError}
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block">
                        {lang === 'nl'
                          ? 'Tip: Controleer je API-sleutel in Instellingen → AI Bonherkenning.'
                          : 'Tip: Check your API key in Settings → AI Receipt Scanner.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Station, Address and Fuel Type banner if detected */}
              {(ocrResult.extracted?.station || ocrResult.extracted?.stationAddress || ocrResult.extracted?.fuelType) && (
                <div className="flex flex-col gap-1 p-2.5 bg-accent-50/70 dark:bg-accent-950/40 border border-accent-100 dark:border-accent-900/40 rounded-lg text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ocrResult.extracted?.station && (
                      <span className="inline-flex items-center space-x-1 font-bold text-accent-900 dark:text-accent-200">
                        <MapPin className="w-3.5 h-3.5 text-accent-500" />
                        <span>{ocrResult.extracted.station}</span>
                      </span>
                    )}
                    {ocrResult.extracted?.station && ocrResult.extracted?.fuelType && (
                      <span className="text-accent-300 dark:text-accent-700">•</span>
                    )}
                    {ocrResult.extracted?.fuelType && (
                      <span className="inline-flex items-center space-x-1 text-accent-700 dark:text-accent-300 font-medium">
                        <Fuel className="w-3.5 h-3.5 text-accent-500" />
                        <span>{ocrResult.extracted.fuelType}</span>
                      </span>
                    )}
                  </div>
                  {ocrResult.extracted?.stationAddress && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 pl-4">
                      {ocrResult.extracted.stationAddress}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('date')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatDisplayDate(ocrResult.extracted?.date)}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('liters')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.liters ? `${ocrResult.extracted.liters} L` : '—'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('pricePerLiter')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.pricePerLiter ? `€ ${ocrResult.extracted.pricePerLiter}` : '—'}
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('totalCost')}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ocrResult.extracted?.totalCost ? `€ ${ocrResult.extracted.totalCost}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 mt-5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!ocrResult}
            className="px-4 py-1.5 bg-accent-600 text-white hover:bg-accent-700 rounded-lg text-xs font-semibold disabled:opacity-50 transition shadow-sm"
          >
            {lang === 'nl' ? 'Gegevens overnemen' : 'Apply values'}
          </button>
        </div>
      </div>
    </div>
  );
};
