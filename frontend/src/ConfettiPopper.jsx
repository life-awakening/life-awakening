import React, { useEffect, useState, useRef } from 'react';
import lottie from 'lottie-web';
import confettiData from '../public/Confetti.json';

export default function ConfettiPopper({ triggerKey, onComplete }) {
  const [active, setActive] = useState(false);
  const containerRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!triggerKey) return;
    
    setActive(true);

    const frameId = requestAnimationFrame(() => {
      if (!containerRef.current) return;

      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }

      try {
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData: confettiData
        });
      } catch (e) {
        console.error('Error playing Confetti animation:', e);
      }
    });

    const timer = setTimeout(() => {
      setActive(false);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
      if (onComplete) onComplete();
    }, 2600);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [triggerKey, onComplete]);

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 999999,
        display: active ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '16px'
      }}
    >
      <div 
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
          maxWidth: '850px',
          maxHeight: '850px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />
    </div>
  );
}
