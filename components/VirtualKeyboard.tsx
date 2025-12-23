
import React, { useState, useEffect } from 'react';

interface KeyProps {
  label: string | React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'functional' | 'accent';
  className?: string;
}

const Key: React.FC<KeyProps> = ({ label, onClick, variant = 'default', className = '' }) => {
  const baseStyles = "h-9 rounded-md transition-all active:scale-95 active:opacity-70 flex items-center justify-center shadow-sm text-[13px] select-none border border-black/5";
  
  const variants = {
    default: "bg-white text-gray-800 font-medium",
    functional: "bg-[#e5e5e7] text-gray-600",
    accent: "bg-[#ff9d00] text-white font-bold"
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {label}
    </button>
  );
};

interface Props {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onCompositionUpdate: (text: string) => void; 
  onClose: () => void;
  onUserActivity?: () => void;
}

type KeyboardView = 'pinyin' | 'numeric';

const VirtualKeyboard: React.FC<Props> = ({ onKeyPress, onBackspace, onCompositionUpdate, onClose, onUserActivity }) => {
  const [pinyin, setPinyin] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<KeyboardView>('pinyin');
  const [isCaps, setIsCaps] = useState(false);

  // Layouts
  const pinyinRows = {
    r1: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    r2: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    r3: ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  };

  const numericRows = {
    r1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    r2: ['。', '，', '、', '？', '！', '：', '；', '“', '”', '（'],
    r3: ['）', '《', '》', '—', '…']
  };

  useEffect(() => {
    const fetchCandidates = async () => {
      if (!pinyin || view !== 'pinyin') {
        setCandidates([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(pinyin)}&itc=zh-t-i0-pinyin&num=11&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`);
        const data = await response.json();
        if (data && data[0] === 'SUCCESS' && data[1] && data[1][0]) {
          setCandidates(data[1][0][1]);
        } else {
          setCandidates([]);
        }
      } catch (error) {
        console.error("Pinyin API Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchCandidates, 120);
    return () => clearTimeout(timer);
  }, [pinyin, view]);

  const handleCharClick = (char: string) => {
    onUserActivity?.();
    onKeyPress(char);
    setPinyin('');
    onCompositionUpdate('');
    setCandidates([]);
    if (isCaps) setIsCaps(false);
  };

  const handleKeyPress = (char: string) => {
    onUserActivity?.();
    if (view === 'pinyin') {
      const nextPinyin = pinyin + (isCaps ? char.toUpperCase() : char.toLowerCase());
      setPinyin(nextPinyin);
      onCompositionUpdate(nextPinyin);
    } else {
      onKeyPress(char);
    }
  };

  const handleBackspaceInternal = () => {
    onUserActivity?.();
    if (pinyin.length > 0) {
      const nextPinyin = pinyin.slice(0, -1);
      setPinyin(nextPinyin);
      onCompositionUpdate(nextPinyin);
    } else {
      onBackspace();
    }
  };

  const handleSpace = () => {
    onUserActivity?.();
    if (candidates.length > 0) {
      handleCharClick(candidates[0]);
    } else if (pinyin) {
      onKeyPress(pinyin);
      setPinyin('');
      onCompositionUpdate('');
      if (isCaps) setIsCaps(false);
    } else {
      onKeyPress(' ');
    }
  };

  const handleActionClick = () => {
    onUserActivity?.();
    if (pinyin) {
      onKeyPress(pinyin);
      setPinyin('');
      onCompositionUpdate('');
      if (isCaps) setIsCaps(false);
    } else {
      onClose();
    }
  };

  const currentRows = view === 'pinyin' ? pinyinRows : numericRows;

  return (
    <div className="w-full flex flex-col gap-1 p-2 bg-[#f2f2f7]/95 backdrop-blur-3xl rounded-2xl mt-1 border border-white/20 select-none shadow-xl">
      
      {/* Candidate Bar - More Compact */}
      <div className="h-8 w-full flex items-center px-2 gap-3 overflow-x-auto scrollbar-hide border-b border-gray-200">
        <div className="flex gap-4 items-center">
          {isLoading && candidates.length === 0 ? (
            <div className="flex gap-1 opacity-40">
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            </div>
          ) : (
            candidates.map((c, i) => (
              <button 
                key={i} 
                className="text-[14px] font-normal text-gray-800 whitespace-nowrap active:scale-90 transition-transform px-1"
                onClick={() => handleCharClick(c)}
              >
                {c}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-1 w-full mt-1">
        {currentRows.r1.map(char => (
          <Key 
            key={char} 
            label={isCaps ? char.toUpperCase() : char.toLowerCase()} 
            onClick={() => handleKeyPress(char)} 
            className="flex-1" 
          />
        ))}
      </div>

      <div className="flex gap-1 w-full px-[3%]">
        {currentRows.r2.map(char => (
          <Key 
            key={char} 
            label={isCaps ? char.toUpperCase() : char.toLowerCase()} 
            onClick={() => handleKeyPress(char)} 
            className="flex-1" 
          />
        ))}
      </div>

      <div className="flex gap-1 w-full">
        <Key 
          label={<i className={`fas fa-arrow-up text-[10px] ${isCaps ? 'text-[#ff9d00]' : ''}`}></i>} 
          variant="functional" 
          onClick={() => {
            onUserActivity?.();
            setIsCaps(!isCaps);
          }} 
          className="w-[12%]" 
        />
        <div className="flex gap-1 flex-1">
          {currentRows.r3.map(char => (
            <Key 
              key={char} 
              label={isCaps ? char.toUpperCase() : char.toLowerCase()} 
              onClick={() => handleKeyPress(char)} 
              className="flex-1" 
            />
          ))}
        </div>
        <Key 
          label={<i className="fas fa-backspace text-xs"></i>} 
          variant="functional" 
          onClick={handleBackspaceInternal} 
          className="w-[12%]" 
        />
      </div>

      <div className="flex gap-1 w-full">
        <Key 
          label={view === 'pinyin' ? "123" : "拼音"} 
          variant="functional" 
          onClick={() => {
            onUserActivity?.();
            setView(view === 'pinyin' ? 'numeric' : 'pinyin');
          }} 
          className="w-[18%]" 
        />
        <Key 
          label="空格" 
          onClick={handleSpace} 
          className="flex-1 text-[12px] font-light text-gray-400" 
        />
        <Key 
          label={pinyin ? "确认" : "发送"} 
          variant="accent" 
          onClick={handleActionClick} 
          className="w-[20%] text-[12px]" 
        />
      </div>
    </div>
  );
};

export default VirtualKeyboard;
