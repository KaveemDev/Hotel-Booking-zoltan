import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../config/firebase';
import { sendChatMessage } from '../services/api';
import { MessageCircle, X, Send } from 'lucide-react';

const database = getDatabase(app);

const ChatWidget = () => {
    const { currentUser, userData, isAdmin, loading } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const chatId = currentUser?.uid;

    // Listen for messages in real-time
    useEffect(() => {
        if (!chatId || isAdmin || loading) return;
        const messagesRef = ref(database, `supportChats/${chatId}/messages`);
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const messagesArray = Object.entries(data)
                    .map(([id, msg]) => ({ id, ...msg }))
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                setMessages(messagesArray);

                // Count unread admin messages
                if (!isOpen) {
                    const unread = messagesArray.filter(m => m.role === 'admin' && !m.readByUser).length;
                    setUnreadCount(unread);
                }
            } else {
                setMessages([]);
            }
        });
        return () => unsubscribe();
    }, [chatId, isAdmin, isOpen, loading]);

    // Scroll to bottom when messages change or chat opens
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Don't render for admin users or unauthenticated users (or before the role is known)
    if (!currentUser || isAdmin || loading) return null;

    const handleOpen = () => {
        setIsOpen(true);
        setUnreadCount(0);
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            await sendChatMessage({
                chatId,
                text: newMessage.trim(),
                senderId: currentUser.uid,
                senderName: userData?.username || currentUser.email?.split('@')[0] || 'User',
                role: 'user',
                userInfo: {
                    uid: currentUser.uid,
                    username: userData?.username || currentUser.email?.split('@')[0],
                    email: currentUser.email,
                    photoURL: userData?.photoURL || currentUser.photoURL || ''
                }
            });
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' +
            date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            {/* Chat Widget Styles */}
            <style>{`
                .chat-widget-btn {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
                    z-index: 9999;
                    transition: all 0.3s ease;
                    color: white;
                }
                .chat-widget-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.55);
                }
                .chat-widget-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: #ef4444;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid #0f172a;
                    animation: badge-pulse 2s infinite;
                }
                @keyframes badge-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                }
                .chat-panel {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 380px;
                    height: 520px;
                    background: #0f172a;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05);
                    animation: chat-slide-up 0.3s ease;
                }
                @keyframes chat-slide-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @media (max-width: 480px) {
                    .chat-panel {
                        width: calc(100vw - 16px);
                        height: calc(100vh - 100px);
                        bottom: 8px;
                        right: 8px;
                        border-radius: 12px;
                    }
                }
                .chat-panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 18px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    flex-shrink: 0;
                }
                .chat-panel-header-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .chat-panel-header-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 6px #22c55e;
                }
                .chat-panel-header h3 {
                    margin: 0;
                    color: white;
                    font-size: 15px;
                    font-weight: 600;
                }
                .chat-panel-header p {
                    margin: 0;
                    color: rgba(255,255,255,0.7);
                    font-size: 11px;
                }
                .chat-panel-close {
                    background: rgba(255,255,255,0.15);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    padding: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                .chat-panel-close:hover {
                    background: rgba(255,255,255,0.25);
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }
                .chat-messages::-webkit-scrollbar {
                    width: 4px;
                }
                .chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px;
                }
                .chat-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    color: #64748b;
                    gap: 8px;
                    text-align: center;
                    padding: 20px;
                }
                .chat-empty-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: rgba(99, 102, 241, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                    margin-bottom: 4px;
                }
                .chat-empty h4 {
                    margin: 0;
                    color: #94a3b8;
                    font-size: 14px;
                    font-weight: 600;
                }
                .chat-empty p {
                    margin: 0;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .chat-msg {
                    display: flex;
                    flex-direction: column;
                    max-width: 80%;
                }
                .chat-msg.user {
                    align-self: flex-end;
                    align-items: flex-end;
                }
                .chat-msg.admin {
                    align-self: flex-start;
                    align-items: flex-start;
                }
                .chat-msg-bubble {
                    padding: 10px 14px;
                    border-radius: 14px;
                    font-size: 13px;
                    line-height: 1.45;
                    word-break: break-word;
                }
                .chat-msg.user .chat-msg-bubble {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .chat-msg.admin .chat-msg-bubble {
                    background: rgba(255, 255, 255, 0.06);
                    color: #e2e8f0;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-bottom-left-radius: 4px;
                }
                .chat-msg-meta {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 3px;
                    padding: 0 4px;
                }
                .chat-msg-sender {
                    font-size: 10px;
                    color: #8b5cf6;
                    font-weight: 600;
                    margin-bottom: 2px;
                    padding: 0 4px;
                }
                .chat-input-area {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    background: rgba(15, 23, 42, 0.8);
                    flex-shrink: 0;
                }
                .chat-input {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: #f1f5f9;
                    padding: 10px 14px;
                    font-size: 13px;
                    outline: none;
                    transition: border-color 0.2s;
                    resize: none;
                    font-family: inherit;
                    max-height: 80px;
                }
                .chat-input:focus {
                    border-color: rgba(99, 102, 241, 0.5);
                }
                .chat-input::placeholder {
                    color: #475569;
                }
                .chat-send-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .chat-send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 2px 12px rgba(99,102,241,0.4);
                }
                .chat-send-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
            `}</style>

            {/* Floating Button */}
            {!isOpen && (
                <button className="chat-widget-btn" onClick={handleOpen} id="chat-widget-toggle">
                    <MessageCircle size={26} />
                    {unreadCount > 0 && (
                        <span className="chat-widget-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="chat-panel" id="chat-panel">
                    {/* Header */}
                    <div className="chat-panel-header">
                        <div className="chat-panel-header-info">
                            <div className="chat-panel-header-dot" />
                            <div>
                                <h3>Zovotel Support</h3>
                                <p>We typically reply in a few minutes</p>
                            </div>
                        </div>
                        <button className="chat-panel-close" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.length === 0 ? (
                            <div className="chat-empty">
                                <div className="chat-empty-icon">
                                    <MessageCircle size={22} />
                                </div>
                                <h4>Welcome to Zovotel Support!</h4>
                                <p>Ask us anything about bookings, payments, or hotels. We're here to help.</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                                    {msg.role === 'admin' && (
                                        <div className="chat-msg-sender">Zovotel Support</div>
                                    )}
                                    <div className="chat-msg-bubble">{msg.text}</div>
                                    <div className="chat-msg-meta">{formatTime(msg.timestamp)}</div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="chat-input-area">
                        <input
                            ref={inputRef}
                            className="chat-input"
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={1000}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={handleSend}
                            disabled={!newMessage.trim() || sending}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
