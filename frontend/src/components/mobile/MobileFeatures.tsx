import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, X, Check, AlertCircle, Zap } from 'lucide-react';

interface MobileReceiptCaptureProps {
  onReceiptProcessed: (receiptData: any) => void;
  onError: (error: string) => void;
}

export const MobileReceiptCapture: React.FC<MobileReceiptCaptureProps> = ({
  onReceiptProcessed,
  onError
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [streamActive, setStreamActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if device supports camera
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasCamera = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  useEffect(() => {
    return () => {
      // Cleanup: stop camera stream when component unmounts
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setStreamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      onError('Unable to access camera. Please try uploading a photo instead.');
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setPreview(imageUrl);
        stopCamera();
        
        await processReceiptImage(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setPreview(imageUrl);
      processReceiptImage(file);
    }
  };

  const processReceiptImage = async (imageBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('receipt', imageBlob, 'receipt.jpg');

      const response = await fetch('/api/receipt/process', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to process receipt');
      }

      const receiptData = await response.json();
      onReceiptProcessed(receiptData.data);
      
    } catch (error) {
      console.error('Error processing receipt:', error);
      onError('Failed to process receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    setPreview(null);
    setIsProcessing(false);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  };

  return (
    <div className="mobile-receipt-capture">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <h2 className="text-lg font-semibold">Scan Receipt</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCaptureMode('camera')}
            className={`p-2 rounded ${captureMode === 'camera' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            disabled={!hasCamera}
          >
            <Camera size={20} />
          </button>
          <button
            onClick={() => setCaptureMode('upload')}
            className={`p-2 rounded ${captureMode === 'upload' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            <Upload size={20} />
          </button>
        </div>
      </div>

      {/* Camera/Upload Interface */}
      <div className="relative">
        {!preview && !isCapturing && (
          <div className="flex flex-col items-center justify-center h-96 bg-gray-50">
            {captureMode === 'camera' && hasCamera ? (
              <div className="text-center">
                <Camera size={64} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Take a photo of your receipt</p>
                <button
                  onClick={startCamera}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Start Camera
                </button>
              </div>
            ) : (
              <div className="text-center">
                <Upload size={64} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Upload a photo of your receipt</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium"
                >
                  Choose Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>
        )}

        {/* Camera View */}
        {isCapturing && (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-96 object-cover"
              playsInline
              muted
            />
            
            {/* Camera Controls */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button
                onClick={stopCamera}
                className="bg-red-500 text-white p-3 rounded-full"
              >
                <X size={24} />
              </button>
              <button
                onClick={capturePhoto}
                className="bg-white text-black p-4 rounded-full shadow-lg"
              >
                <Camera size={28} />
              </button>
            </div>

            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="h-full flex items-center justify-center">
                <div className="border-2 border-white border-dashed w-80 h-60 rounded-lg opacity-70"></div>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full h-96 object-cover"
            />
            
            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white p-6 rounded-lg text-center">
                  <Zap className="animate-pulse mx-auto mb-2" size={32} />
                  <p className="font-medium">Processing Receipt...</p>
                  <p className="text-sm text-gray-600">Extracting expense data</p>
                </div>
              </div>
            )}

            {/* Preview Controls */}
            {!isProcessing && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={resetCapture}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg"
                >
                  Retake
                </button>
                <button
                  onClick={() => processReceiptImage(new Blob())}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg"
                >
                  Use Photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Hidden Canvas for Image Processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Tips */}
      <div className="p-4 bg-blue-50 border-t">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Ensure good lighting and avoid shadows</li>
              <li>Capture the entire receipt in frame</li>
              <li>Keep the receipt flat and straight</li>
              <li>Make sure text is clear and readable</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Quick Expense Entry Component for Mobile
export const QuickExpenseEntry: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    '🥗 Groceries',
    '🏠 Household',
    '🧴 Personal Care',
    '🎉 Entertainment',
    '⛽ Gas',
    '🍕 Dining',
    '👕 Clothing',
    '💊 Health',
    '📚 Education',
    '🚗 Transport'
  ];

  const handleQuickAdd = async () => {
    if (!amount || !category) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          category: category.split(' ')[1], // Remove emoji
          description: 'Quick entry',
          purchase_date: new Date().toISOString(),
          store: 'Quick Entry'
        })
      });

      if (response.ok) {
        setAmount('');
        setCategory('');
        // Show success toast
      }
    } catch (error) {
      console.error('Error adding expense:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="quick-expense-entry bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Quick Add Expense</h3>
      
      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full pl-8 pr-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Category</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`p-2 text-sm rounded-lg border transition-colors ${
                category === cat
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleQuickAdd}
        disabled={!amount || !category || isSubmitting}
        className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Adding...' : 'Add Expense'}
      </button>
    </div>
  );
};

// Offline Support Hook
export const useOfflineSupport = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addPendingAction = (action: any) => {
    const actions = [...pendingActions, { ...action, id: Date.now() }];
    setPendingActions(actions);
    localStorage.setItem('pendingActions', JSON.stringify(actions));
  };

  const syncPendingActions = async () => {
    const storedActions = localStorage.getItem('pendingActions');
    if (storedActions) {
      const actions = JSON.parse(storedActions);
      
      for (const action of actions) {
        try {
          await executeAction(action);
        } catch (error) {
          console.error('Failed to sync action:', error);
        }
      }

      setPendingActions([]);
      localStorage.removeItem('pendingActions');
    }
  };

  const executeAction = async (action: any) => {
    switch (action.type) {
      case 'ADD_EXPENSE':
        return fetch('/api/expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(action.data)
        });
      
      case 'UPDATE_EXPENSE':
        return fetch(`/api/expenses/${action.data.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(action.data)
        });

      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  return {
    isOnline,
    pendingActions: pendingActions.length,
    addPendingAction
  };
};

// Push Notification Setup
export const setupPushNotifications = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
      });

      // Send subscription to server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(subscription)
      });

      return subscription;
    }
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }

  return null;
};

// Mobile App Install Prompt
export const MobileAppInstall: React.FC = () => {
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstall(false);
    }
  };

  if (!showInstall) return null;

  return (
    <div className="bg-blue-500 text-white p-4 flex items-center justify-between">
      <div>
        <p className="font-medium">Install App</p>
        <p className="text-sm opacity-90">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowInstall(false)}
          className="text-blue-200 hover:text-white"
        >
          Later
        </button>
        <button
          onClick={handleInstall}
          className="bg-white text-blue-500 px-4 py-2 rounded font-medium"
        >
          Install
        </button>
      </div>
    </div>
  );
};

// Enhanced Touch Gestures
export const useSwipeGestures = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const absDistanceX = Math.abs(distanceX);
    const absDistanceY = Math.abs(distanceY);

    // Determine swipe direction
    if (absDistanceX > absDistanceY) {
      // Horizontal swipe
      if (absDistanceX > minSwipeDistance) {
        if (distanceX > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    } else {
      // Vertical swipe
      if (absDistanceY > minSwipeDistance) {
        if (distanceY > 0) {
          onSwipeUp?.();
        } else {
          onSwipeDown?.();
        }
      }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};

// Haptic Feedback
export const useHapticFeedback = () => {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const lightTap = () => vibrate(10);
  const mediumTap = () => vibrate(20);
  const heavyTap = () => vibrate(50);
  const success = () => vibrate([10, 50, 10]);
  const error = () => vibrate([50, 50, 50]);

  return {
    lightTap,
    mediumTap,
    heavyTap,
    success,
    error
  };
};
