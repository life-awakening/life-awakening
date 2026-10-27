import React, { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const SUGGESTED_QUESTIONS = [
  'How many students are enrolled in Batch 1?',
  'How many students submitted feedback for Batch 1?',
  'What is the attendance summary for Batch 1?',
  'List all faculty members and assigned squads',
  'Who are the squad leaders?',
  'How many active red flags are recorded?'
]

/**
 * Basic Markdown Renderer for bold, bullet lists, and tables.
 */
function MarkdownContent({ content }) {
  if (!content) return null

  // Split into lines for rendering
  const lines = content.split('\n')
  const elements = []
  let tableLines = []
  let inTable = false

  const renderFormattedText = (text) => {
    // Replace **bold** with <strong>
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
      <div key={`tbl-${keyPrefix}`} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              {headerRow.map((h, hi) => (
                <th key={hi} style={{ padding: '7px 10px', fontWeight: '700', color: '#1e293b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri < dataRows.length - 1 ? '1px solid #f1f5f9' : 'none', background: ri % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 10px', color: '#334155' }}>
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

    // Detect markdown table line
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

    // Bullet line
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={`bullet-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '2px 0 2px 8px', fontSize: '13px', lineHeight: '1.45', color: '#334155' }}>
          <span style={{ color: '#2563eb', fontWeight: 'bold' }}>&bull;</span>
          <span>{renderFormattedText(line.trim().substring(2))}</span>
        </div>
      )
      continue
    }

    // Regular line / header
    elements.push(
      <p key={`p-${i}`} style={{ margin: '3px 0', fontSize: '13px', lineHeight: '1.45', color: '#1e293b' }}>
        {renderFormattedText(line)}
      </p>
    )
  }

  if (inTable && tableLines.length > 0) {
    elements.push(flushTable('end'))
  }

  return <>{elements}</>
}

export default function LtcChatbotModal({ isOpen, onClose, token, selectedBatchId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Hello Super Admin! I am your **LTC Database Assistant**.\n\nYou can ask me virtually anything about LTC records, students, batches, attendance, feedback submissions, faculty assignments, or statistics in **English**, **Hindi (हिन्दी)**, or **Marathi (मराठी)**.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
      scrollToBottom()
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Handle ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || inputValue).trim()
    if (!textToSend || loading) return

    const userMessage = {
      id: Date.now(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const updatedHistory = [...messages, userMessage]
    setMessages(updatedHistory)
    setInputValue('')
    setLoading(true)

    try {
      const response = await fetch(`${API}/api/superadmin/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: textToSend,
          history: updatedHistory.slice(-6).map(m => ({ role: m.role, text: m.text })),
          activeBatchId: selectedBatchId !== 'ALL' ? selectedBatchId : null
        })
      })

      const data = await response.json()

      if (data.success && data.answer) {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: data.answer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'assistant',
            text: data.message || 'Unable to retrieve answer from LTC database records at this time.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ])
      }
    } catch (err) {
      console.error('Chatbot error:', err)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: 'Connection to LTC database failed. Please check your connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        text: 'Chat history cleared. How can I assist you with LTC records today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      {/* Modal Container */}
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '840px',
        height: '88vh',
        maxHeight: '780px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)'
            }}>
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-0.2px' }}>
                  LTC Database Assistant
                </span>
                <span style={{
                  fontSize: '9.5px',
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.4)',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}>
                  100% Read-Only
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0', fontWeight: '400' }}>
                Ask anything about LTC Portal data &bull; English, हिन्दी, मराठी
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleClearChat}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '5px 10px',
                borderRadius: '7px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
            >
              Clear
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                lineHeight: 1
              }}
              onMouseEnter={(e) => e.target.style.color = '#ffffff'}
              onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
              title="Close (Esc)"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Suggestion Chips Banner */}
        <div style={{
          padding: '8px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '4px' }}>
            Suggestions:
          </span>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              disabled={loading}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.color = '#1d4ed8'
                e.target.style.background = '#eff6ff'
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#cbd5e1'
                e.target.style.color = '#334155'
                e.target.style.background = '#ffffff'
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#fafbfc'
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
                  gap: '8px'
                }}
              >
                {!isUser && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#154388',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    ⚡
                  </div>
                )}

                <div style={{
                  maxWidth: '82%',
                  background: isUser ? '#154388' : '#ffffff',
                  color: isUser ? '#ffffff' : '#0f172a',
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  boxShadow: isUser
                    ? '0 2px 6px rgba(21, 67, 136, 0.25)'
                    : '0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px #e2e8f0',
                  position: 'relative'
                }}>
                  {isUser ? (
                    <div style={{ fontSize: '13px', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                      {m.text}
                    </div>
                  ) : (
                    <div>
                      <MarkdownContent content={m.text} />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '6px',
                        paddingTop: '4px',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '10px',
                        color: '#94a3b8'
                      }}>
                        <span>{m.timestamp}</span>
                        <button
                          onClick={() => handleCopyMessage(m.id, m.text)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedId === m.id ? '#16a34a' : '#64748b',
                            fontSize: '10px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            padding: '2px 4px'
                          }}
                        >
                          {copiedId === m.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: '#154388',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                flexShrink: 0
              }}>
                ⚡
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px 14px 14px 2px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                color: '#475569'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  animation: 'pulse 1.2s infinite'
                }} />
                <span>Checking LTC records...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer Area */}
        <div style={{
          padding: '12px 18px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDownInput}
            placeholder="Ask anything about LTC data (e.g., 'How many students submitted pre feedback in Batch 1?')..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              resize: 'none',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              padding: '9px 12px',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none',
              lineHeight: '1.4',
              fontFamily: 'inherit',
              maxHeight: '80px',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || loading}
            style={{
              background: inputValue.trim() && !loading ? '#154388' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s ease',
              flexShrink: 0
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
