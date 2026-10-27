import React, { useState, useEffect, useRef, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const SUGGESTED_QUESTIONS = [
  'How many batches are active?',
  'How many students are enrolled in total?',
  'Show all batches and student counts',
  'Which batch has the highest number of students?',
  'Show all squads and their student counts',
  'Overall attendance summary',
  'Who submitted feedback?',
  'List faculty members and their departments',
  'Who are the squad leaders?',
  'Students with pending undertaking forms'
]

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function MarkdownContent({ content }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let tableLines = []
  let inTable = false

  const renderFormattedText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ color: '#0f172a', fontWeight: '700' }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  const flushTable = (keyPrefix) => {
    if (tableLines.length === 0) return null
    const headerRow = tableLines[0].split('|').map(c => c.trim()).filter(Boolean)
    const dataRows = tableLines.slice(2).map(row => row.split('|').map(c => c.trim()).filter(Boolean))

    const tbl = (
      <div key={`tbl-${keyPrefix}`} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              {headerRow.map((h, hi) => (
                <th key={hi} style={{ padding: '8px 12px', fontWeight: '650', color: '#374151', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri < dataRows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '8px 12px', color: '#374151', fontSize: '12.5px' }}>
                    {renderFormattedText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableLines = []
    return tbl
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true
      tableLines.push(line.trim())
      continue
    } else if (inTable) {
      inTable = false
      elements.push(flushTable(i))
    }

    if (!line.trim()) {
      elements.push(<div key={`space-${i}`} style={{ height: '6px' }} />)
      continue
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={`bullet-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0', lineHeight: '1.6', color: '#374151' }}>
          <span style={{ color: '#9ca3af', marginTop: '3px', flexShrink: 0, fontSize: '10px' }}>●</span>
          <span style={{ fontSize: '14px' }}>{renderFormattedText(line.trim().substring(2))}</span>
        </div>
      )
      continue
    }

    if (/^#{1,3}\s/.test(line.trim())) {
      const text = line.replace(/^#{1,3}\s/, '')
      elements.push(
        <p key={`h-${i}`} style={{ margin: '8px 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
          {renderFormattedText(text)}
        </p>
      )
      continue
    }

    elements.push(
      <p key={`p-${i}`} style={{ margin: '3px 0', fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>
        {renderFormattedText(line)}
      </p>
    )
  }

  if (inTable && tableLines.length > 0) {
    elements.push(flushTable('end'))
  }

  return <>{elements}</>
}

// ─── Main ChatGPT-Style Conversation Component ───────────────────────────────
export default function LtcChatbotView({ token, selectedBatchId, batches = [], onBatchChange }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Hello! I am your **LTC Database Assistant**.\n\nAsk me anything about students, batches, attendance, feedback submissions, faculty assignments, squads, or statistics.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  
  const chatScrollContainerRef = useRef(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const MAX_HISTORY = 8

  // Scroll strictly to the latest message inside the conversation area
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Handle auto-expanding textarea height
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 130)}px`
    }
  }

  // ─── SEND MESSAGE HANDLER ──────────────────────────────────────────────────
  // FLOW:
  // 1. User types question.
  // 2. Question appears as a separate user message in the chat history.
  // 3. Input composer immediately clears and resets.
  // 4. Loading indicator appears in the chat area (NOT in the input box).
  // 5. AI response arrives and is added as an assistant message in chat history.
  // 6. Input box ALWAYS remains an empty composer.
  const handleSendMessage = useCallback(async (queryText) => {
    const textToSend = (queryText || inputValue).trim()
    if (!textToSend || loading) return

    // 1. Create separate user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // 2. Snapshot history for context before clearing
    const historySnapshot = messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, text: m.text }))

    // 3. Immediately clear input box & reset textarea height
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }

    // 4. Append user message to conversation & enable loading state in chat area
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    // Ensure scroll occurs right after user message is added
    requestAnimationFrame(() => scrollToBottom('smooth'))

    try {
      const response = await fetch(`${API}/api/superadmin/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: textToSend,
          history: historySnapshot,
          activeBatchId: selectedBatchId !== 'ALL' ? selectedBatchId : null
        })
      })

      const data = await response.json()
      const answerText = (data.success && data.answer)
        ? data.answer
        : (data.message || 'Unable to retrieve data from the LTC database at this time.')

      // 5. Append AI response as a separate assistant message in conversation area
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: answerText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } catch (err) {
      console.error('Chatbot error:', err)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Connection to LTC database failed. Please check your network connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
      // Input box remains clean and empty for the next user query
      requestAnimationFrame(() => scrollToBottom('smooth'))
    }
  }, [inputValue, loading, messages, token, selectedBatchId, scrollToBottom])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleClearChat = useCallback(() => {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        text: 'Chat history cleared. What would you like to know from the LTC database?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  const handleCopy = useCallback((id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <>
      <style>{`
        .ltc-chip-scroll::-webkit-scrollbar { display: none; }
        .ltc-chip-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .ltc-composer-box:focus-within {
          border-color: #1d4ed8 !important;
          box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12), 0 2px 8px rgba(0,0,0,0.06) !important;
        }
        .ltc-chip-btn:hover {
          border-color: #cbd5e1 !important;
          background: #f1f5f9 !important;
          color: #0f172a !important;
        }
      `}</style>

      {/* ── FULL-PAGE CONTAINER ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 160px)',
        minHeight: '560px',
        width: '100%',
        background: 'transparent',
        position: 'relative'
      }}>

        {/* ── TOP HEADER / CONTROLS ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 0 10px 0',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
              LTC Database Assistant
            </span>
            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
              • Ask anything about LTC records
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {batches && batches.length > 0 && onBatchChange && (
              <select
                value={selectedBatchId || 'ALL'}
                onChange={onBatchChange}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleClearChat}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                padding: '4px 10px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.target.style.background = '#f8fafc'; e.target.style.color = '#0f172a' }}
              onMouseLeave={e => { e.target.style.background = '#ffffff'; e.target.style.color = '#64748b' }}
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* ── SUGGESTED QUESTIONS BAR (Horizontal scroll, scrollbar hidden) ── */}
        <div
          className="ltc-chip-scroll"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 0',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              disabled={loading}
              className="ltc-chip-btn"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#475569',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '11.5px',
                fontWeight: '450',
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.12s ease',
                opacity: loading ? 0.6 : 1
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* ── CONVERSATION AREA (Independently vertically scrollable) ── */}
        <div
          ref={chatScrollContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 0 24px 0',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{
            maxWidth: '820px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '0 8px'
          }}>
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <img
                      src="/logoo.png"
                      alt="LTC"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1px solid #e2e8f0',
                        flexShrink: 0,
                        marginTop: '2px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    />
                  )}

                  {/* Message Bubble */}
                  <div style={{
                    maxWidth: isUser ? '75%' : '88%',
                    background: isUser ? '#1d4ed8' : '#ffffff',
                    color: isUser ? '#ffffff' : '#1e293b',
                    padding: isUser ? '10px 16px' : '14px 18px',
                    borderRadius: isUser ? '18px 18px 2px 18px' : '2px 18px 18px 18px',
                    boxShadow: isUser
                      ? '0 1px 3px rgba(29, 78, 216, 0.2)'
                      : '0 1px 3px rgba(0,0,0,0.05), 0 0 0 1px #e2e8f0',
                    lineHeight: '1.6'
                  }}>
                    {isUser ? (
                      <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap', fontWeight: '450' }}>
                        {m.text}
                      </div>
                    ) : (
                      <div>
                        <MarkdownContent content={m.text} />
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px solid #f1f5f9'
                        }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{m.timestamp}</span>
                          <button
                            onClick={() => handleCopy(m.id, m.text)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedId === m.id ? '#16a34a' : '#64748b',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              transition: 'color 0.15s'
                            }}
                          >
                            {copiedId === m.id ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* In-Chat Loading Indicator (Replaced by response once ready) */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <img
                  src="/logoo.png"
                  alt="LTC"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid #e2e8f0',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                />
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '2px 18px 18px 18px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                  <style>{`
                    @keyframes ltcDotPulse {
                      0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
                      40% { opacity: 1; transform: scale(1.1); }
                    }
                  `}</style>
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#64748b',
                        animation: `ltcDotPulse 1.1s ease-in-out ${delay}ms infinite`
                      }}
                    />
                  ))}
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                    Checking LTC database...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── FIXED/STICKY BOTTOM INPUT COMPOSER ───────────────────────── */}
        {/* Strictly dedicated for user typing — NEVER receives AI response */}
        <div style={{
          flexShrink: 0,
          padding: '8px 0 2px 0',
          background: 'transparent'
        }}>
          <div style={{
            maxWidth: '820px',
            width: '100%',
            margin: '0 auto',
            padding: '0 8px'
          }}>
            <div
              className="ltc-composer-box"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '24px',
                padding: '8px 10px 8px 18px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.15s ease'
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value)
                  adjustTextareaHeight()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about LTC data..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: 'none',
                  background: 'transparent',
                  padding: '4px 0',
                  fontSize: '14px',
                  color: '#0f172a',
                  outline: 'none',
                  lineHeight: '1.45',
                  fontFamily: 'inherit',
                  maxHeight: '130px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || loading}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: inputValue.trim() && !loading ? '#1d4ed8' : '#e2e8f0',
                  color: inputValue.trim() && !loading ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title="Send question"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>
              LTC Database Assistant is strictly read-only and queries live database records.
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
