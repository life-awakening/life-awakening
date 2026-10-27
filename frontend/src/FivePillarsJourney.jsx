import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sprout, Dumbbell, Users, Flag, Flower2 } from 'lucide-react';

const PILLARS_DATA = [
  {
    id: 1,
    title: 'Agriculture',
    description: 'Sow the seeds of patience and connect with the earth.',
    image: '/agri.png',
    theme: {
      primary: '#ffffff',
      bg: '#047857', // Vibrant Emerald Green
      text: '#ffffff'
    }
  },
  {
    id: 2,
    title: 'Physical Wellness',
    description: 'Forge discipline and unlock your body\'s true energy.',
    image: '/phy.png',
    theme: {
      primary: '#ffffff',
      bg: '#dc2626', // Vibrant Crimson Red
      text: '#ffffff'
    }
  },
  {
    id: 3,
    title: 'Team Dynamics',
    description: 'Lead with empathy, collaborate with strength.',
    image: '/team.png',
    theme: {
      primary: '#ffffff',
      bg: '#1d4ed8', // Vibrant Royal Blue
      text: '#ffffff'
    }
  },
  {
    id: 4,
    title: 'Patriotism',
    description: 'Honor your heritage and serve the land that feeds you.',
    image: '/patri.png',
    theme: {
      primary: '#ffffff',
      bg: '#d97706', // Vibrant Gold-Amber
      text: '#ffffff'
    }
  },
  {
    id: 5,
    title: 'Spirituality',
    description: 'Still the mind to discover your ultimate purpose.',
    image: '/spri.png',
    theme: {
      primary: '#ffffff',
      bg: '#6d28d9', // Vibrant Violet Purple
      text: '#ffffff'
    }
  }
];

const IconMap = {
  Sprout: Sprout,
  Dumbbell: Dumbbell,
  Users: Users,
  Flag: Flag,
  Flower2: Flower2
};

const SLIDE_CONFIG = {
  1: {
    logoIcon: 'Sprout',
    title: 'Agriculture',
    subtitle: 'Sow the seeds of patience and connect with the earth.',
    illustration: '/a.png',
    btnColor: '#047857'
  },
  2: {
    logoIcon: 'Dumbbell',
    title: 'Physical Wellness',
    subtitle: 'Forge discipline and unlock your body\'s true energy.',
    illustration: '/phys.png',
    btnColor: '#dc2626'
  },
  3: {
    logoIcon: 'Users',
    title: 'Team Dynamics',
    subtitle: 'Lead with empathy, collaborate with strength.',
    illustration: '/t.png',
    btnColor: '#1d4ed8'
  },
  4: {
    logoIcon: 'Flag',
    title: 'Patriotism',
    subtitle: 'Honor your heritage and serve the land that feeds you.',
    illustration: '/p.png',
    btnColor: '#d97706'
  },
  5: {
    logoIcon: 'Flower2',
    title: 'Spirituality',
    subtitle: 'Discover inner peace, clarity and a deeper connection with yourself.',
    illustration: '/s.png',
    btnColor: '#6d28d9'
  }
};

export default function FivePillarsJourney({
  onComplete,
  pillarStep,
  setPillarStep,
  isFinalRow,
  setIsFinalRow,
  showFinalMessage,
  setShowFinalMessage,
  showContinueButton,
  setShowContinueButton
}) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isHoveredBtn, setIsHoveredBtn] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // Preload all pillar images to prevent delay or blank flashes when clicking next
    const imagesToPreload = [
      '/a.png',
      '/phys.png',
      '/t.png',
      '/p.png',
      '/s.png'
    ];
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isSmallScreen = windowWidth < 600;

  const currentPillar = PILLARS_DATA[pillarStep - 1] || PILLARS_DATA[4];
  const activeTheme = currentPillar.theme;

  const R_mandala = isSmallScreen ? 60 : 90;

  const getPillarGradient = () => {
    if (isFinalRow) {
      return 'radial-gradient(circle at center, rgba(253, 224, 71, 0.22) 0%, rgba(109, 40, 217, 0.14) 40%, rgba(0, 0, 0, 0) 70%)';
    }
    const colorMap = {
      1: 'radial-gradient(circle at center, rgba(4, 120, 87, 0.3) 0%, rgba(4, 120, 87, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
      2: 'radial-gradient(circle at center, rgba(220, 38, 38, 0.3) 0%, rgba(220, 38, 38, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
      3: 'radial-gradient(circle at center, rgba(29, 78, 216, 0.3) 0%, rgba(29, 78, 216, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
      4: 'radial-gradient(circle at center, rgba(217, 119, 6, 0.3) 0%, rgba(217, 119, 6, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
      5: 'radial-gradient(circle at center, rgba(109, 40, 217, 0.3) 0%, rgba(109, 40, 217, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
    };
    return colorMap[pillarStep] || colorMap[5];
  };

  if (pillarStep >= 1 && pillarStep <= 5 && !isFinalRow) {
    const config = SLIDE_CONFIG[pillarStep];
    const LogoIcon = IconMap[config.logoIcon] || Flower2;

    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={isSpinning ? { opacity: 0 } : { opacity: 1 }}
        transition={isSpinning ? { duration: 0.8, delay: 0.8, ease: 'easeInOut' } : { duration: 0.5 }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isSmallScreen ? '45px 20px 25px' : '70px 48px 45px',
          backgroundColor: '#000000',
          color: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          overflow: 'hidden',
          zIndex: 100
        }}
      >
        {/* Top Content (Icon, Title, Line, Subtitle) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
            maxWidth: '560px',
            zIndex: 10,
            marginTop: '5px'
          }}
        >
          {/* Top Logo Icon */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12 }}
            style={{
              color: config.btnColor,
              marginBottom: isSmallScreen ? '14px' : '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <LogoIcon size={isSmallScreen ? 44 : 58} strokeWidth={1.25} />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.1 }}
            style={{
              fontSize: isSmallScreen ? '36px' : '48px',
              fontWeight: '400',
              margin: '0 0 10px 0',
              letterSpacing: '0.5px',
              color: '#ffffff'
            }}
          >
            {config.title}
          </motion.h2>

          {/* Short elegant divider line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              width: '24px',
              height: '1.5px',
              backgroundColor: config.btnColor,
              marginBottom: isSmallScreen ? '14px' : '20px',
              transformOrigin: 'center'
            }}
          />

          {/* Subtitle / Description */}
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.25 }}
            style={{
              fontSize: isSmallScreen ? '14.5px' : '17px',
              fontWeight: '300',
              lineHeight: '1.45',
              color: 'rgba(255, 255, 255, 0.65)',
              margin: 0,
              maxWidth: isSmallScreen ? '290px' : '450px'
            }}
          >
            {config.subtitle}
          </motion.p>
        </div>

        {/* Middle Section (Center image + glowing background gradient) */}
        <div
          style={{
            flex: 1,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            zIndex: 2,
            margin: isSmallScreen ? '8px 0' : '15px 0',
            overflow: 'visible',
            transform: isSmallScreen ? 'translateY(-40px)' : 'none'
          }}
        >
          {/* Radial glow centered directly behind the image */}
          <div
            style={{
              position: 'absolute',
              width: isSmallScreen ? '420px' : '750px',
              height: isSmallScreen ? '420px' : '750px',
              background: `radial-gradient(circle, ${config.btnColor}df 0%, ${config.btnColor}59 35%, ${config.btnColor}14 65%, rgba(0, 0, 0, 0) 85%)`,
              borderRadius: '50%',
              filter: isSmallScreen ? 'blur(40px)' : 'blur(60px)',
              pointerEvents: 'none',
              zIndex: 1,
              opacity: 0.95
            }}
          />

          {/* Illustration/Photo of the meditating guy or other pillars */}
          {(() => {
            const imageScales = {
              mobile: {
                '/a.png': 1.25,      // little big
                '/phys.png': 1.25,   // little big
                '/t.png': 0.85,      // little small
                '/p.png': 0.85,      // little small
                '/s.png': 1.65       // big (to compensate for transparency)
              },
              desktop: {
                '/a.png': 1.0,
                '/phys.png': 1.0,
                '/t.png': 1.0,
                '/p.png': 1.0,
                '/s.png': 0.8        // little small
              }
            };
            const targetScale = isSmallScreen
              ? (imageScales.mobile[config.illustration] || 1.0)
              : (imageScales.desktop[config.illustration] || 1.0);
            return (
              <motion.img
                key={config.illustration}
                src={config.illustration}
                alt={config.title}
                initial={{ opacity: 0, scale: targetScale * 0.9 }}
                animate={{ opacity: 1, scale: targetScale }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                style={{
                  width: 'auto',
                  height: '100%',
                  maxHeight: isSmallScreen ? '52vh' : '55vh',
                  maxWidth: '98%',
                  objectFit: 'contain',
                  zIndex: 2,
                  filter: 'drop-shadow(0px 10px 30px rgba(0,0,0,0.5))',
                  transformOrigin: 'center center',
                  maskImage: config.illustration === '/t.png'
                    ? 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 15%, rgba(0, 0, 0, 1) 85%, rgba(0, 0, 0, 0) 100%)'
                    : 'none',
                  WebkitMaskImage: config.illustration === '/t.png'
                    ? 'linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 15%, rgba(0, 0, 0, 1) 85%, rgba(0, 0, 0, 0) 100%)'
                    : 'none'
                }}
              />
            );
          })()}
        </div>

        {/* Bottom Control Section (Center Dots & Absolute Next Button) */}
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 10,
            marginTop: '10px',
            height: '48px'
          }}
        >
          {/* Timeline Dots centered perfectly */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const isActive = idx === pillarStep - 1;
              return (
                <div
                  key={idx}
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isActive ? config.btnColor : '#4b5563',
                    boxShadow: isActive ? `0 0 8px ${config.btnColor}` : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
              );
            })}
          </div>

          {/* Next Button absolute-aligned to the right */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (isTransitioning) return;
              if (pillarStep < 5) {
                setIsTransitioning(true);
                setPillarStep((prev) => prev + 1);
                setTimeout(() => {
                  setIsTransitioning(false);
                }, 600);
              } else if (pillarStep === 5) {
                setIsTransitioning(true);
                setIsFinalRow(true);
                setShowFinalMessage(true);
                setTimeout(() => {
                  setIsTransitioning(false);
                }, 600);
              }
            }}
            style={{
              position: 'absolute',
              right: isSmallScreen ? '0px' : '12px',
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: config.btnColor,
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
            }}
          >
            <ChevronRight size={22} strokeWidth={2.5} />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={isSpinning ? { opacity: 0 } : { opacity: 1 }}
      transition={isSpinning ? { duration: 0.8, delay: 0.8, ease: 'easeInOut' } : { duration: 0.5 }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isSmallScreen ? '32px 16px' : '48px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        zIndex: 100
      }}
      className="no-scrollbar"
    >
      {/* Top spacer */}
      <div style={{ height: '20px' }} />

      {/* Constellation Curved Pathway / Mandala Grid */}
      <div
        style={{
          width: '100%',
          height: isSmallScreen ? '180px' : '260px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '16px 0',
          zIndex: 10,
          overflow: 'hidden'
        }}
      >
        {/* Glow Background behind the photos */}
        <div
          style={{
            position: 'absolute',
            width: isSmallScreen ? '240px' : '340px',
            height: isSmallScreen ? '240px' : '340px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: getPillarGradient(),
            filter: 'blur(55px)',
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'background 0.8s ease-in-out',
            opacity: 0.4
          }}
        />

        {/* Constellation Connecting Line (Hide when in final mandala row) */}
        {!isFinalRow && (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <path
              d="M 100 180 Q 300 100, 500 70 T 900 180"
              fill="none"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="2.5"
              strokeDasharray="6, 6"
            />
          </svg>
        )}

        {/* Rotate Mandala Container on Step 5 */}
        <motion.div
          animate={
            isSpinning
              ? { rotate: 1800 }
              : (isFinalRow ? { rotate: 360 } : { rotate: 0 })
          }
          transition={
            isSpinning
              ? { duration: 1.6, ease: [0.7, 0, 0.3, 1] }
              : (isFinalRow ? { repeat: Infinity, duration: 32, ease: 'linear' } : { duration: 0.5 })
          }
          style={{
            width: '100%',
            height: '100%',
            position: 'relative'
          }}
        >
          {PILLARS_DATA.map((pillar, index) => {
            const isCompleted = index < pillarStep - 1;
            const isActive = index === pillarStep - 1 && !isFinalRow;
            const isFuture = index > pillarStep - 1;

            // Compute arc coords
            const arcX = `${10 + index * 20}%`;
            const arcY = `${index === 0 || index === 4 ? '60%' : (index === 1 || index === 3 ? '33.3%' : '23.3%')}`;

            // Compute central mandala circle coordinates (R_mandala)
            const angle = index * 72 * (Math.PI / 180);
            const mandX = `calc(50% + ${Math.sin(angle) * R_mandala}px)`;
            const mandY = `calc(50% - ${Math.cos(angle) * R_mandala}px)`;

            return (
              <motion.div
                key={pillar.id}
                initial={{ opacity: 0, scale: isFinalRow ? 0.5 : (isActive ? 0.8 : 0.5) }}
                animate={{
                  scale: isFinalRow ? 0.9 : (isActive ? 1.25 : 0.85),
                  opacity: isFinalRow ? 1 : (isFuture ? 0.45 : 1),
                  x: '-50%',
                  y: '-50%',
                  rotate: isSpinning
                    ? -1800
                    : (isFinalRow ? -360 : 0)
                }}
                transition={{
                  scale: { type: 'spring', stiffness: 150, damping: 20 },
                  x: { type: 'spring', stiffness: 150, damping: 20 },
                  y: { type: 'spring', stiffness: 150, damping: 20 },
                  rotate: isSpinning
                    ? { duration: 1.6, ease: [0.7, 0, 0.3, 1] }
                    : (isFinalRow ? { repeat: Infinity, duration: 32, ease: 'linear' } : { duration: 0.5 })
                }}
                style={{
                  position: 'absolute',
                  left: isFinalRow ? mandX : arcX,
                  top: isFinalRow ? mandY : arcY,
                  width: isSmallScreen ? '52px' : '72px',
                  height: isSmallScreen ? '52px' : '72px',
                  zIndex: isActive ? 10 : 5,
                  cursor: isFinalRow ? 'default' : 'pointer',
                  transition: 'left 1s cubic-bezier(0.16, 1, 0.3, 1), top 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out'
                }}
                whileHover={isFinalRow ? {} : { scale: 1.3 }}
                onClick={() => {
                  if (!isFinalRow && index < pillarStep) {
                    setPillarStep(index + 1);
                  }
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `3.5px solid ${isActive ? '#ffffff' : (isCompleted ? 'rgba(255,255,255,0.7)' : 'transparent')}`,
                    boxShadow: isActive ? '0 8px 24px rgba(0,0,0,0.15)' : '0 4px 10px rgba(0,0,0,0.05)',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'border 0.8s ease'
                  }}
                >
                  <img
                    src={pillar.image}
                    alt={pillar.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Unified Central LTC Emblem in Mandala Mode (Moved outside to keep it still) */}
        <AnimatePresence>
          {isFinalRow && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 15, delay: 0.3 }}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: isSmallScreen ? '48px' : '68px',
                height: isSmallScreen ? '48px' : '68px',
                x: '-50%',
                y: '-50%',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.1)',
                border: '3px solid #ffd700',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}
            >
              <img src="/lg.png" alt="LTC Emblem" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Description Area */}
      <div
        style={{
          minHeight: '100px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          padding: '0 12px'
        }}
      >
        <AnimatePresence mode="wait">
          {!isFinalRow ? (
            <motion.div
              key={pillarStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ textAlign: 'center', maxWidth: '540px' }}
            >
              <h2
                style={{
                  fontSize: isSmallScreen ? '20px' : '28px',
                  fontWeight: '900',
                  color: 'inherit',
                  margin: '0 0 8px 0',
                  letterSpacing: '-0.8px'
                }}
              >
                {currentPillar.title}
              </h2>

              <p
                style={{
                  fontSize: isSmallScreen ? '15px' : '18px',
                  color: 'inherit',
                  opacity: 0.95,
                  margin: 0,
                  lineHeight: '1.4',
                  fontWeight: '600'
                }}
              >
                {currentPillar.description}
              </p>
            </motion.div>
          ) : (
            showFinalMessage && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ textAlign: 'center', maxWidth: '540px' }}
              >
                <h2
                  style={{
                    fontSize: isSmallScreen ? '18px' : '24px',
                    fontWeight: '900',
                    color: '#ffd700',
                    margin: '0 0 6px 0',
                    lineHeight: '1.3',
                    letterSpacing: '-0.6px'
                  }}
                >
                  Together, these five pillars shape your Life Awakening Journey.
                </h2>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Timeline Indicator & Pill Button */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          zIndex: 10
        }}
      >
        {/* Glow Timeline Dots */}
        {!isFinalRow && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const isCompleted = i < pillarStep - 1;
              const isActive = i === pillarStep - 1;
              return (
                <motion.div
                  key={i}
                  animate={{
                    scale: isActive ? 1.25 : 1,
                    backgroundColor: isActive
                      ? '#ffffff'
                      : (isCompleted ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.25)')
                  }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%'
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Action Button */}
        <AnimatePresence mode="wait">
          {(!isFinalRow || showContinueButton) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ position: 'relative' }}
              onMouseEnter={() => setIsHoveredBtn(true)}
              onMouseLeave={() => setIsHoveredBtn(false)}
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (isTransitioning) return;
                  if (showContinueButton) {
                    setIsTransitioning(true);
                    setIsSpinning(true);
                    setTimeout(() => {
                      onComplete();
                    }, 1600);
                  } else if (pillarStep < 5) {
                    setIsTransitioning(true);
                    setPillarStep((prev) => prev + 1);
                    setTimeout(() => {
                      setIsTransitioning(false);
                    }, 600);
                  } else if (pillarStep === 5 && !isFinalRow) {
                    setIsTransitioning(true);
                    setIsFinalRow(true);
                    setShowFinalMessage(true);
                    setTimeout(() => {
                      setIsTransitioning(false);
                    }, 600);
                  }
                }}
                style={{
                  background: showContinueButton
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : '#ffffff',
                  color: showContinueButton ? '#ffffff' : '#0f172a',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {showContinueButton ? (
                  <>
                    See Your Squad
                    <motion.span
                      animate={{ x: isHoveredBtn ? 4 : 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      style={{ display: 'inline-flex' }}
                    >
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </motion.span>
                  </>
                ) : (
                  <>
                    Next
                    <motion.span
                      animate={{ x: isHoveredBtn ? 3 : 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      style={{ display: 'inline-flex' }}
                    >
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </motion.span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
