import React, { useState, useEffect, useRef } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../config/firebase';
import { sendChatMessage, toggleChatPin, markChatAsRead, cleanupOldChats } from '../services/api';
import { Search, Pin, PinOff, Send, Trash2, MessageCircle, ArrowLeft } from 'lucide-react';

const database = getDatabase(app);

const AdminChatSection = ({ currentUser, userData }) => {
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [cleanupMsg, setCleanupMsg] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Listen for all conversations in real-time
    useEffect(() => {
        const chatsRef = ref(database, 'supportChats');
        const unsubscribe = onValue(chatsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const convos = Object.entries(data).map(([chatId, chat]) => {
                    let unreadCount = 0;
                    if (chat.messages) {
                        Object.values(chat.messages).forEach(msg => {
                            if (msg.role === 'user' && !msg.read) unreadCount++;
                        });
                    }
                    return {
                        chatId,
                        userInfo: chat.userInfo || {},
                        pinned: chat.pinned || false,
                        createdAt: chat.createdAt,
                        lastMessageAt: chat.lastMessageAt,
                        lastMessage: chat.lastMessage || '',
                        lastMessageRole: chat.lastMessageRole || 'user',
                        messageCount: chat.messages ? Object.keys(chat.messages).length : 0,
                        unreadCount
                    };
                });
                convos.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
                });
                setConversations(convos);
            } else {
                setConversations([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Listen for messages in selected conversation  
    useEffect(() => {
        if (!selectedChat) {
            setMessages([]);
            return;
        }
        const messagesRef = ref(database, `supportChats/${selectedChat}/messages`);
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgs = Object.entries(data)
                    .map(([id, msg]) => ({ id, ...msg }))
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                setMessages(msgs);
            } else {
                setMessages([]);
            }
        });

        // Mark as read when opening
        markChatAsRead(selectedChat).catch(console.error);

        return () => unsubscribe();
    }, [selectedChat]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChat && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedChat]);

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedChat || sending) return;
        setSending(true);
        try {
            await sendChatMessage({
                chatId: selectedChat,
                text: replyText.trim(),
                senderId: currentUser.uid,
                senderName: userData?.username || 'Admin',
                role: 'admin'
            });
            setReplyText('');
        } catch (error) {
            console.error('Failed to send reply:', error);
        } finally {
            setSending(false);
        }
    };

    const handleTogglePin = async (chatId, e) => {
        e.stopPropagation();
        try {
            await toggleChatPin(chatId);
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        }
    };

    const handleCleanup = async () => {
        setCleanupLoading(true);
        setCleanupMsg('');
        try {
            const res = await cleanupOldChats();
            setCleanupMsg(res.message || `Deleted ${res.deletedCount} old chats`);
            setTimeout(() => setCleanupMsg(''), 5000);
        } catch (error) {
            setCleanupMsg('Cleanup failed: ' + (error.message || 'Unknown error'));
        } finally {
            setCleanupLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        if (isYesterday) return 'Yesterday';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const formatFullTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const filteredConversations = conversations.filter(c => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            c.userInfo?.username?.toLowerCase().includes(term) ||
            c.userInfo?.email?.toLowerCase().includes(term) ||
            c.lastMessage?.toLowerCase().includes(term)
        );
    });

    const selectedConvo = conversations.find(c => c.chatId === selectedChat);
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    return (
        <>
            <style>{`
                .admin-chat-container {
                    display: flex;
                    height: calc(100vh - 140px);
                    background: rgba(15, 23, 42, 0.4);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .admin-chat-sidebar {
                    width: 340px;
                    border-right: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                }
                .admin-chat-sidebar-header {
                    padding: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .admin-chat-sidebar-title {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .admin-chat-sidebar-title h3 {
                    margin: 0;
                    color: #f1f5f9;
                    font-size: 15px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .admin-chat-sidebar-title .unread-badge {
                    background: #6366f1;
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 10px;
                    min-width: 18px;
                    text-align: center;
                }
                .admin-chat-search {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    padding: 8px 12px;
                }
                .admin-chat-search input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #f1f5f9;
                    font-size: 13px;
                    outline: none;
                }
                .admin-chat-search input::placeholder { color: #475569; }
                .admin-chat-list {
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }
                .admin-chat-list::-webkit-scrollbar { width: 4px; }
                .admin-chat-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
                .admin-chat-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    transition: background 0.15s;
                    position: relative;
                }
                .admin-chat-item:hover { background: rgba(255,255,255,0.04); }
                .admin-chat-item.active { background: rgba(99, 102, 241, 0.1); border-left: 3px solid #6366f1; }
                .admin-chat-item-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 13px;
                    font-weight: 700;
                    flex-shrink: 0;
                }
                .admin-chat-item-info {
                    flex: 1;
                    min-width: 0;
                }
                .admin-chat-item-name {
                    font-size: 13px;
                    font-weight: 600;
                    color: #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .admin-chat-item-name .pin-icon {
                    color: #f59e0b;
                    flex-shrink: 0;
                }
                .admin-chat-item-preview {
                    font-size: 12px;
                    color: #64748b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-top: 2px;
                }
                .admin-chat-item-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                    flex-shrink: 0;
                }
                .admin-chat-item-time {
                    font-size: 10px;
                    color: #64748b;
                }
                .admin-chat-item-unread {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #6366f1;
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .admin-chat-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .admin-chat-main-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    flex-shrink: 0;
                }
                .admin-chat-main-header-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .admin-chat-main-header-info h4 {
                    margin: 0;
                    color: #f1f5f9;
                    font-size: 14px;
                    font-weight: 600;
                }
                .admin-chat-main-header-info p {
                    margin: 0;
                    color: #64748b;
                    font-size: 11px;
                }
                .admin-chat-main-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .admin-chat-action-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 6px 10px;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.15s;
                }
                .admin-chat-action-btn:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
                .admin-chat-action-btn.pinned { color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); }
                .admin-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }
                .admin-chat-messages::-webkit-scrollbar { width: 4px; }
                .admin-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
                .admin-chat-msg {
                    display: flex;
                    flex-direction: column;
                    max-width: 70%;
                }
                .admin-chat-msg.user {
                    align-self: flex-start;
                    align-items: flex-start;
                }
                .admin-chat-msg.admin {
                    align-self: flex-end;
                    align-items: flex-end;
                }
                .admin-chat-msg-sender {
                    font-size: 10px;
                    font-weight: 600;
                    margin-bottom: 2px;
                    padding: 0 4px;
                }
                .admin-chat-msg.user .admin-chat-msg-sender { color: #6366f1; }
                .admin-chat-msg.admin .admin-chat-msg-sender { color: #22c55e; }
                .admin-chat-msg-bubble {
                    padding: 10px 14px;
                    border-radius: 14px;
                    font-size: 13px;
                    line-height: 1.45;
                    word-break: break-word;
                }
                .admin-chat-msg.user .admin-chat-msg-bubble {
                    background: rgba(255, 255, 255, 0.06);
                    color: #e2e8f0;
                    border: 1px solid rgba(255,255,255,0.06);
                    border-bottom-left-radius: 4px;
                }
                .admin-chat-msg.admin .admin-chat-msg-bubble {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .admin-chat-msg-time {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 3px;
                    padding: 0 4px;
                }
                .admin-chat-reply-area {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 14px 18px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    flex-shrink: 0;
                }
                .admin-chat-reply-input {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: #f1f5f9;
                    padding: 10px 14px;
                    font-size: 13px;
                    outline: none;
                    font-family: inherit;
                    transition: border-color 0.2s;
                }
                .admin-chat-reply-input:focus { border-color: rgba(99, 102, 241, 0.5); }
                .admin-chat-reply-input::placeholder { color: #475569; }
                .admin-chat-send-btn {
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
                .admin-chat-send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 2px 12px rgba(99,102,241,0.4);
                }
                .admin-chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .admin-chat-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    color: #64748b;
                    gap: 10px;
                    text-align: center;
                }
                .admin-chat-empty-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: rgba(99, 102, 241, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                }
                .admin-chat-empty h4 {
                    margin: 0;
                    color: #94a3b8;
                    font-size: 15px;
                }
                .admin-chat-empty p {
                    margin: 0;
                    font-size: 12px;
                    max-width: 280px;
                }
                .admin-chat-cleanup-bar {
                    padding: 10px 16px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }
                .admin-chat-cleanup-btn {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 8px;
                    color: #f87171;
                    cursor: pointer;
                    padding: 6px 12px;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .admin-chat-cleanup-btn:hover { background: rgba(239, 68, 68, 0.2); }
                .admin-chat-cleanup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .admin-chat-cleanup-msg {
                    font-size: 11px;
                    color: #22c55e;
                }
                .admin-chat-back-btn {
                    display: none;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 6px;
                    transition: all 0.15s;
                }
                .admin-chat-back-btn:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
                @media (max-width: 768px) {
                    .admin-chat-sidebar { width: 100%; }
                    .admin-chat-sidebar.hidden { display: none; }
                    .admin-chat-main.hidden { display: none; }
                    .admin-chat-back-btn { display: flex; }
                }
            `}</style>

            <div className="admin-chat-container">
                {/* Conversation List */}
                <div className={`admin-chat-sidebar ${selectedChat ? 'hidden' : ''}`}>
                    <div className="admin-chat-sidebar-header">
                        <div className="admin-chat-sidebar-title">
                            <h3>
                                <MessageCircle size={16} />
                                Conversations
                                {totalUnread > 0 && <span className="unread-badge">{totalUnread}</span>}
                            </h3>
                        </div>
                        <div className="admin-chat-search">
                            <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                            <input
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="admin-chat-list">
                        {filteredConversations.length === 0 ? (
                            <div className="admin-chat-empty" style={{ padding: '40px 20px' }}>
                                <div className="admin-chat-empty-icon">
                                    <MessageCircle size={24} />
                                </div>
                                <h4>No conversations yet</h4>
                                <p>When users send support messages, they'll appear here.</p>
                            </div>
                        ) : (
                            filteredConversations.map(convo => (
                                <div
                                    key={convo.chatId}
                                    className={`admin-chat-item ${selectedChat === convo.chatId ? 'active' : ''}`}
                                    onClick={() => setSelectedChat(convo.chatId)}
                                >
                                    <div className="admin-chat-item-avatar">
                                        {getInitials(convo.userInfo?.username || convo.userInfo?.email)}
                                    </div>
                                    <div className="admin-chat-item-info">
                                        <div className="admin-chat-item-name">
                                            {convo.userInfo?.username || convo.userInfo?.email?.split('@')[0] || 'Unknown'}
                                            {convo.pinned && <Pin size={12} className="pin-icon" />}
                                        </div>
                                        <div className="admin-chat-item-preview">
                                            {convo.lastMessageRole === 'admin' && <span style={{ color: '#94a3b8' }}>You: </span>}
                                            {convo.lastMessage || 'No messages'}
                                        </div>
                                    </div>
                                    <div className="admin-chat-item-meta">
                                        <div className="admin-chat-item-time">{formatTime(convo.lastMessageAt)}</div>
                                        {convo.unreadCount > 0 && (
                                            <div className="admin-chat-item-unread">{convo.unreadCount}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Cleanup Bar */}
                    <div className="admin-chat-cleanup-bar">
                        <button
                            className="admin-chat-cleanup-btn"
                            onClick={handleCleanup}
                            disabled={cleanupLoading}
                        >
                            <Trash2 size={12} />
                            {cleanupLoading ? 'Cleaning...' : 'Clean 30d+ Chats'}
                        </button>
                        {cleanupMsg && <span className="admin-chat-cleanup-msg">{cleanupMsg}</span>}
                    </div>
                </div>

                {/* Chat Detail */}
                <div className={`admin-chat-main ${!selectedChat ? 'hidden' : ''}`}>
                    {!selectedChat ? (
                        <div className="admin-chat-empty">
                            <div className="admin-chat-empty-icon">
                                <MessageCircle size={26} />
                            </div>
                            <h4>Select a conversation</h4>
                            <p>Choose a conversation from the list to view and reply to user messages.</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="admin-chat-main-header">
                                <div className="admin-chat-main-header-info">
                                    <button
                                        className="admin-chat-back-btn"
                                        onClick={() => setSelectedChat(null)}
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                    <div className="admin-chat-item-avatar" style={{ width: 36, height: 36, fontSize: 12 }}>
                                        {getInitials(selectedConvo?.userInfo?.username || selectedConvo?.userInfo?.email)}
                                    </div>
                                    <div>
                                        <h4>{selectedConvo?.userInfo?.username || selectedConvo?.userInfo?.email?.split('@')[0] || 'Unknown'}</h4>
                                        <p>{selectedConvo?.userInfo?.email || ''}</p>
                                    </div>
                                </div>
                                <div className="admin-chat-main-actions">
                                    <button
                                        className={`admin-chat-action-btn ${selectedConvo?.pinned ? 'pinned' : ''}`}
                                        onClick={(e) => handleTogglePin(selectedChat, e)}
                                        title={selectedConvo?.pinned ? 'Unpin conversation' : 'Pin conversation'}
                                    >
                                        {selectedConvo?.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                                        {selectedConvo?.pinned ? 'Unpin' : 'Pin'}
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="admin-chat-messages">
                                {messages.length === 0 ? (
                                    <div className="admin-chat-empty">
                                        <p>No messages in this conversation yet.</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={`admin-chat-msg ${msg.role}`}>
                                            <div className="admin-chat-msg-sender">
                                                {msg.role === 'user'
                                                    ? (msg.senderName || 'User')
                                                    : (msg.senderName || 'Admin')}
                                            </div>
                                            <div className="admin-chat-msg-bubble">{msg.text}</div>
                                            <div className="admin-chat-msg-time">{formatFullTime(msg.timestamp)}</div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Reply Input */}
                            <div className="admin-chat-reply-area">
                                <input
                                    ref={inputRef}
                                    className="admin-chat-reply-input"
                                    placeholder="Type your reply..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    maxLength={1000}
                                />
                                <button
                                    className="admin-chat-send-btn"
                                    onClick={handleSendReply}
                                    disabled={!replyText.trim() || sending}
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default AdminChatSection;
