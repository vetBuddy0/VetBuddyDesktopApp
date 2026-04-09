import { useState, useEffect, useRef } from 'react';
import { Send, Bot, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getAuthHeaders, getUserData } from '../authUtils';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

export interface ChatContextData {
    patient?: any;
    transcription?: string;
    manualNotes?: string;
    soapNote?: any;
    aiSuggestions?: any;
}

interface ChatInterfaceProps {
    consultationId: number | null;
    patientId?: number | null;
    contextData?: ChatContextData;
}

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

export const createConsultationContextMessage = (
    userMessage: string,
    consultationContext?: ChatContextData
): string => {
    if (!consultationContext) return userMessage;

    let contextMessage = `VETERINARY CONSULTATION CONTEXT:\n\nYou are a veterinary AI assistant helping with an active consultation. Below is the complete consultation information followed by the veterinarian's question.`;

    if (consultationContext.patient) {
        contextMessage += `\n\n=== PATIENT INFORMATION ===\nName: ${consultationContext.patient.name}\nSpecies: ${consultationContext.patient.species}`;
        if (consultationContext.patient.breed) contextMessage += `\nBreed: ${consultationContext.patient.breed}`;
        if (consultationContext.patient.age) contextMessage += `\nAge: ${consultationContext.patient.age}`;
        if (consultationContext.patient.weight) contextMessage += `\nWeight: ${consultationContext.patient.weight}`;
        if (consultationContext.patient.owner?.name) contextMessage += `\nOwner: ${consultationContext.patient.owner.name}`;
    }

    if (consultationContext.transcription) {
        contextMessage += `\n\n=== CONSULTATION TRANSCRIPTION ===\n${consultationContext.transcription}`;
    }

    contextMessage += `\n\n=== VETERINARIAN'S QUESTION ===\n${userMessage}\n\nPlease draft a professional veterinary response on behalf of the attending veterinarian.`;
    return contextMessage;
};

export function ChatInterface({ consultationId, patientId, contextData }: ChatInterfaceProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [inputMessage, setInputMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const formatTime = (date: Date) =>
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, isTyping]);

    const callChatAPI = async (text: string): Promise<string> => {
        const user = await getUserData();
        const headers = await getAuthHeaders();
        const fullMessage = createConsultationContextMessage(text, contextData);

        const body: Record<string, string> = {
            message: fullMessage,
            userId: user?.id?.toString() || 'unknown',
            patientId: patientId?.toString() || consultationId!.toString(),
        };

        const response = await fetch(`${API_URL}/api/admin/chatbot`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error('Failed to get response');
        const data = await response.json();
        return data.response || "I didn't get a response.";
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !consultationId) return;

        const currentText = inputMessage;
        setInputMessage('');

        const userMsg: Message = {
            id: Date.now().toString(),
            text: currentText,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        try {
            const botText = await callChatAPI(currentText);
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: botText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now().toString(),
                    text: 'Sorry, I encountered an error. Please try again.',
                    sender: 'bot',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!consultationId) return null;

    // Closed: floating action button
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                title="Open AI Assistant"
                className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center text-white transition-all card-shadow hover:scale-110 active:scale-95"
                style={{
                    background: 'var(--color-primary)',
                    boxShadow: 'var(--shadow-primary)',
                    border: 'none',
                    cursor: 'pointer'
                }}
            >
                <Bot size={22} />
            </button>
        );
    }

    return (
        <>
            {/* Chat panel — slides up from above the FAB */}
            {!isMinimized && (
                <div
                    className="fixed left-3 right-3 z-50 flex flex-col overflow-hidden card scale-in"
                    style={{
                        bottom: '72px',
                        minHeight: 'calc(100vh - 200px)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '10px 14px',
                        background: 'var(--color-card)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: 'var(--color-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Bot size={14} color="white" />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px' }}>My VetBuddy AI</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {/* <button onClick={() => setIsMinimized(true)} className="btn-icon sm">
                                <Minimize2 size={13} />
                            </button> */}
                            <button onClick={() => setIsOpen(false)} className="btn-icon sm danger">
                                <X size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Messages container */}
                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-4"
                        style={{ background: 'var(--color-muted)' }}
                    >
                        {messages.length === 0 && (
                            <div className="empty-state" style={{ padding: '40px 20px' }}>
                                <div className="empty-state-icon">
                                    <Bot size={24} />
                                </div>
                                <h3 className="empty-state-title">My VetBuddy Assistant</h3>
                                <p className="empty-state-desc">Ask anything about this consultation, transcription, or SOAP notes.</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {messages.map(msg => (
                                <div key={msg.id} style={{
                                    display: 'flex',
                                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    animation: 'fadeSlideIn 0.2s ease-out'
                                }}>
                                    <div
                                        style={msg.sender === 'user'
                                            ? {
                                                background: 'var(--color-primary)',
                                                color: 'var(--color-primary-foreground)',
                                                padding: '10px 14px',
                                                borderRadius: '16px 16px 2px 16px',
                                                maxWidth: '85%',
                                                boxShadow: 'var(--shadow-sm)'
                                            }
                                            : {
                                                background: 'var(--color-card)',
                                                border: '1px solid var(--color-border)',
                                                color: 'var(--color-foreground)',
                                                padding: '10px 14px',
                                                borderRadius: '16px 16px 16px 2px',
                                                maxWidth: '90%',
                                                boxShadow: 'var(--shadow-sm)'
                                            }
                                        }
                                    >
                                        {msg.sender === 'bot' ? (
                                            <div className="markdown-content text-[12.5px] leading-relaxed">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ ...props }) => <p style={{ marginBottom: 10 }} {...props} />,
                                                        ul: ({ ...props }) => <ul style={{ marginLeft: 16, marginBottom: 10, listStyleType: 'disc' }} {...props} />,
                                                        ol: ({ ...props }) => <ol style={{ marginLeft: 16, marginBottom: 10, listStyleType: 'decimal' }} {...props} />,
                                                        li: ({ ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
                                                        strong: ({ ...props }) => <span style={{ fontWeight: 700, color: 'var(--color-primary)' }} {...props} />,
                                                        code: ({ ...props }) => <code style={{
                                                            background: 'var(--color-muted)',
                                                            padding: '2px 4px',
                                                            borderRadius: 4,
                                                            fontSize: '11px',
                                                            fontFamily: 'monospace'
                                                        }} {...props} />,
                                                    }}
                                                >
                                                    {msg.text}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: '12.5px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{msg.text}</p>
                                        )}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            marginTop: 6,
                                            opacity: 0.6,
                                            fontSize: '10px',
                                            fontWeight: 500
                                        }}>
                                            {formatTime(msg.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {isTyping && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'fadeSlideIn 0.2s ease-out' }}>
                                <div style={{
                                    background: 'var(--color-card)',
                                    border: '1px solid var(--color-border)',
                                    padding: '8px 12px',
                                    borderRadius: '14px 14px 14px 2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    boxShadow: 'var(--shadow-xs)'
                                }}>
                                    <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-muted-foreground)' }}>My VetBuddy is thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div
                        style={{
                            padding: '12px 14px',
                            background: 'var(--color-card)',
                            borderTop: '1px solid var(--color-border)'
                        }}
                    >
                        <form
                            onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                        >
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={e => setInputMessage(e.target.value)}
                                placeholder="Ask about this patient or notes..."
                                className="input"
                                style={{ flex: 1, padding: '9px 12px', fontSize: '13px' }}
                                disabled={isTyping}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isTyping}
                                className="btn btn-primary btn-icon"
                                style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating pill — visible when chat is minimized or just the button when closed */}
            <div
                className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-3 rounded-full px-4 h-12 w-12 shadow-xl cursor-pointer select-none transition-all hover:scale-105 active:scale-95"
                style={{
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-foreground)',
                    display: isOpen ? 'flex' : 'none',
                    boxShadow: 'var(--shadow-primary)'
                }}
                onClick={() => setIsMinimized(prev => !prev)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bot size={20} />
                    {/* <span style={{ fontSize: 13, fontWeight: 600 }}>My VetBuddy AI</span> */}
                </div>

                {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 10, marginLeft: 2 }}>
                    <button
                        style={{ background: 'transparent', border: 'none', color: 'white', padding: 4, cursor: 'pointer', display: 'flex' }}
                        onClick={e => { e.stopPropagation(); setIsMinimized(prev => !prev); }}
                    >
                        {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                    </button>
                    <button
                        style={{ background: 'transparent', border: 'none', color: 'white', padding: 4, cursor: 'pointer', display: 'flex' }}
                        onClick={e => { e.stopPropagation(); setIsOpen(false); }}
                    >
                        <X size={16} />
                    </button>
                </div> */}
            </div>
        </>
    );
}
