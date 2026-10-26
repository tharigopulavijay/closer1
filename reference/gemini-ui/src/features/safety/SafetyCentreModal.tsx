import React, { useState } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  PhoneCall, 
  AlertTriangle, 
  UserPlus, 
  MapPin, 
  Clock, 
  Check, 
  X, 
  FileWarning, 
  Send,
  Flag,
  Share2,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SEED_TRUSTED_CONTACTS } from '../../mocks/seedData';
import { TrustedContact } from '../../types';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Toggle } from '../../ui/Toggle';
import { playTapSound, playSosAlertSound, playSuccessChime } from '../../lib/audio';

interface SafetyCentreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SafetyCentreModal: React.FC<SafetyCentreModalProps> = ({ isOpen, onClose }) => {
  const [contacts, setContacts] = useState<TrustedContact[]>(SEED_TRUSTED_CONTACTS);
  const [checkInInterval, setCheckInInterval] = useState<30 | 60 | 90>(60);
  const [liveLocationSharing, setLiveLocationSharing] = useState(true);

  // Sub-sheets
  const [showAddContact, setShowAddContact] = useState(false);
  const [showReportFlow, setShowReportFlow] = useState(false);
  const [showStrikeNotice, setShowStrikeNotice] = useState(false);
  const [showSosActive, setShowSosActive] = useState(false);

  // Add contact form
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('Best Friend');

  // Report flow inputs
  const [reportReason, setReportReason] = useState('harassment');
  const [reportNotes, setReportNotes] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleTriggerEmergencySos = () => {
    playSosAlertSound();
    setShowSosActive(true);
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    playSuccessChime();
    const newContact: TrustedContact = {
      id: `tc_${Date.now()}`,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      relation: newContactRelation,
      isConfirmed: false,
    };
    setContacts([...contacts, newContact]);
    setShowAddContact(false);
    setNewContactName('');
    setNewContactPhone('');
  };

  const handleSubmitReport = () => {
    playTapSound();
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setShowReportFlow(false);
      setReportNotes('');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#160E1F] flex flex-col max-w-[430px] mx-auto overflow-hidden animate-in slide-in-from-bottom duration-250">
      {/* Header */}
      <div className="p-4 border-b border-[#3A2A48] bg-[#1E1428] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#9FD7C7]/20 border border-[#9FD7C7]/40 flex items-center justify-center text-[#9FD7C7]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-serif text-xl text-[#F7EFE6] leading-none">
              Safety Centre
            </h2>
            <span className="text-[10px] text-[#9FD7C7]">
              Hyderabad Date Protection & SOS
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-[#241830] border border-[#3A2A48] flex items-center justify-center text-[#B9A9C4] hover:text-[#F7EFE6]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
        {/* EMERGENCY SOS BANNER (Design 21 + Spec §5.5 Calm Shield) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FF6B5E]/20 to-[#FF453A]/10 border border-[#FF6B5E]/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#FF6B5E]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B5E]">
                Emergency Assistance
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#F7EFE6]">
              Dial 112 Active
            </span>
          </div>

          <p className="text-xs text-[#F7EFE6]">
            One tap immediately alerts Hyderabad Police (112), dispatches your live GPS link to your 3 trusted contacts, and flags the Closer Rapid Response Safety Team.
          </p>

          <Button
            variant="danger"
            size="md"
            onClick={handleTriggerEmergencySos}
            className="w-full !h-12 !text-xs font-black tracking-wider uppercase"
          >
            Trigger Instant SOS Alert
          </Button>
        </div>

        {/* TRUSTED CONTACTS SECTION (Design 37) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="font-serif text-xl text-[#F7EFE6]">
                Trusted Contacts ({contacts.length}/3)
              </h3>
              <p className="text-[11px] text-[#B9A9C4]">
                Alerted if you miss a check-in or trigger SOS.
              </p>
            </div>
            {contacts.length < 3 && (
              <button
                onClick={() => setShowAddContact(true)}
                className="px-2.5 py-1 rounded-full bg-[#241830] border border-[#9FD7C7] text-xs font-semibold text-[#9FD7C7] hover:bg-[#9FD7C7]/15 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-2xl bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-[#F7EFE6]">
                      {contact.name}
                    </h4>
                    <span className="text-[10px] text-[#B9A9C4]">
                      ({contact.relation})
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#B9A9C4]">
                    {contact.phone}
                  </p>
                </div>

                {contact.isConfirmed ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#9FD7C7]/20 text-[#9FD7C7] font-semibold border border-[#9FD7C7]/40 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Confirmed
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFB547]/20 text-[#FFB547] font-semibold border border-[#FFB547]/40">
                    SMS pending
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* DATE CHECK-IN INTERVAL SETTINGS */}
        <div className="p-4 rounded-2xl bg-[#1E1428] border border-[#3A2A48] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#F7EFE6] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FFB547]" /> Automated Check-in Frequency
            </span>
          </div>

          <p className="text-[11px] text-[#B9A9C4]">
            Closer sends a private push prompt during dates. If you don’t confirm within 5 mins, an automated phone call is placed.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {([30, 60, 90] as const).map((mins) => (
              <button
                key={mins}
                onClick={() => setCheckInInterval(mins)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  checkInInterval === mins
                    ? 'border-[#FFB547] bg-[#FFB547]/20 text-[#FFB547]'
                    : 'border-[#3A2A48] bg-[#241830] text-[#B9A9C4]'
                }`}
              >
                Every {mins}m
              </button>
            ))}
          </div>
        </div>

        {/* INCIDENT REPORT & STRIKE NOTICE */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => setShowReportFlow(true)}
            className="w-full p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] hover:border-[#FF6B5E]/50 flex items-center justify-between text-xs text-[#FF6B5E]"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Flag className="w-4 h-4" /> Report an account or incident
            </span>
            <span className="text-[10px] text-[#B9A9C4]">Strict 24h review</span>
          </button>

          <button
            onClick={() => setShowStrikeNotice(true)}
            className="w-full p-3.5 rounded-2xl bg-[#1E1428] border border-[#3A2A48] flex items-center justify-between text-xs text-[#B9A9C4] hover:text-[#F7EFE6]"
          >
            <span className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-[#C9A7FF]" /> Community Standing & Strike Notice
            </span>
            <span className="text-[10px] text-[#9FD7C7] font-semibold">0 Strikes</span>
          </button>
        </div>
      </div>

      {/* ACTIVE SOS MODAL */}
      {showSosActive && (
        <div className="fixed inset-0 z-50 bg-[#160E1F]/95 backdrop-blur-md flex flex-col justify-between p-6 max-w-[430px] mx-auto animate-in zoom-in-95">
          <div className="text-center pt-8">
            <div className="w-20 h-20 rounded-full bg-[#FF6B5E]/20 border-2 border-[#FF6B5E] flex items-center justify-center text-[#FF6B5E] mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h3 className="font-serif text-3xl text-[#FF6B5E] font-bold">
              Emergency SOS Triggered
            </h3>
            <p className="text-xs text-[#F7EFE6] mt-2">
              Live GPS link dispatched to <strong>Karthik</strong> and <strong>Lakshmi</strong>.
            </p>
            <p className="text-[11px] text-[#B9A9C4] mt-1 font-mono">
              Latitude: 17.4399° N, Longitude: 78.3847° E (Hitec City)
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#241830] border border-[#FF6B5E]/40 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#9FD7C7]">
              <span>WhatsApp live tracking link:</span>
              <span>SENT</span>
            </div>
            <div className="flex items-center justify-between text-[#9FD7C7]">
              <span>Closer Safety Operations Alert:</span>
              <span>DISPATCHED</span>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href="tel:112"
              className="w-full h-14 rounded-2xl bg-[#FF6B5E] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-[#fa5142]"
            >
              <PhoneCall className="w-5 h-5" />
              <span>Call 112 (Hyderabad Police)</span>
            </a>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowSosActive(false)}
            >
              Cancel Alert (I am safe)
            </Button>
          </div>
        </div>
      )}

      {/* REPORT ACCOUNT SHEET (Design 42: Report Rohit safely) */}
      <Sheet
        isOpen={showReportFlow}
        onClose={() => setShowReportFlow(false)}
        title="Report an Account"
        subtitle="Confidential review by Closer Trust & Safety team."
      >
        <div className="space-y-4">
          {!reportSubmitted ? (
            <>
              <div>
                <label className="block text-xs font-medium text-[#B9A9C4] mb-2">
                  What happened?
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'harassment', label: 'Harassment or inappropriate message' },
                    { id: 'money', label: 'Asked for money / UPI transfer' },
                    { id: 'fake', label: 'Photos do not match live person' },
                    { id: 'under18', label: 'Suspected under 18' },
                  ].map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setReportReason(r.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer ${
                        reportReason === r.id
                          ? 'border-[#FF6B5E] bg-[#FF6B5E]/15 text-[#FF6B5E] font-semibold'
                          : 'border-[#3A2A48] bg-[#1E1428] text-[#F7EFE6]'
                      }`}
                    >
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
                  Additional Details
                </label>
                <textarea
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Describe what occurred..."
                  className="w-full p-3 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:outline-none focus:border-[#FF6B5E]"
                />
              </div>

              <Button
                variant="danger"
                size="full"
                onClick={handleSubmitReport}
              >
                Submit Incident Report
              </Button>
            </>
          ) : (
            <div className="text-center py-6 space-y-2">
              <Check className="w-12 h-12 text-[#9FD7C7] mx-auto stroke-[2.5]" />
              <h4 className="font-serif text-2xl text-[#F7EFE6]">Report Received</h4>
              <p className="text-xs text-[#B9A9C4]">
                Our safety moderator will investigate within 2 hours. The user has been blocked from contacting you.
              </p>
            </div>
          )}
        </div>
      </Sheet>

      {/* STRIKE NOTICE & APPEAL SHEET (Design 44) */}
      <Sheet
        isOpen={showStrikeNotice}
        onClose={() => setShowStrikeNotice(false)}
        title="Community Standing"
        subtitle="Closer rules are strictly enforced to protect Hyderabad singles."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#9FD7C7]/15 border border-[#9FD7C7]/40 text-center">
            <ShieldCheck className="w-10 h-10 text-[#9FD7C7] mx-auto mb-1" />
            <h4 className="font-serif text-2xl text-[#9FD7C7]">Account in Good Standing</h4>
            <p className="text-xs text-[#F7EFE6] mt-1">
              You have 0 active strikes on your profile.
            </p>
          </div>

          <div className="text-xs text-[#B9A9C4] space-y-2">
            <p className="font-semibold text-[#F7EFE6]">How Closer Strikes Work:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Minor offenses (unsolicited personal info demands, ghosting booked dates): 3 strikes = permanent ban.</li>
              <li>Severe violations (threats, financial requests, nudes, under-18): Instant permanent hardware ban.</li>
            </ul>
          </div>

          <Button
            size="full"
            variant="outline"
            onClick={() => setShowStrikeNotice(false)}
          >
            Understood
          </Button>
        </div>
      </Sheet>

      {/* ADD CONTACT SHEET */}
      <Sheet
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        title="Add Trusted Contact"
        subtitle="We send an SMS verification link to your contact."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
              Contact Full Name
            </label>
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="e.g. Sravani Rao"
              className="w-full h-12 px-4 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:border-[#9FD7C7] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#B9A9C4] mb-1.5">
              Mobile Number (+91)
            </label>
            <input
              type="tel"
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              placeholder="+91 98480 12345"
              className="w-full h-12 px-4 rounded-xl bg-[#241830] border border-[#3A2A48] text-xs text-[#F7EFE6] focus:border-[#9FD7C7] focus:outline-none"
            />
          </div>

          <Button
            size="full"
            onClick={handleAddContact}
            disabled={!newContactName || !newContactPhone}
          >
            Send Verification SMS
          </Button>
        </div>
      </Sheet>
    </div>
  );
};
