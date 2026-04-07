import { useState, useEffect, useRef } from 'react';
import { Send, Bot, X, Minimize2, Maximize2, Loader2 } from 'lucide-react';
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
                style={{ background: 'var(--color-primary)' }}
                className="fixed bottom-4 right-4 z-50 w-11 h-11 rounded-full shadow-xl flex items-center justify-center text-white hover:opacity-90 transition-opacity"
            >
                <Bot className="w-5 h-5" />
            </button>
        );
    }

    return (
        <>
            {/* Chat panel — slides up from above the FAB */}
            {!isMinimized && (
                <div
                    className="fixed left-3 right-3 z-50 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
                    style={{
                        bottom: '64px',
                        height: '320px',
                        border: '1px solid var(--color-border)',
                    }}
                >
                    {/* Messages */}
                    <div
                        className="flex-1 overflow-y-auto p-3 space-y-3"
                        style={{ background: 'var(--color-muted)' }}
                    >
                        {messages.length === 0 && (
                            <div className="text-center text-sm mt-6" style={{ color: 'var(--color-muted-foreground)' }}>
                                <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p className="font-medium">VetBuddy Assistant</p>
                                <p className="text-xs mt-1 opacity-70">Ask anything about this consultation</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className="max-w-[88%] rounded-xl px-3 py-2 text-sm"
                                    style={msg.sender === 'user'
                                        ? { background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                                        : { background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }
                                    }
                                >
                                    {msg.sender === 'bot' ? (
                                        <div className="markdown-content break-words overflow-hidden text-[12px]">
                                            <ReactMarkdown
                                                components={{
                                                    p: ({ ...props }) => <p className="mb-1.5 last:mb-0" {...props} />,
                                                    ul: ({ ...props }) => <ul className="list-disc ml-4 mb-1.5" {...props} />,
                                                    ol: ({ ...props }) => <ol className="list-decimal ml-4 mb-1.5" {...props} />,
                                                    li: ({ ...props }) => <li className="mb-0.5" {...props} />,
                                                    strong: ({ ...props }) => <span className="font-bold" style={{ color: 'var(--color-primary)' }} {...props} />,
                                                    code: ({ ...props }) => <code className="rounded px-1 py-0.5 text-xs font-mono" style={{ background: 'var(--color-muted)' }} {...props} />,
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap text-[12px]">{msg.text}</p>
                                    )}
                                    <p className="text-[10px] mt-1 text-right opacity-50">
                                        {formatTime(msg.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="rounded-xl px-3 py-2" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
                                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div
                        className="p-2 flex-shrink-0"
                        style={{ background: 'var(--color-card)', borderTop: '1px solid var(--color-border)' }}
                    >
                        <form
                            onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                            className="flex items-center gap-2"
                        >
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={e => setInputMessage(e.target.value)}
                                placeholder="Ask about this consultation..."
                                className="input flex-1"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isTyping}
                                className="btn btn-primary btn-sm flex-shrink-0"
                                style={{ padding: '6px 10px' }}
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating pill — always visible when chat is open */}
            <div
                className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 h-11 shadow-xl cursor-pointer select-none"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                onClick={() => setIsMinimized(prev => !prev)}
            >
                <Bot className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">VetBuddy AI</span>
                <button
                    className="p-0.5 hover:bg-white/20 rounded-full ml-1"
                    onClick={e => { e.stopPropagation(); setIsMinimized(prev => !prev); }}
                    title={isMinimized ? 'Expand' : 'Minimise'}
                >
                    {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                    className="p-0.5 hover:bg-white/20 rounded-full"
                    onClick={e => { e.stopPropagation(); setIsOpen(false); }}
                    title="Close"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </>
    );
}
