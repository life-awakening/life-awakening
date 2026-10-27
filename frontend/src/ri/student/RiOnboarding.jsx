import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';

/**
 * RI Student Onboarding Experience
 * Pure Black Full-Screen Automated Cinematic Documentary
 * 
 * Desktop Images: rr-7.png, rr-6.png, rr-5.png, rr-9.png, rr-10.png
 * Mobile Images:  ri-m1.png, ri-m2.png, ri-m3.png, rr-9.png, rr-10.png
 * Logo: ri-logo.png (Pure White Filtered)
 * Music: paulyudin-motivation-motivation-music-573993.mp3
 * Final Screen: Smooth transition to Solid Green (#047857) with White Button
 */

export default function RiOnboarding({ onComplete }) {
  const TOTAL_SCREENS = 8;
  const [screen, setScreen] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [line2Revealed, setLine2Revealed] = useState(false);
  const [introTitleRevealed, setIntroTitleRevealed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  // Audio ref
  const audioRef = useRef(null);

  // Auto-advance timers
  const timerRef = useRef(null);
  const subTimerRef = useRef(null);

  // Touch handling for mobile swipe
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  // Resize listener for responsive image switching
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Audio lifecycle
  const startAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio('/paulyudin-motivation-motivation-music-573993.mp3');
      audio.loop = true;
      audio.volume = 0.55;
      audioRef.current = audio;
    }
    audioRef.current.muted = isMuted;
    audioRef.current.play().catch(err => {
      console.log('Audio autoplay awaiting user interaction:', err);
    });
  }, [isMuted]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
        if (!next && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    startAudio();
    return () => {
      stopAudio();
    };
  }, [startAudio, stopAudio]);

  // Clear pending timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (subTimerRef.current) clearTimeout(subTimerRef.current);
  }, []);

  // Screen navigation
  const goToScreen = useCallback((nextScreen) => {
    if (nextScreen === screen || isTransitioning) return;
    if (nextScreen < 1) return;
    if (nextScreen > TOTAL_SCREENS) {
      stopAudio();
      if (onComplete) onComplete();
      return;
    }

    clearTimers();
    setIsTransitioning(true);
    setLine2Revealed(false);

    setTimeout(() => {
      setScreen(nextScreen);
      setIsTransitioning(false);
    }, 450);
  }, [screen, isTransitioning, onComplete, clearTimers, stopAudio]);

  const handleNext = useCallback(() => {
    startAudio();
    if (screen < TOTAL_SCREENS) {
      goToScreen(screen + 1);
    } else {
      stopAudio();
      if (onComplete) onComplete();
    }
  }, [screen, goToScreen, onComplete, startAudio, stopAudio]);

  const handlePrev = useCallback(() => {
    if (screen > 1) {
      goToScreen(screen - 1);
    }
  }, [screen, goToScreen]);

  const handleSkip = useCallback(() => {
    goToScreen(TOTAL_SCREENS);
  }, [goToScreen]);

  const handleFinalEnter = useCallback(() => {
    stopAudio();
    if (onComplete) onComplete();
  }, [stopAudio, onComplete]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleSkip]);

  // Screen timing and automated slide progression
  useEffect(() => {
    clearTimers();
    setLine2Revealed(false);

    if (screen === 1) {
      subTimerRef.current = setTimeout(() => {
        setIntroTitleRevealed(true);
      }, 700);

      timerRef.current = setTimeout(() => {
        goToScreen(2);
      }, 3200);
    } else if (screen >= 2 && screen <= 6) {
      subTimerRef.current = setTimeout(() => {
        setLine2Revealed(true);
      }, 1000);

      timerRef.current = setTimeout(() => {
        goToScreen(screen + 1);
      }, 5500);
    } else if (screen === 7) {
      subTimerRef.current = setTimeout(() => {
        setLine2Revealed(true);
      }, 800);

      timerRef.current = setTimeout(() => {
        goToScreen(8);
      }, 4800);
    }

    return () => clearTimers();
  }, [screen, goToScreen, clearTimers]);

  // Touch gestures for mobile swipe
  const handleTouchStart = (e) => {
    startAudio();
    touchStartXRef.current = e.touches[0].clientX;
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartXRef.current - touchEndXRef.current;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Story config
  const storyData = {
    2: {
      image: isMobile ? '/ri-m1.png' : '/rr-7.png',
      locationDate: null,
      line1: 'Learn beyond the classroom.',
      line2: 'Learn from the villages.',
      alt: 'Rural immersion landscape'
    },
    3: {
      image: isMobile ? '/ri-m2.png' : '/rr-6.png',
      locationDate: null,
      line1: 'Understand the people.',
      line2: 'Understand their communities, culture and way of life.',
      alt: 'Rural people and community'
    },
    4: {
      image: isMobile ? '/ri-m3.png' : '/rr-5.png',
      locationDate: null,
      line1: 'Turn knowledge into action.',
      line2: 'Discover how knowledge, technology and ideas create meaningful solutions for rural communities.',
      alt: 'Rural village innovation'
    },
    5: {
      image: '/rr-9.png',
      locationDate: 'Mar 18, 2025 • A visit to Malwadi Village (Bhor)',
      line1: 'Live the village experience.',
      line2: 'Engage closely with local governance, grassroots institutions and real rural life.',
      alt: 'Visit to Malwadi Village Bhor'
    },
    6: {
      image: '/rr-10.png',
      locationDate: 'Mar 23, 2026 • A visit to Khadaki Village (Daund)',
      line1: 'Empower through ground reality.',
      line2: 'Bridge university research and rural needs through direct immersion.',
      alt: 'Visit to Khadaki Village Daund'
    }
  };

  const currentStory = storyData[screen];

  return (
    <div
      className={`ri-onboarding-container ${screen === 8 ? 'ri-bg-green-mode' : 'ri-bg-black-mode'}`}
      onClick={startAudio}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Top Floating Bar: Pure White RI Emblem & Controls ── */}
      <div className="ri-top-bar">
        <div className="ri-top-brand">
          <img src="/ri11.png" alt="Rural Immersion" onError={e => { e.currentTarget.src = '/ri-logo.png'; }} className="ri-top-logo ri-logo-white" />
        </div>

        <div className="ri-top-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="ri-audio-btn"
            aria-label={isMuted ? "Unmute Sound" : "Mute Sound"}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {screen < TOTAL_SCREENS && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSkip();
              }}
              className="ri-skip-button"
              aria-label="Skip to Dashboard"
            >
              <span>Skip</span>
              <ArrowRight size={13} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>

      {/* ── SCREEN 1: Black Intro ── */}
      {screen === 1 && (
        <div className={`ri-scene ri-scene-intro ${isTransitioning ? 'ri-fade-out' : 'ri-fade-in'}`}>
          <div className="ri-intro-content">
            <div className="ri-intro-logo-wrap">
              <img
                src="/ri11.png"
                alt="Rural Immersion Logo"
                onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
                className="ri-intro-ri-logo ri-logo-white"
              />
            </div>

            <div className={`ri-intro-programme-wrap ${introTitleRevealed ? 'ri-reveal-active' : ''}`}>
              <h1 className="ri-intro-programme-title">
                Rural Immersion Programme
              </h1>
              <div className="ri-intro-divider" />
              <p className="ri-intro-tagline">
                Experiential Learning • Grassroots Engagement • Nation Building
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREENS 2 to 6: Full View Photos (Desktop & Mobile, PURE BLACK, NO CARDS) ── */}
      {screen >= 2 && screen <= 6 && currentStory && (
        <div className={`ri-scene ri-scene-story ${isTransitioning ? 'ri-fade-out' : 'ri-fade-in'}`}>
          {/* Full-view photograph across the entire viewport */}
          <div className="ri-hero-visual-wrapper">
            <img
              src={currentStory.image}
              alt={currentStory.alt}
              className="ri-hero-image ri-ken-burns"
              key={currentStory.image}
            />
            {/* Cinematic top & bottom dark fade overlays */}
            <div className="ri-cinematic-gradient-top" />
            <div className="ri-cinematic-gradient-bottom" />
          </div>

          {/* Clean Editorial Floating Typography (NO CARDS) */}
          <div className={`ri-story-text-container ${screen >= 2 && screen <= 4 ? 'ri-story-text-elevated' : ''}`}>
            {currentStory.locationDate && (
              <div className="ri-story-date-tag">
                {currentStory.locationDate}
              </div>
            )}

            <h2 className="ri-story-headline">
              {currentStory.line1}
            </h2>

            <p className={`ri-story-subheadline ${line2Revealed ? 'ri-text-revealed' : ''}`}>
              {currentStory.line2}
            </p>
          </div>
        </div>
      )}

      {/* ── SCREEN 7: Emotional Climax ── */}
      {screen === 7 && (
        <div className={`ri-scene ri-scene-climax ${isTransitioning ? 'ri-fade-out' : 'ri-fade-in'}`}>
          <div className="ri-climax-content">
            <h1 className="ri-climax-statement">
              Connect India with Bharat.
            </h1>

            <div className={`ri-climax-sub-wrap ${line2Revealed ? 'ri-reveal-active' : ''}`}>
              <div className="ri-climax-divider" />
              <p className="ri-climax-supporting">
                Experience. Understand. Contribute.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 8: Final Enter CTA (Solid Green Canvas Transition with White Button) ── */}
      {screen === 8 && (
        <div className={`ri-scene ri-scene-cta ${isTransitioning ? 'ri-fade-out' : 'ri-fade-in'}`}>
          <div className="ri-cta-content">
            <h1 className="ri-cta-statement-white">
              Your Rural Immersion Journey Begins.
            </h1>

            <div className="ri-cta-divider-white" />

            <p className="ri-cta-supporting-white">
              Explore your RI experience, connect with your journey, and make your learning count.
            </p>

            <div className="ri-cta-button-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFinalEnter();
                }}
                className="ri-enter-dashboard-btn-white"
                autoFocus
              >
                <span>Enter RI Dashboard</span>
                <span className="ri-btn-arrow-green">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Base Container ── */
        .ri-onboarding-container {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          overflow: hidden;
          z-index: 99999;
          user-select: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          cursor: pointer;
          transition: background-color 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ri-bg-black-mode {
          background-color: #000000 !important;
        }

        .ri-bg-green-mode {
          background-color: #047857 !important;
        }

        /* ── Pure White Logo Filter ── */
        .ri-logo-white {
          filter: brightness(0) invert(1) drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5)) !important;
        }

        /* ── Top Bar ── */
        .ri-top-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: calc(env(safe-area-inset-top, 0px) + 24px) 36px 0 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 100;
          pointer-events: auto;
        }

        .ri-top-brand {
          display: flex;
          align-items: center;
          opacity: 0.95;
        }

        .ri-top-logo {
          height: 44px;
          width: auto;
          object-fit: contain;
        }

        .ri-top-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ri-audio-btn {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }

        .ri-audio-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.05);
          color: #ffffff;
        }

        .ri-skip-button {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f1f5f9;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 7px 18px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.03em;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }

        .ri-skip-button:hover {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
          transform: translateY(-1px);
        }

        /* ── Scenes ── */
        .ri-scene {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .ri-fade-in {
          opacity: 1;
          transform: scale(1);
        }

        .ri-fade-out {
          opacity: 0;
          transform: scale(0.988);
          pointer-events: none;
        }

        /* ── SCREEN 1: Black Intro ── */
        .ri-scene-intro {
          background: #000000;
          z-index: 50;
        }

        .ri-intro-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 680px;
          padding: 24px;
        }

        .ri-intro-logo-wrap {
          animation: riIntroLogoIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          margin-bottom: 24px;
        }

        .ri-intro-ri-logo {
          width: 150px;
          height: auto;
          object-fit: contain;
        }

        .ri-intro-programme-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0;
          transform: translateY(18px);
          filter: blur(6px);
          transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1), filter 1s ease;
        }

        .ri-intro-programme-wrap.ri-reveal-active {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }

        .ri-intro-divider {
          width: 56px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          margin: 28px 0 20px 0;
        }

        .ri-intro-programme-title {
          font-size: clamp(38px, 6.4vw, 72px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #ffffff;
          margin: 0;
          background: linear-gradient(180deg, #ffffff 30%, #e2e8f0 70%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: riClimaxStatementIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ri-intro-tagline {
          font-size: clamp(14px, 2vw, 18px);
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #94a3b8;
          margin: 0;
        }

        @keyframes riIntroLogoIn {
          0% { opacity: 0; transform: scale(0.92); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }

        /* ── SCREENS 2 to 6: Full-View Desktop & Mobile Photos ── */
        .ri-scene-story {
          background-color: #000000;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .ri-hero-visual-wrapper {
          position: absolute;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          pointer-events: none;
          overflow: hidden;
        }

        .ri-hero-image {
          width: 100vw;
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          object-fit: cover;
          object-position: center center;
          display: block;
          filter: brightness(0.92) contrast(1.04);
          transition: transform 7.5s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .ri-ken-burns {
          animation: riKenBurnsSlow 7.5s ease-out forwards;
        }

        @keyframes riKenBurnsSlow {
          0% {
            transform: scale(1.0);
          }
          100% {
            transform: scale(1.06) translateY(-8px);
          }
        }

        .ri-cinematic-gradient-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 140px;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%);
          pointer-events: none;
          z-index: 3;
        }

        .ri-cinematic-gradient-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 280px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.75) 45%, rgba(0, 0, 0, 0.3) 75%, transparent 100%);
          pointer-events: none;
          z-index: 3;
        }

        .ri-story-text-container {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 24px 64px 24px;
          margin: 0 auto;
          max-width: 920px;
          pointer-events: none;
        }

        .ri-story-date-tag {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #34d399;
          margin-bottom: 12px;
          text-shadow: 0 2px 14px rgba(0, 0, 0, 0.95);
          animation: riFadeDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ri-story-headline {
          font-size: clamp(30px, 4.6vw, 52px);
          font-weight: 750;
          letter-spacing: -0.025em;
          line-height: 1.15;
          color: #ffffff;
          margin: 0 0 12px 0;
          text-shadow: 0 4px 30px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.9);
          animation: riFadeUpText 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ri-story-subheadline {
          font-size: clamp(16px, 2.1vw, 22px);
          font-weight: 500;
          line-height: 1.5;
          color: #ffffff !important;
          margin: 0;
          max-width: 760px;
          text-shadow: 0 3px 24px rgba(0, 0, 0, 0.98), 0 2px 8px rgba(0, 0, 0, 0.95), 0 1px 2px #000000;
          opacity: 0;
          transform: translateY(14px);
          filter: blur(4px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s ease;
        }

        .ri-story-subheadline.ri-text-revealed {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }

        /* ── Elevated centered positioning for Screens 2-4 (rr-7, rr-6, rr-5 & ri-m1, ri-m2, ri-m3) ── */
        .ri-story-text-elevated {
          position: absolute !important;
          top: 57.5% !important;
          bottom: auto !important;
          left: 50% !important;
          right: auto !important;
          transform: translate(-50%, -50%) !important;
          width: calc(100% - 48px) !important;
          max-width: 900px !important;
          padding: 0 16px !important;
          margin: 0 !important;
          text-align: center !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 10 !important;
          pointer-events: none !important;
        }

        .ri-story-text-elevated .ri-story-headline {
          font-size: clamp(30px, 4.6vw, 52px) !important;
          font-weight: 800 !important;
          letter-spacing: -0.025em !important;
          line-height: 1.15 !important;
          color: #ffffff !important;
          margin: 0 0 14px 0 !important;
          text-align: center !important;
          text-shadow: 0 4px 32px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px #000000 !important;
        }

        .ri-story-text-elevated .ri-story-subheadline {
          font-size: clamp(16px, 2.2vw, 22px) !important;
          font-weight: 500 !important;
          line-height: 1.5 !important;
          color: #ffffff !important;
          max-width: 780px !important;
          margin: 0 auto !important;
          text-align: center !important;
          text-shadow: 0 3px 26px rgba(0, 0, 0, 0.98), 0 2px 10px rgba(0, 0, 0, 0.95), 0 1px 3px #000000 !important;
        }

        @keyframes riFadeDown {
          0% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes riFadeUpText {
          0% { opacity: 0; transform: translateY(20px); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        /* ── SCREEN 7: Climax Screen ── */
        .ri-scene-climax {
          background-color: #000000;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .ri-climax-content {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 920px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ri-climax-statement {
          font-size: clamp(38px, 6.4vw, 72px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #ffffff;
          margin: 0;
          background: linear-gradient(180deg, #ffffff 30%, #e2e8f0 70%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: riClimaxStatementIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ri-climax-sub-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0;
          transform: translateY(18px);
          filter: blur(5px);
          transition: opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), filter 0.9s ease;
        }

        .ri-climax-sub-wrap.ri-reveal-active {
          opacity: 1;
          transform: translateY(0);
          filter: blur(0);
        }

        .ri-climax-divider {
          width: 56px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          margin: 32px 0 24px 0;
        }

        .ri-climax-supporting {
          font-size: clamp(16px, 2.2vw, 22px);
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #94a3b8;
          margin: 0;
        }

        @keyframes riClimaxStatementIn {
          0% { opacity: 0; transform: scale(0.95) translateY(24px); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }

        /* ── SCREEN 8: Enter CTA (Smooth Transition to Solid Green Canvas) ── */
        .ri-scene-cta {
          background: transparent;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .ri-cta-content {
          position: relative;
          z-index: 10;
          text-align: center;
          max-width: 920px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: riClimaxStatementIn 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .ri-cta-statement-white {
          font-size: clamp(38px, 6.4vw, 72px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #ffffff;
          margin: 0;
          text-shadow: 0 4px 28px rgba(0, 0, 0, 0.3);
        }

        .ri-cta-divider-white {
          width: 56px;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
          margin: 30px 0 22px 0;
        }

        .ri-cta-supporting-white {
          font-size: clamp(15.5px, 2vw, 19px);
          font-weight: 400;
          line-height: 1.55;
          color: #f1f5f9;
          margin: 0 0 38px 0;
          max-width: 620px;
          text-shadow: 0 2px 14px rgba(0, 0, 0, 0.2);
        }

        .ri-cta-button-wrap {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        /* Pure White Button with Green Text on Solid Green Canvas */
        .ri-enter-dashboard-btn-white {
          background: #ffffff;
          color: #047857;
          border: 1px solid rgba(255, 255, 255, 0.9);
          padding: 16px 44px;
          border-radius: 9999px;
          font-size: 16px;
          font-weight: 750;
          letter-spacing: 0.02em;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.12);
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
        }

        .ri-enter-dashboard-btn-white:hover {
          background: #f8fafc;
          color: #065f46;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 22px 48px rgba(0, 0, 0, 0.3), 0 4px 14px rgba(0, 0, 0, 0.16);
        }

        .ri-enter-dashboard-btn-white:active {
          transform: translateY(0) scale(0.98);
        }

        .ri-btn-arrow-green {
          font-size: 18px;
          color: #047857;
          font-weight: 800;
          transition: transform 0.25s ease;
        }

        .ri-enter-dashboard-btn-white:hover .ri-btn-arrow-green {
          transform: translateX(4px);
        }

        /* ── Mobile Responsive ── */
        @media (max-width: 768px) {
          .ri-top-bar {
            padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px 0 20px;
          }

          .ri-top-logo {
            height: 34px;
          }

          .ri-intro-ri-logo {
            width: 120px;
          }

          .ri-intro-programme-title {
            font-size: 34px;
          }

          .ri-intro-tagline {
            font-size: 13px;
            letter-spacing: 0.14em;
          }

          .ri-story-text-elevated {
            width: calc(100% - 32px) !important;
            max-width: 440px !important;
            padding: 0 8px !important;
          }

          .ri-story-text-elevated .ri-story-headline {
            font-size: clamp(25px, 6.8vw, 30px) !important;
            margin-bottom: 10px !important;
          }

          .ri-story-text-elevated .ri-story-subheadline {
            font-size: clamp(14.5px, 4vw, 17px) !important;
            line-height: 1.46 !important;
            color: #ffffff !important;
          }

          .ri-story-text-container {
            padding: 0 20px 52px 20px;
          }

          .ri-story-date-tag {
            font-size: 11px;
            margin-bottom: 8px;
          }

          .ri-story-headline {
            font-size: 26px;
            margin-bottom: 10px;
          }

          .ri-story-subheadline {
            font-size: 15px;
          }

          .ri-climax-statement {
            font-size: 34px;
          }

          .ri-climax-supporting {
            font-size: 14px;
            letter-spacing: 0.16em;
          }

          .ri-cta-statement-white {
            font-size: 34px;
          }

          .ri-cta-supporting-white {
            font-size: 14.5px;
            margin-bottom: 28px;
          }

          .ri-enter-dashboard-btn-white {
            width: 100%;
            max-width: 320px;
            justify-content: center;
            padding: 14px 24px;
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
