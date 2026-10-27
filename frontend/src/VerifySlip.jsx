import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function VerifySlip() {
  const [searchParams] = useSearchParams();
  const barcode = searchParams.get('barcode');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!barcode) {
      setError('No barcode provided in URL.');
      setLoading(false);
      return;
    }

    const verifyBarcode = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const apiUrl = `${apiBase}/api/verify?barcode=${encodeURIComponent(barcode)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (response.ok) {
          setResult(data.user);
        } else {
          setError(data.message || 'Invalid QR code.');
        }
      } catch (err) {
        setError('Failed to connect to the server.');
      }
      setLoading(false);
    };

    verifyBarcode();
  }, [barcode]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <div className="glass-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px' }}>
        <img src="/ltc.png" alt="LTC Logo" style={{ height: '60px', marginBottom: '24px' }} />
        
        {loading ? (
           <p style={{ color: '#64748b' }}>Verifying...</p>
        ) : error ? (
           <div>
             <AlertCircle size={48} color="#0f172a" style={{ margin: '0 auto 16px' }} />
             <h3 style={{ fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>Verification Failed</h3>
             <p style={{ color: '#64748b', marginTop: '8px' }}>{error}</p>
           </div>
        ) : result && (
           <div>
             <CheckCircle size={48} color="#2563eb" style={{ margin: '0 auto 16px' }} />
             <h4 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>{result.name}</h4>
             <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>Dept: {result.department || '-'}</p>
             
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
               <div style={{ background: '#eff6ff', color: '#1e40af', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', width: '48%' }}>
                  <span style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Squad</span>
                  {result.squad || 'Unassigned'}
               </div>
               <div style={{ background: '#dcfce7', color: '#1e40af', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', width: '48%' }}>
                  <span style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Room</span>
                  {result.room || 'Unassigned'}
               </div>
             </div>
           </div>
        )}
        
        <button className="btn btn-outline" style={{ marginTop: '30px', width: '100%' }} onClick={() => navigate('/')}>
          Go to Home
        </button>
      </div>
    </div>
  );
}
