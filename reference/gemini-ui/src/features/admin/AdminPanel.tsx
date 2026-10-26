import React, { useState } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Coffee, 
  Radio, 
  TrendingUp, 
  PhoneCall, 
  Check, 
  Ban, 
  X, 
  AlertCircle, 
  ArrowLeft,
  Users,
  Search,
  Flame,
  Clock
} from 'lucide-react';
import { SEED_ADMIN_REPORTS } from '../../mocks/seedData';
import { AdminReport } from '../../types';
import { Button } from '../../ui/Button';
import { playTapSound, playSuccessChime } from '../../lib/audio';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'safety' | 'live_dates' | 'venues' | 'rooms' | 'growth'>('safety');
  const [reports, setReports] = useState<AdminReport[]>(SEED_ADMIN_REPORTS);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(reports[0]);

  const handleStrikeUser = (id: string) => {
    playTapSound();
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'struck' } : r))
    );
  };

  const handleBanUser = (id: string) => {
    playTapSound();
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'banned' } : r))
    );
  };

  const handleDismissReport = (id: string) => {
    playTapSound();
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' } : r))
    );
  };

  return (
    <div className="min-h-screen bg-[#160E1F] text-[#F7EFE6] flex flex-col animate-in fade-in duration-200">
      {/* Admin Top Navigation */}
      <header className="bg-[#1E1428] border-b border-[#3A2A48] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#B9A9C4] hover:text-[#F7EFE6] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to App</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-2xl text-[#FFB547]">closer</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFB547]/20 text-[#FFB547] font-mono font-bold">
              Hyderabad Ops Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9FD7C7] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#9FD7C7] animate-pulse" />
            26 Oct 2026 · Systems Online
          </span>
          <span className="text-xs text-[#B9A9C4]">Admin: Operations Desk</span>
        </div>
      </header>

      {/* Admin Subnav Tabs */}
      <div className="bg-[#1A1224] border-b border-[#3A2A48] px-6 py-2 flex gap-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'safety', label: 'Safety & Reports Queue', icon: ShieldAlert, count: reports.filter((r) => r.status === 'pending').length },
          { id: 'live_dates', label: 'Live Date Safety Board', icon: MapPin, count: 1 },
          { id: 'venues', label: 'Partner Cafés & Venues', icon: Coffee },
          { id: 'rooms', label: 'Rooms Moderation', icon: Radio },
          { id: 'growth', label: 'Growth & Retention', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                playTapSound();
                setActiveTab(tab.id as typeof activeTab);
              }}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FFB547] text-[#160E1F]'
                  : 'text-[#B9A9C4] hover:text-[#F7EFE6] hover:bg-[#241830]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-[#160E1F] text-[#FFB547]' : 'bg-[#FF6B5E] text-white'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Admin Main Body */}
      <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
        {/* TAB 1: SAFETY & REPORTS QUEUE (Design 51) */}
        {activeTab === 'safety' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="md:col-span-1 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-[#F7EFE6] uppercase tracking-wider">
                  Incident Tickets
                </h3>
                <span className="text-xs text-[#B9A9C4] font-mono">
                  {reports.length} total
                </span>
              </div>

              {reports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedReport?.id === rep.id
                      ? 'border-[#FFB547] bg-[#241830] ring-1 ring-[#FFB547]'
                      : 'border-[#3A2A48] bg-[#1E1428] hover:border-[#3A2A48]/90'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-serif text-lg text-[#F7EFE6]">
                      {rep.reportedUser}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        rep.severity === 'severe'
                          ? 'bg-[#FF6B5E]/20 text-[#FF6B5E]'
                          : 'bg-[#FFB547]/20 text-[#FFB547]'
                      }`}
                    >
                      {rep.severity}
                    </span>
                  </div>

                  <p className="text-xs text-[#B9A9C4] line-clamp-1">
                    {rep.reason}
                  </p>

                  <div className="flex items-center justify-between mt-3 text-[10px] text-[#B9A9C4]">
                    <span>By {rep.reporter}</span>
                    <span
                      className={`capitalize font-bold ${
                        rep.status === 'pending'
                          ? 'text-[#FFB547]'
                          : rep.status === 'banned'
                          ? 'text-[#FF6B5E]'
                          : 'text-[#9FD7C7]'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Evidence & Action Detail */}
            {selectedReport && (
              <div className="md:col-span-2 p-6 rounded-3xl bg-[#1E1428] border border-[#3A2A48] space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#3A2A48]">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedReport.reportedAvatar}
                      alt={selectedReport.reportedUser}
                      className="w-12 h-12 rounded-full object-cover border border-[#FF6B5E]"
                    />
                    <div>
                      <h4 className="font-serif text-2xl text-[#F7EFE6]">
                        {selectedReport.reportedUser}
                      </h4>
                      <p className="text-xs text-[#B9A9C4]">
                        Reported by {selectedReport.reporter} • {selectedReport.timestamp}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-[#B9A9C4]">
                    ID: {selectedReport.id}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#B9A9C4] block mb-1">
                    Allegation
                  </label>
                  <p className="text-sm font-medium text-[#F7EFE6]">
                    {selectedReport.reason}
                  </p>
                </div>

                {/* Evidence Snippet */}
                <div className="p-4 rounded-2xl bg-[#241830] border border-[#3A2A48]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF6B5E] block mb-1.5">
                    Flagged Message Evidence
                  </span>
                  <p className="text-sm italic font-serif text-[#F7EFE6]">
                    {selectedReport.messageSnippet}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#3A2A48] flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="md"
                    className="flex-1"
                    onClick={() => handleDismissReport(selectedReport.id)}
                  >
                    Dismiss False Alarm
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1 !bg-[#FFB547] !text-[#160E1F]"
                    onClick={() => handleStrikeUser(selectedReport.id)}
                  >
                    Confirm Strike (+1 Strike)
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    className="flex-1"
                    onClick={() => handleBanUser(selectedReport.id)}
                  >
                    Instant Permanent Ban
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE DATE SAFETY BOARD (Design 49) */}
        {activeTab === 'live_dates' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif text-[#F7EFE6]">
                Active Hyderabad Date Sessions
              </h3>
              <span className="text-xs text-[#9FD7C7]">1 session flagged for review</span>
            </div>

            <div className="p-5 rounded-2xl bg-[#1E1428] border border-[#FF6B5E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#FF6B5E] bg-[#FF6B5E]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> 15-Minute Missed Check-in
                </span>
                <span className="text-xs text-[#B9A9C4] font-mono">Banjara Hills, Rd 14</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-xl text-[#F7EFE6]">
                    Arjun & Ananya • Roastery Coffee House
                  </h4>
                  <p className="text-xs text-[#B9A9C4] mt-0.5">
                    Expected check-in: 4:30 PM • 3 SMS check-ins dispatched
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs font-medium text-[#F7EFE6] hover:border-[#FFB547] flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-[#FFB547]" />
                    <span>Call User</span>
                  </button>
                  <button className="px-4 py-2 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs font-medium text-[#F7EFE6] hover:border-[#9FD7C7] flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-[#9FD7C7]" />
                    <span>Call Contact (Karthik)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PARTNER CAFÉS & VENUES (Design 50) */}
        {activeTab === 'venues' && (
          <div className="space-y-4">
            <h3 className="text-lg font-serif text-[#F7EFE6]">
              Hyderabad Partner Cafés
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'Roastery Coffee House', area: 'Banjara Hills', bookedDates: 42, checkInRate: '96%', commission: '₹4,158' },
                { name: 'Autumn Leaf Cafe', area: 'Jubilee Hills', bookedDates: 38, checkInRate: '94%', commission: '₹3,762' },
                { name: 'Roast CCX', area: 'Gachibowli', bookedDates: 29, checkInRate: '93%', commission: '₹2,871' },
                { name: 'Concu', area: 'Jubilee Hills', bookedDates: 24, checkInRate: '98%', commission: '₹2,376' },
              ].map((venue, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-xl text-[#F7EFE6]">{venue.name}</h4>
                    <span className="text-xs text-[#FFB547] font-semibold">{venue.area}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                    <div>
                      <span className="text-[#B9A9C4] block">Dates Hosted</span>
                      <span className="font-bold text-[#F7EFE6]">{venue.bookedDates}</span>
                    </div>
                    <div>
                      <span className="text-[#B9A9C4] block">Show-up Rate</span>
                      <span className="font-bold text-[#9FD7C7]">{venue.checkInRate}</span>
                    </div>
                    <div>
                      <span className="text-[#B9A9C4] block">Revenue</span>
                      <span className="font-bold text-[#FFB547]">{venue.commission}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ROOMS MODERATION (Design 52) */}
        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <h3 className="text-lg font-serif text-[#F7EFE6]">
              Live Rooms Audio Monitor
            </h3>
            <div className="space-y-3">
              {[
                { title: 'Telugu movie gossip', speakers: 4, listeners: 128, aiFlag: 'Clean (0 warnings)', status: 'Active' },
                { title: 'Late night chai', speakers: 4, listeners: 64, aiFlag: 'Clean (0 warnings)', status: 'Active' },
                { title: 'English speaking practice', speakers: 4, listeners: 41, aiFlag: 'Clean (0 warnings)', status: 'Active' },
              ].map((r, i) => (
                <div key={i} className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between">
                  <div>
                    <h4 className="font-serif text-xl text-[#F7EFE6]">{r.title}</h4>
                    <p className="text-xs text-[#9FD7C7] mt-0.5">{r.aiFlag} • {r.listeners} listeners</p>
                  </div>
                  <button className="px-3 py-1.5 rounded-xl bg-[#FF6B5E]/20 text-[#FF6B5E] text-xs font-bold hover:bg-[#FF6B5E]/30">
                    End Room
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: GROWTH & RETENTION (Design 54) */}
        {activeTab === 'growth' && (
          <div className="space-y-5">
            <h3 className="text-lg font-serif text-[#F7EFE6]">
              Closer Hyderabad Key Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                <span className="text-xs text-[#B9A9C4]">9 PM Drop Opens</span>
                <span className="font-mono text-3xl font-bold text-[#FFB547] block mt-1">82.4%</span>
                <span className="text-[10px] text-[#9FD7C7] mt-1 block">+4.2% this week</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                <span className="text-xs text-[#B9A9C4]">Dates Checked In</span>
                <span className="font-mono text-3xl font-bold text-[#9FD7C7] block mt-1">94.1%</span>
                <span className="text-[10px] text-[#9FD7C7] mt-1 block">Due to ₹99 deposit</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                <span className="text-xs text-[#B9A9C4]">Women’s Day-30 Retention</span>
                <span className="font-mono text-3xl font-bold text-[#C9A7FF] block mt-1">68.2%</span>
                <span className="text-[10px] text-[#C9A7FF] mt-1 block">Industry avg is ~22%</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48]">
                <span className="text-xs text-[#B9A9C4]">Active Streaks (≥7d)</span>
                <span className="font-mono text-3xl font-bold text-[#FFB547] block mt-1">1,480</span>
                <span className="text-[10px] text-[#9FD7C7] mt-1 block">48 founding members</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
