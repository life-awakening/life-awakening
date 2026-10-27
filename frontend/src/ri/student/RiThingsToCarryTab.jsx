import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  Printer,
  ChevronRight,
  Sun,
  Umbrella,
  Shirt,
  Footprints,
  HeartPulse,
  Sparkle,
  Package,
  FileCheck,
  Info
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'clothing',
    title: 'Clothing',
    icon: Shirt,
    badgeColor: '#ecfdf5',
    badgeText: '#047857',
    borderColor: '#a7f3d0',
    description: 'Practical, comfortable clothes for field activities and evening rest.',
    items: [
      { id: 'c1', label: '2–3 sets of sportswear / track suits for activities', mandatory: true, tip: 'Ideal for physical morning exercises, shramdaan & village survey walk.' },
      { id: 'c2', label: 'Casual wear for evenings', mandatory: true, tip: 'Comfortable cotton or modest casual attire for panel meetings & reflection.' }
    ]
  },
  {
    id: 'weather_gear',
    title: 'Weather Gear',
    icon: Sun,
    badgeColor: '#fef3c7',
    badgeText: '#b45309',
    borderColor: '#fde68a',
    description: 'Protection against fluctuating village temperatures, sun, and rain.',
    items: [
      { id: 'w1', label: 'Raincoat / umbrella for rain', mandatory: true, tip: 'Essential for unexpected showers during village immersion.' },
      { id: 'w2', label: 'Jacket / sweater for cool evenings', mandatory: true, tip: 'Village night temperatures drop significantly in rural belts.' },
      { id: 'w3', label: 'Cap / hat and sunglasses for sun', mandatory: true, tip: 'Protects during afternoon field visits and institutional surveys.' }
    ]
  },
  {
    id: 'footwear',
    title: 'Footwear',
    icon: Footprints,
    badgeColor: '#eff6ff',
    badgeText: '#1d4ed8',
    borderColor: '#bfdbfe',
    description: 'Durable, broken-in shoes for rigorous rural terrain and village walking.',
    items: [
      { id: 'f1', label: 'Comfortable sports shoes (carry 1 extra pair if possible)', mandatory: true, tip: 'Sturdy walking / running shoes suited for mud, unpaved roads and farms.' },
      { id: 'f2', label: 'Slippers / sandals for room use', mandatory: true, tip: 'Easy slip-ons for dormitory, washroom, and hostel premises.' }
    ]
  },
  {
    id: 'essentials',
    title: 'Essentials',
    icon: Package,
    badgeColor: '#f5f3ff',
    badgeText: '#6d28d9',
    borderColor: '#ddd6fe',
    description: 'Daily foundational wear to ensure hygiene throughout the 5 days.',
    items: [
      { id: 'e1', label: 'Socks (6–7 pairs)', mandatory: true, tip: 'Fresh pair every day to prevent blisters and odor during extended field walking.' },
      { id: 'e2', label: 'Handkerchiefs / napkins', mandatory: true, tip: 'Carry 3–4 clean cotton handkerchiefs or small hand towels.' }
    ]
  },
  {
    id: 'toiletries',
    title: 'Toiletries',
    icon: Sparkle,
    badgeColor: '#fdf2f8',
    badgeText: '#be185d',
    borderColor: '#fbcfe8',
    description: 'Personal hygiene kit; carry travel-size containers where feasible.',
    items: [
      { id: 't1', label: 'Toothbrush & toothpaste', mandatory: true, tip: 'Standard oral care kit.' },
      { id: 't2', label: 'Soap & shampoo / body wash', mandatory: true, tip: 'Biodegradable or travel-sized bottle recommended.' },
      { id: 't3', label: 'Comb & hair oil / hair brush', mandatory: false, tip: 'Personal grooming essentials.' },
      { id: 't4', label: 'Deodorant & moisturizer / body lotion', mandatory: false, tip: 'Prevents dry skin and keeps fresh.' },
      { id: 't5', label: 'Sunscreen lotion & mosquito repellent cream (Odomos)', mandatory: true, tip: 'Crucial for morning and evening field work in open fields.' },
      { id: 't6', label: 'Face towel & bath towel', mandatory: true, tip: 'Quick-dry microfiber towels are recommended.' }
    ]
  },
  {
    id: 'girls',
    title: 'Girls',
    icon: HeartPulse,
    badgeColor: '#fff1f2',
    badgeText: '#e11d48',
    borderColor: '#fecdd3',
    description: 'Specific health & hygiene provisions for female participants.',
    items: [
      { id: 'g1', label: 'Sanitary napkins (as required)', mandatory: true, tip: 'Carry adequate supply in waterproof zip-locks; medical shops in villages may be distant.' }
    ]
  },
  {
    id: 'other_items',
    title: 'Other Items',
    icon: Briefcase,
    badgeColor: '#f1f5f9',
    badgeText: '#334155',
    borderColor: '#cbd5e1',
    description: 'Mandatory documentation, stationery, and utility items.',
    items: [
      { id: 'o1', label: 'Refillable 1L water bottle', mandatory: true, tip: 'Stay hydrated; avoid single-use plastic bottles.' },
      { id: 'o2', label: 'Personal medicines (with prescription)', mandatory: true, tip: 'Carry prescribed doses for all 5 days + doctor note.' },
      { id: 'o3', label: 'Small first-aid kit (band-aids, ORS, antiseptic cream)', mandatory: true, tip: 'ORS packets and band-aids are highly recommended.' },
      { id: 'o4', label: 'School/college ID card (mandatory)', mandatory: true, tip: 'Must be worn at all times during immersion and transit.' },
      { id: 'o5', label: 'Small backpack for daily use', mandatory: true, tip: '10–15L daypack for notebook, water, camera/phone and sanitizer.' },
      { id: 'o6', label: 'Pocket diary and pen', mandatory: true, tip: 'Mandatory for real-time field notes, farmer interviews & Gram Panchayat visits.' },
      { id: 'o7', label: 'Plastic / zip-lock bags for wet clothes', mandatory: true, tip: 'Protects luggage from damp or soiled garments.' },
      { id: 'o8', label: 'Small torch / flashlight', mandatory: true, tip: 'Essential for low-light rural areas and nighttime village movements.' },
      { id: 'o9', label: 'Cloth bag for laundry', mandatory: false, tip: 'Keeps used clothes separate and organised.' }
    ]
  }
];

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function RiThingsToCarryTab({ isMobile = false, studentId = null, token = null }) {
  const effectiveStudentId = studentId || (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')?.id || null;
    } catch {
      return null;
    }
  })();
  const effectiveToken = token || localStorage.getItem('token') || '';

  const getStudentStorageKey = useCallback((sid) => {
    return sid ? `ri_student_packing_packed_user_${sid}` : null;
  }, []);

  const [packedMap, setPackedMap] = useState(() => {
    try {
      // Clean up legacy global shared key so it never leaks between accounts
      if (localStorage.getItem('ri_student_things_to_carry_packed_v1')) {
        localStorage.removeItem('ri_student_things_to_carry_packed_v1');
      }
      const key = effectiveStudentId ? `ri_student_packing_packed_user_${effectiveStudentId}` : null;
      if (key) {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : {};
      }
      return {};
    } catch {
      return {};
    }
  });

  const [savingStatus, setSavingStatus] = useState(''); // 'saving' | 'saved' | 'error' | ''
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Flattened all items list
  const allItems = useMemo(() => {
    return CATEGORIES.flatMap((c) => c.items.map((it) => ({ ...it, categoryId: c.id, categoryTitle: c.title })));
  }, []);

  const totalItemsCount = allItems.length;
  const packedItemsCount = useMemo(() => {
    return allItems.filter((it) => !!packedMap[it.id]).length;
  }, [allItems, packedMap]);

  const progressPercent = Math.round((packedItemsCount / totalItemsCount) * 100);

  // Fetch student-isolated packing checklist from backend API on mount or when student changes
  useEffect(() => {
    let isMounted = true;
    const fetchChecklist = async () => {
      if (!effectiveToken || !effectiveStudentId) return;

      // 1. Immediately sync local state to this specific student's storage cache
      const key = getStudentStorageKey(effectiveStudentId);
      if (key) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            setPackedMap(JSON.parse(cached));
          } else {
            setPackedMap({});
          }
        } catch {
          // Ignore localStorage parsing error
        }
      }

      // 2. Fetch authoritative database record for this authenticated student
      try {
        const res = await fetch(`${API}/api/ri/student/packing-checklist`, {
          headers: {
            'Authorization': `Bearer ${effectiveToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json && json.packed_items) {
            setPackedMap(json.packed_items);
            if (key) {
              try {
                localStorage.setItem(key, JSON.stringify(json.packed_items));
              } catch {
                // Ignore localStorage quota error
              }
            }
          }
        }
      } catch (err) {
        console.error('[ThingsToCarry] Failed to load student packing data:', err);
      }
    };

    fetchChecklist();
    return () => { isMounted = false; };
  }, [effectiveStudentId, effectiveToken, getStudentStorageKey]);

  // Sync to student-isolated backend & student-isolated localStorage
  const syncPackingState = useCallback(async (nextMap) => {
    // 1. Save to student-isolated localStorage
    const key = getStudentStorageKey(effectiveStudentId);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to cache packing list state', e);
      }
    }

    // 2. Persist to backend database for the authenticated student
    if (!effectiveToken || !effectiveStudentId) return;
    try {
      setSavingStatus('saving');
      const count = allItems.filter((it) => !!nextMap[it.id]).length;
      const percent = Math.round((count / totalItemsCount) * 100);

      const res = await fetch(`${API}/api/ri/student/packing-checklist`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          packed_items: nextMap,
          packed_count: count,
          total_count: totalItemsCount,
          progress_percent: percent
        })
      });

      if (res.ok) {
        setSavingStatus('saved');
        setTimeout(() => setSavingStatus(''), 2000);
      } else {
        setSavingStatus('error');
      }
    } catch (err) {
      console.error('[ThingsToCarry] Error saving packing checklist:', err);
      setSavingStatus('error');
    }
  }, [effectiveStudentId, effectiveToken, allItems, totalItemsCount, getStudentStorageKey]);

  // Toggle item packed status
  const togglePacked = (id) => {
    const next = {
      ...packedMap,
      [id]: !packedMap[id]
    };
    setPackedMap(next);
    syncPackingState(next);
  };

  // Mark all packed / clear all
  const handleMarkAll = () => {
    const next = {};
    allItems.forEach((it) => {
      next[it.id] = true;
    });
    setPackedMap(next);
    syncPackingState(next);
  };

  const handleReset = () => {
    if (window.confirm('Reset checklist? All packed checkmarks will be cleared for your account.')) {
      const next = {};
      setPackedMap(next);
      syncPackingState(next);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      if (activeCategory !== 'all' && cat.id !== activeCategory) {
        return null;
      }
      const matchingItems = cat.items.filter((it) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          it.label.toLowerCase().includes(q) ||
          (it.tip && it.tip.toLowerCase().includes(q)) ||
          cat.title.toLowerCase().includes(q)
        );
      });

      if (matchingItems.length === 0) return null;
      return { ...cat, items: matchingItems };
    }).filter(Boolean);
  }, [activeCategory, searchQuery]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px', boxSizing: 'border-box' }}>
      
      {/* ── PACKING PROGRESS & QUICK ACTION CARD ── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px' : '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        {/* Progress stats */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={18} color="#047857" />
              <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                Packing Readiness
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#047857' }}>
                {packedItemsCount} of {totalItemsCount} items packed ({progressPercent}%)
              </span>
              {savingStatus === 'saving' && (
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Saving...</span>
              )}
              {savingStatus === 'saved' && (
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <CheckCircle2 size={12} /> Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: isMobile ? 'space-between' : 'flex-end'
          }}
        >
          <button
            onClick={handleMarkAll}
            style={{
              flex: isMobile ? 1 : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: isMobile ? '8px 12px' : '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid #047857',
              backgroundColor: '#047857',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCheck size={14} />
            <span>{isMobile ? "Mark All" : "Mark All Packed"}</span>
          </button>

          <button
            onClick={handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: isMobile ? '8px 12px' : '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: isMobile ? '8px 12px' : '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>
      
      {/* ── SEARCH & CATEGORY FILTER TABS ── */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search items (e.g. sports shoes, medicine, water bottle, diary)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '12px', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pill selector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: isMobile ? '4px' : 0,
            whiteSpace: 'nowrap',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '700',
              border: activeCategory === 'all' ? '1px solid #047857' : '1px solid #e2e8f0',
              backgroundColor: activeCategory === 'all' ? '#047857' : '#ffffff',
              color: activeCategory === 'all' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
          >
            <span>All Categories</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '1px 6px',
                borderRadius: '9999px',
                backgroundColor: activeCategory === 'all' ? '#ecfdf5' : '#f1f5f9',
                color: activeCategory === 'all' ? '#047857' : '#64748b'
              }}
            >
              {totalItemsCount}
            </span>
          </button>
          {CATEGORIES.map((cat) => {
            const catPackedCount = cat.items.filter((it) => !!packedMap[it.id]).length;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? '700' : '600',
                  border: isSelected ? '1px solid #047857' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#047857' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <span>{cat.title}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    backgroundColor: isSelected ? '#ecfdf5' : '#f1f5f9',
                    color: isSelected ? '#047857' : '#64748b'
                  }}
                >
                  {catPackedCount}/{cat.items.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CATEGORY CARDS GRID (COMPACT, NO DEAD SPACES) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', alignItems: 'stretch' }}>
        {filteredCategories.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '36px 20px', textAlign: 'center' }}>
            <Package size={32} style={{ color: '#94a3b8', margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>No matching items found</div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Try changing your search term or select another category.</p>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const CatIcon = cat.icon;
            const catPacked = cat.items.filter((it) => !!packedMap[it.id]).length;
            const isCatComplete = catPacked === cat.items.length && cat.items.length > 0;

            return (
              <div
                key={cat.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: isCatComplete ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* Category Header */}
                <div
                  style={{
                    padding: isMobile ? '12px 14px' : '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        color: cat.badgeText,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <CatIcon size={15} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {cat.title}
                        </h3>
                        {isCatComplete && (
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#047857', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px', border: '1px solid #86efac' }}>
                            All Packed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11.5px', fontWeight: '750', color: isCatComplete ? '#047857' : '#64748b' }}>
                    {catPacked} / {cat.items.length} packed
                  </div>
                </div>

                {/* Items List */}
                <div style={{ flex: 1, backgroundColor: '#ffffff' }}>
                  {cat.items.map((item, idx) => {
                    const isPacked = !!packedMap[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => togglePacked(item.id)}
                        style={{
                          padding: isMobile ? '10px 14px' : '11px 16px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          cursor: 'pointer',
                          backgroundColor: '#ffffff',
                          borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ marginTop: '2px', flexShrink: 0 }}>
                          {isPacked ? (
                            <CheckCircle2 size={18} style={{ color: '#047857' }} />
                          ) : (
                            <Circle size={18} style={{ color: '#cbd5e1' }} />
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: isPacked ? '600' : '700',
                              color: isPacked ? '#64748b' : '#0f172a',
                              textDecoration: isPacked ? 'line-through' : 'none'
                            }}
                          >
                            {item.label}
                          </span>
                          {item.tip && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                              {item.tip}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── OFFICIAL DO'S & DON'TS GUIDANCE ── */}
      <div
        style={{
          marginTop: isMobile ? '20px' : '30px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '14px' : '18px'
        }}
      >
        {/* Do's Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', borderLeft: '4px solid #10b981', borderRadius: '14px', padding: isMobile ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} style={{ color: '#15803d' }} />
            </div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#15803d', margin: 0 }}>
              Important Guidelines (Do's)
            </h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Wear your official College/University ID Card around your neck at all times.</li>
            <li>Pack light and compact; prefer backpacks or soft duffel bags over hard trolley suitcases.</li>
            <li>Keep emergency medical prescriptions and personal contact cards in your pocket diary.</li>
            <li>Respect local village customs, attire norms, and host family cultural practices.</li>
            <li>Keep a dedicated cloth bag for soiled/wet clothes to maintain hygiene.</li>
          </ul>
        </div>

        {/* Don'ts Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: '14px', padding: isMobile ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} style={{ color: '#b91c1c' }} />
            </div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#b91c1c', margin: 0 }}>
              Prohibitions (Don'ts)
            </h3>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Do NOT carry expensive jewelry, excessive cash, or unnecessary high-value electronics.</li>
            <li>Do NOT bring single-use plastic bottles, packets, or disposable cutlery into the village.</li>
            <li>Do NOT wander away from the designated squad or village cluster after dusk.</li>
            <li>Do NOT consume food or water from unverified open road stalls outside host arrangements.</li>
            <li>Do NOT record audio/video of villagers or institutions without their polite consent.</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
