import React from 'react';
import { Briefcase, MapPin, Heart, ChevronRight } from 'lucide-react';
import { UserProfile } from '../types';
import { VerifiedPill } from './VerifiedPill';
import { playTapSound } from '../lib/audio';

interface PersonCardProps {
  profile: UserProfile;
  onClick: (profile: UserProfile) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({ profile, onClick }) => {
  const handleClick = () => {
    playTapSound();
    onClick(profile);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-[#1E1428] hover:bg-[#241830] border border-[#3A2A48] hover:border-[#FFB547]/40 rounded-[22px] p-3.5 flex items-center gap-3.5 cursor-pointer transition-all duration-200 active:scale-[0.99] group shadow-sm"
    >
      {/* Portrait photo */}
      <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-[#2A1C38] border border-[#3A2A48]/50">
        <img
          src={profile.mainPhoto}
          alt={profile.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            // Fallback placeholder
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400';
          }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-serif text-xl text-[#F7EFE6] leading-none">
            {profile.name}, {profile.age}
          </h3>
          {profile.isVouched && <VerifiedPill type="vouched" />}
        </div>

        <div className="space-y-0.5 text-xs text-[#B9A9C4]">
          <div className="flex items-center gap-1.5 truncate">
            <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-[#B9A9C4]" />
            <span className="truncate">{profile.job}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[#B9A9C4]" />
            <span className="truncate">{profile.location.split(',')[0]}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs truncate text-[#F7EFE6]/90">
            <Heart className="w-3.5 h-3.5 flex-shrink-0 text-[#C9A7FF]" />
            <span className="truncate">
              You both: <span className="text-[#C9A7FF]">{profile.sharedInterests.slice(0, 2).join(', ')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Chevron button */}
      <div className="w-9 h-9 rounded-full bg-[#2E1E3D] border border-[#4B365E] flex items-center justify-center text-[#F7EFE6] group-hover:bg-[#FFB547] group-hover:text-[#160E1F] group-hover:border-[#FFB547] transition-all flex-shrink-0">
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
};
