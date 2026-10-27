import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  MapPin,
  ExternalLink,
  Phone,
  Shield,
  ShieldAlert,
  Flame,
  Hospital,
  Building2,
  Navigation,
  Search,
  RefreshCw,
  Info,
  AlertCircle,
  User,
  X,
  Compass
} from 'lucide-react';

const API = API_BASE_URL;

const NATIONAL_EMERGENCY_CONTACTS = [
  { name: 'National Emergency', number: '112', desc: 'Police, Fire & Medical 24/7', icon: ShieldAlert, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', btnBg: '#dc2626' },
  { name: 'Ambulance / Medical', number: '108', desc: 'Government Free Medical EMRI', icon: Hospital, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', btnBg: '#059669' },
  { name: 'Police Helpline', number: '100', desc: 'State & Rural Police Control', icon: Shield, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', btnBtn: '#2563eb' },
  { name: 'Fire & Rescue', number: '101', desc: 'Emergency Fire Brigade', icon: Flame, color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', btnBg: '#ea580c' },
  { name: 'Women Helpline', number: '1091', desc: 'Women Safety & Support', icon: ShieldAlert, color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', btnBg: '#db2777' },
  { name: 'Disaster Helpline', number: '1070', desc: 'State Emergency Operations', icon: AlertCircle, color: '#475569', bg: '#f8fafc', border: '#e2e8f0', btnBg: '#334155' }
];

export default function RiVillageTab({ profileData, isMobile = false, apiEndpoint }) {
  const [loading, setLoading] = useState(true);
  const [servicesData, setServicesData] = useState([]);
  const [villageData, setVillageData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Fallback village object from student/faculty profile
  const baseVillage = profileData?.village || {};

  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }), [token]);

  const endpoint = apiEndpoint || `${API}/api/ri/student/village-services`;

  // Fetch cached services from backend
  const fetchVillageServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setServicesData(data.services || []);
        if (data.village) {
          setVillageData(data.village);
        }
      }
    } catch (err) {
      console.error('Failed to fetch village emergency services:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, endpoint]);

  useEffect(() => {
    setVillageData(null);
    fetchVillageServices();
  }, [fetchVillageServices]);

  const village = villageData || baseVillage;
  const villageName = village?.name || village?.village_name || 'Allocated Village';
  const villageTaluka = village?.taluka || village?.village_taluka || village?.location || village?.village_location || '';
  const villageDistrict = village?.district || village?.village_district || 'Pune';
  const mapsLink = village?.google_maps_link || '';

  const externalMapLink = useMemo(() => {
    if (mapsLink) return mapsLink;
    const q = `${villageName} ${villageTaluka} ${villageDistrict} Maharashtra`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [mapsLink, villageName, villageTaluka, villageDistrict]);

  // Group services by category and sort by closest distance
  const categorizedServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = (servicesData || [])
      .filter((srv) => {
        if (!q) return true;
        const matchName = (srv.name || '').toLowerCase().includes(q);
        const matchAddr = (srv.address || '').toLowerCase().includes(q);
        const matchType = (srv.type || '').toLowerCase().includes(q);
        return matchName || matchAddr || matchType;
      })
      .sort((a, b) => (parseFloat(a.distance_km) || 0) - (parseFloat(b.distance_km) || 0));

    const hospitals = filtered.filter((s) => {
      const cat = (s.category || '').toLowerCase();
      const type = (s.type || '').toLowerCase();
      return cat.includes('hospital') || cat.includes('clinic') || type.includes('health') || type.includes('hospital');
    });

    const police = filtered.filter((s) => {
      const cat = (s.category || '').toLowerCase();
      const type = (s.type || '').toLowerCase();
      return cat.includes('police') || type.includes('police') || type.includes('station');
    });

    const fire = filtered.filter((s) => {
      const cat = (s.category || '').toLowerCase();
      const type = (s.type || '').toLowerCase();
      return cat.includes('fire') || type.includes('fire') || type.includes('rescue');
    });

    const other = filtered.filter((s) => {
      return !hospitals.includes(s) && !police.includes(s) && !fire.includes(s);
    });

    return [
      {
        id: 'hospitals',
        title: 'Hospitals & Primary Health Centres (PHC)',
        shortTitle: 'Hospitals & PHC',
        icon: Hospital,
        color: '#0f766e',
        badgeBg: '#ecfdf5',
        badgeBorder: '#a7f3d0',
        items: hospitals
      },
      {
        id: 'police',
        title: 'Police Stations & Law Enforcement',
        shortTitle: 'Police',
        icon: Shield,
        color: '#1d4ed8',
        badgeBg: '#eff6ff',
        badgeBorder: '#bfdbfe',
        items: police
      },
      {
        id: 'fire',
        title: 'Fire & Rescue Services',
        shortTitle: 'Fire & Rescue',
        icon: Flame,
        color: '#c2410c',
        badgeBg: '#fff7ed',
        badgeBorder: '#fed7aa',
        items: fire
      },
      ...(other.length > 0 ? [{
        id: 'other',
        title: 'Other Essential Services',
        shortTitle: 'Other Services',
        icon: Building2,
        color: '#475569',
        badgeBg: '#f8fafc',
        badgeBorder: '#e2e8f0',
        items: other
      }] : [])
    ];
  }, [servicesData, searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return categorizedServices.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [categorizedServices]);

  // Categories to display based on active tab
  const displayedCategories = useMemo(() => {
    if (activeCategory === 'all') return categorizedServices;
    return categorizedServices.filter(c => c.id === activeCategory);
  }, [categorizedServices, activeCategory]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* ── 1. ALLOCATED VILLAGE HERO CARD ── */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: isMobile ? '18px 16px' : '24px 28px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 6px 16px -4px rgba(15,23,42,0.03)'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: isMobile ? '44px' : '52px',
                height: isMobile ? '44px' : '52px',
                borderRadius: '12px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#047857'
              }}
            >
              <MapPin size={isMobile ? 22 : 26} strokeWidth={2.2} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 750,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#047857',
                  backgroundColor: '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0'
                }}>
                  Allocated Village
                </span>
                {villageDistrict && (
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    Dist. {villageDistrict}
                  </span>
                )}
              </div>

              <h1 style={{
                fontSize: isMobile ? '22px' : '26px',
                fontWeight: 800,
                color: '#0f172a',
                margin: '2px 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}>
                {villageName}
              </h1>

              {villageTaluka && (
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                  Taluka: <span style={{ color: '#0f172a', fontWeight: 600 }}>{villageTaluka}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action: Open in Google Maps */}
          <div>
            <a
              href={externalMapLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                backgroundColor: '#047857',
                border: '1px solid #047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                textDecoration: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(4,120,87,0.2)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
            >
              <Navigation size={15} />
              <span>Open in Google Maps ↗</span>
            </a>
          </div>

        </div>

        {/* Village Key Personnel Row (Sarpanch / SPOC) - Clean Micro-Cards */}
        {(village?.sarpanch_name || village?.sarpanch_mobile || village?.emergency_contact) && (
          <div
            style={{
              marginTop: '20px',
              paddingTop: '18px',
              borderTop: '1px solid #f1f5f9',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            {village?.sarpanch_name && (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  flexShrink: 0
                }}>
                  <User size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Gram Panchayat Sarpanch
                  </div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {village.sarpanch_name}
                  </div>
                </div>
              </div>
            )}

            {village?.sarpanch_mobile && (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#047857',
                    flexShrink: 0
                  }}>
                    <Phone size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Sarpanch Contact
                    </div>
                    <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 800 }}>
                      {village.sarpanch_mobile}
                    </div>
                  </div>
                </div>
                <a
                  href={`tel:${village.sarpanch_mobile}`}
                  style={{
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: 750,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  <Phone size={11} /> Call
                </a>
              </div>
            )}

            {village?.emergency_contact && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '10.5px', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Village Emergency SPOC
                  </div>
                  <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 800 }}>
                    {village.emergency_contact}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. QUICK EMERGENCY DIAL (CLEAN, POLISHED 6 CARDS) ── */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '20px 24px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626'
          }}>
            <ShieldAlert size={17} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              24/7 Verified Emergency Helplines
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Instant toll-free response active 24/7 across Maharashtra rural districts
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '10px'
        }}>
          {NATIONAL_EMERGENCY_CONTACTS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.number}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: item.bg,
                    border: `1px solid ${item.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                    flexShrink: 0
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '750', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>

                <a
                  href={`tel:${item.number}`}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f172a'; }}
                >
                  <Phone size={11} />
                  <span>{item.number}</span>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. NEARBY EMERGENCY & ESSENTIAL SERVICES (UNCLUTTERED, CATEGORY FILTERED) ── */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '22px 24px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px -2px rgba(15,23,42,0.02)'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb'
              }}>
                <Building2 size={16} />
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Nearby Emergency &amp; Essential Services
              </h2>
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
              Verified government hospitals, primary health centres, police stations &amp; fire services near {villageName}
            </div>
          </div>

          {/* Quick summary badge */}
          <span style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#047857',
            backgroundColor: '#ecfdf5',
            padding: '4px 10px',
            borderRadius: '9999px',
            border: '1px solid #a7f3d0'
          }}>
            {servicesData.length} facilities verified
          </span>
        </div>

        {/* Filter and Search Bar Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
          
          {/* Category Filter Pills (Declutters the whole page!) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px'
          }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: activeCategory === 'all' ? 750 : 600,
                border: '1px solid',
                borderColor: activeCategory === 'all' ? '#047857' : '#e2e8f0',
                backgroundColor: activeCategory === 'all' ? '#ecfdf5' : '#ffffff',
                color: activeCategory === 'all' ? '#047857' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              All Categories ({servicesData.length})
            </button>

            {categorizedServices.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 750 : 600,
                    border: '1px solid',
                    borderColor: isSelected ? '#047857' : '#e2e8f0',
                    backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                    color: isSelected ? '#047857' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cat.shortTitle} ({cat.items.length})
                </button>
              );
            })}
          </div>

          {/* Search Input with Clear Button */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by facility name, address, or service type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 34px 9px 34px',
                fontSize: '12.5px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Services Categorized Sections */}
        {loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px', color: '#047857' }} />
            Loading closest verified facilities for {villageName}...
          </div>
        ) : totalFilteredCount === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <Info size={24} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
              {searchQuery ? `No services found matching "${searchQuery}"` : 'No nearby services found'}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 12px 0' }}>
              {searchQuery ? 'Try another search term or reset filters.' : 'Dial 112 for universal emergency response.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {displayedCategories.map((cat) => {
              if (cat.items.length === 0) return null;
              const CatIcon = cat.icon;

              return (
                <div key={cat.id}>
                  {/* Category Section Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '10px',
                      marginBottom: '12px',
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          backgroundColor: cat.badgeBg,
                          border: `1px solid ${cat.badgeBorder}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: cat.color
                        }}
                      >
                        <CatIcon size={14} />
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                        {cat.title}
                      </h3>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
                      {cat.items.length} {cat.items.length === 1 ? 'place' : 'places'}
                    </span>
                  </div>

                  {/* Clean, Decluttered Service Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '12px'
                  }}>
                    {cat.items.map((srv) => {
                      return (
                        <div
                          key={srv.id || srv.name}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '12px',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 14px -2px rgba(15,23,42,0.06)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.03)'; }}
                        >
                          <div>
                            {/* Card Top: Distance badge & Name */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                              <h4 style={{
                                fontSize: '13.5px',
                                fontWeight: '800',
                                color: '#0f172a',
                                margin: 0,
                                lineHeight: 1.35
                              }}>
                                {srv.name}
                              </h4>
                              {srv.distance_label && (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '750',
                                  color: '#047857',
                                  backgroundColor: '#ecfdf5',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  border: '1px solid #a7f3d0',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}>
                                  ~{srv.distance_label}
                                </span>
                              )}
                            </div>

                            {/* Clean Address */}
                            {srv.address && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '5px',
                                marginTop: '4px'
                              }}>
                                <MapPin size={12} style={{ color: '#94a3b8', marginTop: '2px', flexShrink: 0 }} />
                                <p style={{
                                  fontSize: '11.5px',
                                  color: '#64748b',
                                  margin: 0,
                                  lineHeight: 1.4,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  {srv.address}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Contact & Directions Action Row */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            paddingTop: '10px',
                            borderTop: '1px solid #f1f5f9'
                          }}>
                            {srv.phone ? (
                              <a
                                href={`tel:${srv.phone}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '11.5px',
                                  fontWeight: '750',
                                  color: '#047857',
                                  textDecoration: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#ecfdf5',
                                  border: '1px solid #a7f3d0'
                                }}
                              >
                                <Phone size={11} />
                                <span>{srv.phone}</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Helpline: {srv.emergency_phone || '112'}
                              </span>
                            )}

                            <a
                              href={srv.directions_url || externalMapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 11px',
                                borderRadius: '6px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                color: '#334155',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#334155'; }}
                            >
                              <Navigation size={11} style={{ color: '#475569' }} />
                              <span>Directions</span>
                            </a>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

