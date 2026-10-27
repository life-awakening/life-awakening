import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations as staticTranslations } from '../utils/translations';
import API_BASE_URL from '@/config/apiConfig';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('adminLanguage') || 'en';
  });

  const [dbTranslations, setDbTranslations] = useState({ hi: {}, mr: {} });

  const fetchDbTranslations = async () => {
    try {
      const api = API_BASE_URL;
      const res = await fetch(`${api}/api/translations`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.translations) {
          setDbTranslations(data.translations);
        }
      }
    } catch (err) {
      console.error('Failed to fetch translations from database:', err);
    }
  };

  useEffect(() => {
    fetchDbTranslations();
  }, []);

  const changeLanguage = (lang) => {
    setCurrentLanguage(lang);
    localStorage.setItem('adminLanguage', lang);
  };

  const reloadTranslations = () => {
    fetchDbTranslations();
  };

  const t = (text) => {
    if (!text) return '';
    if (currentLanguage === 'en') return text;
    
    const trimmed = text.trim();
    
    // 1. Try DB translations first
    const dbDict = dbTranslations[currentLanguage];
    if (dbDict && dbDict[trimmed] !== undefined && dbDict[trimmed] !== '') {
      return dbDict[trimmed];
    }
    
    // 2. Fallback to static translations
    const staticDict = staticTranslations[currentLanguage];
    if (staticDict && staticDict[trimmed] !== undefined) {
      return staticDict[trimmed];
    }
    
    return text; // Fallback to English
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, t, reloadTranslations, dbTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
