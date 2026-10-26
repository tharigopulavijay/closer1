export type TabType = 'drop' | 'rooms' | 'play' | 'plans' | 'you';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: 'woman' | 'man' | 'non-binary';
  location: string;
  job: string;
  languages: string[];
  intent: 'dating' | 'friends' | 'both';
  photos: string[];
  mainPhoto: string;
  isVerified: boolean;
  isVouched: boolean;
  vouchedBy?: {
    name: string;
    avatar: string;
    quote: string;
  };
  voiceAnswer?: {
    prompt: string;
    audioUrl: string;
    duration: string;
  };
  promptAnswer?: {
    prompt: string;
    answer: string;
    highlightWord?: string;
  };
  sharedInterests: string[];
  showsUpRate: string; // e.g. "6 of 6 plans"
  bio?: string;
  drinking?: string;
  food?: string;
}

export interface TableOfSix {
  id: string;
  title: string;
  topic: string;
  dateStr: string;
  timeStr: string;
  venue: string;
  area: string;
  image: string;
  totalSeats: number;
  availableSeats: number;
  attendees: { name: string; avatar: string }[];
}

export interface Room {
  id: string;
  title: string;
  category: 'cricket' | 'movies' | 'food' | 'english' | 'late-night';
  isLive: boolean;
  startTime?: string;
  speakersCount: number;
  listenersCount: number;
  speakers: { name: string; avatar: string; isMuted: boolean; isHost?: boolean }[];
  image: string;
  aiModerationOn: boolean;
  language: string;
}

export interface Plan {
  id: string;
  partner: UserProfile;
  venueName: string;
  venueArea: string;
  dateStr: string;
  timeStr: string;
  type: 'Coffee' | 'Old City Walk' | 'Dinner' | 'Badminton';
  status: 'confirmed' | 'active_date' | 'completed' | 'cancelled';
  depositAmount: number;
  depositStatus: 'locked' | 'refunded' | 'pending';
  bookingReference: string;
  chatExpiresInHours: number;
  partnerAwayStatus?: {
    isAway: boolean;
    reason: string;
    returnDate: string;
  };
  checkInStatus?: 'pending' | 'checked_in' | 'missed';
  messages: {
    id: string;
    senderId: string;
    text: string;
    timestamp: string;
    isSafetyFlagged?: boolean;
  }[];
}

export interface TrustedContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  isConfirmed: boolean;
}

export interface SafetySettings {
  checkInIntervalMinutes: 30 | 60 | 90;
  liveLocationSharing: boolean;
  hideFromAllContacts: boolean;
  trustedContacts: TrustedContact[];
}

export interface AdminReport {
  id: string;
  reportedUser: string;
  reportedAvatar: string;
  reporter: string;
  reason: string;
  severity: 'minor' | 'severe';
  category: 'harassment' | 'threats' | 'money' | 'under18' | 'other';
  messageSnippet: string;
  timestamp: string;
  status: 'pending' | 'struck' | 'banned' | 'dismissed';
}
