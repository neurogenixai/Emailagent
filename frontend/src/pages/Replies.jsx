import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Inbox, User, Mail, Calendar, MessageSquare } from 'lucide-react'

export default function Replies() {
  const [replies, setReplies] = useState([])
  const [selectedReply, setSelectedReply] = useState(null)

  useEffect(() => {
    api.get('/replies').then(res => {
      setReplies(res.data)
      if (res.data.length > 0) setSelectedReply(res.data[0])
    }).catch()
  }, [])

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col animate-fade-in">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Inbox className="text-green" /> Inbox
          </h1>
          <p className="text-text-secondary text-sm mt-1">Read replies from your leads.</p>
        </div>
      </div>

      <div className="flex-1 glass-card overflow-hidden flex">
        {/* Left Sidebar - List of replies */}
        <div className="w-1/3 border-r border-border overflow-y-auto">
          {replies.length === 0 ? (
            <div className="p-8 text-center text-text-muted">
              <MessageSquare className="mx-auto mb-2 opacity-50" size={32} />
              <p>No replies yet.</p>
            </div>
          ) : (
            replies.map(r => (
              <div 
                key={r.id} 
                onClick={() => setSelectedReply(r)}
                className={`p-4 border-b border-border cursor-pointer transition-colors ${selectedReply?.id === r.id ? 'bg-bg-elevated border-l-2 border-l-green' : 'hover:bg-bg-elevated/50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="font-bold text-white truncate">{r.lead_name}</p>
                  <span className="text-[10px] text-text-muted whitespace-nowrap ml-2">
                    {new Date(r.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs font-medium text-text-secondary truncate mb-1">{r.subject}</p>
                <p className="text-xs text-text-muted line-clamp-2">{r.body}</p>
              </div>
            ))
          )}
        </div>

        {/* Right Panel - Reading Pane */}
        <div className="w-2/3 bg-bg-elevated/30 overflow-y-auto">
          {selectedReply ? (
            <div className="p-8 h-full flex flex-col">
              <div className="flex justify-between items-start border-b border-border pb-6 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">{selectedReply.subject}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                    <span className="flex items-center gap-1"><User size={14}/> {selectedReply.lead_name}</span>
                    <span className="flex items-center gap-1"><Mail size={14}/> {selectedReply.lead_email}</span>
                    <span className="flex items-center gap-1 text-green"><Calendar size={14}/> Campaign: {selectedReply.campaign_name}</span>
                    <span className="flex items-center gap-1 text-orange"><Mail size={14}/> Received on: {selectedReply.mailbox}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 bg-bg-dark rounded-xl p-6 border border-border">
                <p className="text-white whitespace-pre-wrap leading-relaxed">
                  {selectedReply.body}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted">
              <p>Select an email to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
