
import React, { useState, useEffect, useRef } from 'react';
import { Achievement, MirrorStatus, GestureType } from './types.ts';
import { geminiService, DEFAULT_AFFIRMATIONS } from './services/geminiService.ts';
import AchievementBarrage from './components/AchievementBarrage.tsx';
import GestureEffects from './components/GestureEffects.tsx';
import VirtualKeyboard from './components/VirtualKeyboard.tsx';

const App: React.FC = () => {
  const [status, setStatus] = useState<MirrorStatus>(MirrorStatus.STANDBY);
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const saved = localStorage.getItem('achievements');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [praise, setPraise] = useState<string>('');
  const [displayedPraise, setDisplayedPraise] = useState<string>('');
  const [isPraiseFading, setIsPraiseFading] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  
  const [confirmedText, setConfirmedText] = useState('');
  const [composition, setComposition] = useState('');
  const [interimStt, setInterimStt] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  
  const [isRecording, setIsRecording] = useState(false);
  const [activeGesture, setActiveGesture] = useState<GestureType>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const defaultAffirmationIdx = useRef(0);
  const lastGestureTime = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const cursorIndexRef = useRef(0);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('achievements', JSON.stringify(achievements));
  }, [achievements]);

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            setConfirmedText(prev => {
              const safeIndex = Math.min(cursorIndexRef.current, prev.length);
              const nextText = `${prev.slice(0, safeIndex)}${transcript}${prev.slice(safeIndex)}`;
              const nextCursorIndex = safeIndex + transcript.length;
              cursorIndexRef.current = nextCursorIndex;
              setCursorIndex(nextCursorIndex);
              return nextText;
            });
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimStt(interim);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const stopRecording = () => {
    isRecordingRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      if (typeof recognition.abort === 'function') {
        recognition.abort();
      } else {
        recognition.stop();
      }
    }
    setIsRecording(false);
    setInterimStt('');
  };

  const startRecording = () => {
    isRecordingRef.current = true;
    try {
      recognitionRef.current?.start();
      setIsRecording(true);
    } catch (e) {
      isRecordingRef.current = false;
    }
  };

  const handleInsertChar = (char: string) => {
    setConfirmedText(prev => {
      const safeIndex = Math.min(cursorIndexRef.current, prev.length);
      const nextText = `${prev.slice(0, safeIndex)}${char}${prev.slice(safeIndex)}`;
      const nextCursorIndex = safeIndex + char.length;
      cursorIndexRef.current = nextCursorIndex;
      setCursorIndex(nextCursorIndex);
      return nextText;
    });
    setComposition('');
  };

  const handleBackspace = () => {
    if (composition.length > 0) {
      setComposition(prev => prev.slice(0, -1));
    } else {
      setConfirmedText(prev => {
        if (cursorIndexRef.current <= 0) return prev;
        const safeIndex = Math.min(cursorIndexRef.current, prev.length);
        const nextText = `${prev.slice(0, safeIndex - 1)}${prev.slice(safeIndex)}`;
        const nextCursorIndex = safeIndex - 1;
        cursorIndexRef.current = nextCursorIndex;
        setCursorIndex(nextCursorIndex);
        return nextText;
      });
    }
  };

  const handleTextClick = () => {
    const nextCursorIndex = confirmedText.length;
    cursorIndexRef.current = nextCursorIndex;
    setCursorIndex(nextCursorIndex);
  };

  const handleCharacterClick = (index: number) => {
    const nextCursorIndex = Math.min(index, confirmedText.length);
    cursorIndexRef.current = nextCursorIndex;
    setCursorIndex(nextCursorIndex);
  };

  const handleBatchSubmit = async () => {
    const rawInput = (confirmedText + interimStt).trim();
    if (!rawInput) return;
    
    setIsInputOpen(false);
    
    const splitItems = await geminiService.parseAchievements(rawInput);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newEntries: Achievement[] = splitItems.map(text => ({
      id: Math.random().toString(36).substr(2, 9),
      text,
      date: dateStr
    }));

    setAchievements(prev => [...prev, ...newEntries]);
    
    const customPraise = await geminiService.generatePraise(newEntries, rawInput);
    
    setConfirmedText('');
    setComposition('');
    setInterimStt('');
    cursorIndexRef.current = 0;
    setCursorIndex(0);
    if (isRecordingRef.current) {
      stopRecording();
    }

    setPraise(customPraise);
  };

  useEffect(() => {
    const hands = new (window as any).Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (Date.now() - lastGestureTime.current < 2000) return;
        let detected: GestureType = null;
        const [handA, handB] = results.multiHandLandmarks;
        const distance = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
        const palmScale = (landmarks: any) => distance(landmarks[0], landmarks[9]);
        const isHeartGesture = (first: any, second: any) => {
          if (!first || !second) return false;
          const scale = (palmScale(first) + palmScale(second)) / 2;
          if (!scale) return false;
          const indexDist = distance(first[8], second[8]);
          const thumbDist = distance(first[4], second[4]);
          const wristsDist = distance(first[0], second[0]);
          const indexAboveThumb = first[8].y < first[4].y && second[8].y < second[4].y;
          return (
            indexAboveThumb &&
            indexDist < scale * 0.9 &&
            thumbDist < scale * 0.8 &&
            wristsDist < scale * 2.2
          );
        };

        if (results.multiHandLandmarks.length >= 2 && isHeartGesture(handA, handB)) {
          detected = 'heart';
        } else {
          results.multiHandLandmarks.forEach((landmarks: any) => {
            const isThumbUp = landmarks[4].y < landmarks[3].y && landmarks[4].y < landmarks[5].y;
            const isIndexUp = landmarks[8].y < landmarks[6].y;
            const isMiddleUp = landmarks[12].y < landmarks[10].y;
            if (isIndexUp && isMiddleUp && landmarks[16].y > landmarks[14].y) detected = 'victory';
            if (isThumbUp && !isIndexUp && !isMiddleUp) detected = 'thumbs_up';
          });
        }
        if (detected) {
          if (status === MirrorStatus.STANDBY) setStatus(MirrorStatus.ACTIVE);
          setActiveGesture(detected);
          lastGestureTime.current = Date.now();
          setTimeout(() => setActiveGesture(null), 3000);
        }
      }
    });
    handsRef.current = hands;
  }, [status]);

  useEffect(() => {
    let animationFrameId: number;
    const initCamera = async () => {
      if (isInputOpen || status === MirrorStatus.STANDBY) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            const step = async () => {
              if (videoRef.current && handsRef.current && status === MirrorStatus.ACTIVE && !isInputOpen) {
                try {
                  await handsRef.current.send({ image: videoRef.current });
                } catch (err) {
                  console.warn("Mediapipe frame dropped");
                }
              }
              animationFrameId = requestAnimationFrame(step);
            };
            step();
          };
        }
      } catch (e) {}
    };
    initCamera();
    return () => cancelAnimationFrame(animationFrameId);
  }, [status, isInputOpen]);

  useEffect(() => {
    if (praise) {
      setDisplayedPraise('');
      setIsPraiseFading(false);
      let i = 0;
      const timer = setInterval(() => {
        setDisplayedPraise(praise.slice(0, i + 1));
        i++;
        if (i >= praise.length) {
          clearInterval(timer);
          setTimeout(() => setIsPraiseFading(true), 2500);
          setTimeout(() => { 
            setDisplayedPraise(''); 
            setPraise(''); 
          }, 3500);
        }
      }, 70);
      return () => clearInterval(timer);
    }
  }, [praise]);

  useEffect(() => {
    if (status !== MirrorStatus.ACTIVE) return;
    const interval = setInterval(() => {
      if (!praise && !displayedPraise) {
        const text = DEFAULT_AFFIRMATIONS[defaultAffirmationIdx.current];
        defaultAffirmationIdx.current = (defaultAffirmationIdx.current + 1) % DEFAULT_AFFIRMATIONS.length;
        setPraise(text);
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [status, praise, displayedPraise]);

  const beforeText = confirmedText.slice(0, cursorIndex);
  const afterText = confirmedText.slice(cursorIndex);

  return (
    <div className="braun-frame">
      <div className={`camera-indicator ${status === MirrorStatus.ACTIVE ? 'on' : 'off'}`} />
      
      <div className="mirror-glass">
        <video
          ref={videoRef}
          autoPlay muted playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${status === MirrorStatus.STANDBY ? 'opacity-0 blur-3xl scale-110' : 'opacity-40 blur-0 scale-100'}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        
        <div className={`absolute inset-0 bg-[#3a4e69]/10 pointer-events-none transition-opacity duration-1000 ${status === MirrorStatus.ACTIVE ? 'opacity-100' : 'opacity-0'}`} />

        {status === MirrorStatus.ACTIVE && (
          <div className="relative w-full h-full p-6 flex flex-col">
            <AchievementBarrage achievements={achievements} isActive={true} />
            <div className="flex-1" />
            
            <div className="mb-16 min-h-[100px] flex items-center justify-center text-center px-4 z-10">
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-extralight tracking-tight text-white leading-tight transition-opacity duration-700 ${isPraiseFading ? 'opacity-0' : 'opacity-100'}`}>
                {displayedPraise}
              </h1>
            </div>

            {isInputOpen && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-black/40 backdrop-blur-sm">
                <div className="input-modal-container">
                  <div className="glass-modal rounded-[36px] p-4 sm:p-5 flex flex-col border border-white/60">
                    <div className="flex justify-between items-center mb-3 px-2">
                      <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Record a Victory</h3>
                      <button onClick={() => setIsInputOpen(false)} className="text-gray-400 p-1 hover:text-gray-700 transition-colors">
                        <i className="fas fa-times text-lg"></i>
                      </button>
                    </div>
                    
                    <div className="relative mb-3">
                      <div
                        className="braun-input w-full bg-white text-gray-900 overflow-y-auto text-base min-h-[80px] sm:min-h-[100px] p-4 relative whitespace-pre-wrap break-all shadow-sm rounded-2xl border border-gray-100"
                        onClick={handleTextClick}
                      >
                        {beforeText.split('').map((char, index) => (
                          <span
                            key={`before-${char}-${index}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCharacterClick(index + 1);
                            }}
                          >
                            {char}
                          </span>
                        ))}
                        <span className="input-caret" aria-hidden="true" />
                        {composition && (
                          <span
                            className="underline decoration-braun-accent decoration-2 underline-offset-4 font-medium animate-pulse"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCharacterClick(cursorIndex);
                            }}
                          >
                            {composition}
                          </span>
                        )}
                        {interimStt && (
                          <span
                            className="text-gray-400 italic"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCharacterClick(cursorIndex);
                            }}
                          >
                            {interimStt}
                          </span>
                        )}
                        {afterText.split('').map((char, index) => (
                          <span
                            key={`after-${char}-${index}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCharacterClick(cursorIndex + index + 1);
                            }}
                          >
                            {char}
                          </span>
                        ))}
                        {confirmedText === '' && !composition && !interimStt && (
                          <span className="text-gray-300 absolute left-4 top-4 italic font-light">捕捉你的高光时刻...</span>
                        )}
                      </div>
                      {isRecording && <div className="absolute top-4 right-4 flex items-center gap-2"><div className="w-2 h-2 bg-braun-accent rounded-full animate-ping"></div></div>}
                    </div>

                    <button 
                      className={`w-full py-2.5 rounded-[18px] flex items-center justify-center gap-2 mb-2 transition-all transform active:scale-95 ${isRecording ? 'bg-black text-white shadow-xl' : 'bg-gray-100 text-gray-700 shadow-sm'}`}
                      onClick={() => {
                        if (!isRecording) {
                          startRecording();
                        } else {
                          stopRecording();
                        }
                      }}
                    >
                      <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'} text-xs`}></i>
                      <span className="text-[10px] font-bold tracking-[0.15em]">{isRecording ? 'STOP' : 'VOICE INPUT'}</span>
                    </button>

                    <VirtualKeyboard 
                      onKeyPress={handleInsertChar}
                      onBackspace={handleBackspace}
                      onCompositionUpdate={setComposition}
                      onClose={handleBatchSubmit}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <GestureEffects gesture={activeGesture} />
      </div>

      <div className="physical-controls">
        <div className="flex flex-col items-center">
          <button className={`braun-button btn-power ${status === MirrorStatus.ACTIVE ? 'active' : ''}`} onClick={() => setStatus(status === MirrorStatus.ACTIVE ? MirrorStatus.STANDBY : MirrorStatus.ACTIVE)}>
            <i className="fas fa-power-off text-base"></i>
          </button>
          <div className="braun-label">Power</div>
        </div>
        <div className="flex flex-col items-center">
          <button className="braun-button btn-talk" onClick={() => setIsInputOpen(true)} disabled={status !== MirrorStatus.ACTIVE} style={{ opacity: status === MirrorStatus.ACTIVE ? 1 : 0.4 }}>
            <i className="fas fa-plus text-xl"></i>
          </button>
          <div className="braun-label">Record</div>
        </div>
      </div>
    </div>
  );
};

export default App;
