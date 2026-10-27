import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AdminApp, Dates, Growth, Reports, RoomsMonitor, Venues } from "./features/admin/Admin";
import { DropHome, Mutual, Profile, StreakScreen } from "./features/drop/Drop";
import { Onboarding } from "./features/onboarding/Onboarding";
import { Antakshari, Housie, LudoScreen, PlayLobby, Quiz, ThisOrThat } from "./features/play/Play";
import { AwayScreen, Debrief, PlanChat, PlanDetail, PlansHome } from "./features/plans/Plans";
import { ChaiBreak, CreateRoom, LiveRoom, RoomsHome } from "./features/rooms/Rooms";
import { CheckInPrompt, DateDay, ReportFlow, SafetyHome, SafetySetup, StrikeNotice } from "./features/safety/Safety";
import { GiftClaim, Licences, Plus, PreferencesEdit, Saathi, Settings, Welcome, YouHome } from "./features/you/You";
import { Login, Waiting } from "./features/auth/Login";
import { sessionToken } from "./lib/api";
import { isLive } from "./lib/env";
import { accountVerified } from "./state/live";
import { useStore } from "./state/store";
import { Phone } from "./ui/shell";

function Home() {
  const { state } = useStore();
  if (state.deletedAt) return <Welcome />;
  if (isLive() && sessionToken() && state.draft.completed && !accountVerified()) return <Navigate to="/waiting" replace />;
  if (state.ready && accountVerified()) return <Navigate to="/drop" replace />;
  return <Welcome />;
}

function RequireReady({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  if (isLive() && !sessionToken()) return <Navigate to="/login" replace />;
  if (isLive() && !accountVerified()) return <Navigate to="/waiting" replace />;
  if (state.deletedAt || !state.ready) return <Navigate to="/" replace />;
  return children;
}

function PhoneLayout() {
  return (
    <Phone>
      <Outlet />
    </Phone>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminApp />}>
        <Route index element={<Reports />} />
        <Route path="dates" element={<Dates />} />
        <Route path="venues" element={<Venues />} />
        <Route path="rooms" element={<RoomsMonitor />} />
        <Route path="growth" element={<Growth />} />
      </Route>
      <Route element={<PhoneLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/waiting" element={<Waiting />} />
        <Route path="/onboarding/:step" element={<Onboarding />} />
        <Route path="/drop" element={<RequireReady><DropHome /></RequireReady>} />
        <Route path="/person/:id" element={<RequireReady><Profile /></RequireReady>} />
        <Route path="/streak" element={<RequireReady><StreakScreen /></RequireReady>} />
        <Route path="/match/:id" element={<RequireReady><Mutual /></RequireReady>} />
        <Route path="/rooms" element={<RequireReady><RoomsHome /></RequireReady>} />
        <Route path="/rooms/new" element={<RequireReady><CreateRoom /></RequireReady>} />
        <Route path="/rooms/chai" element={<RequireReady><ChaiBreak /></RequireReady>} />
        <Route path="/rooms/:id" element={<RequireReady><LiveRoom /></RequireReady>} />
        <Route path="/play" element={<RequireReady><PlayLobby /></RequireReady>} />
        <Route path="/play/ludo" element={<RequireReady><LudoScreen /></RequireReady>} />
        <Route path="/play/this-or-that" element={<RequireReady><ThisOrThat /></RequireReady>} />
        <Route path="/play/quiz" element={<RequireReady><Quiz /></RequireReady>} />
        <Route path="/play/housie" element={<RequireReady><Housie /></RequireReady>} />
        <Route path="/play/antakshari" element={<RequireReady><Antakshari /></RequireReady>} />
        <Route path="/plans" element={<RequireReady><PlansHome /></RequireReady>} />
        <Route path="/plans/:id" element={<RequireReady><PlanDetail /></RequireReady>} />
        <Route path="/plans/:id/chat" element={<RequireReady><PlanChat /></RequireReady>} />
        <Route path="/plans/:id/debrief" element={<RequireReady><Debrief /></RequireReady>} />
        <Route path="/away" element={<RequireReady><AwayScreen /></RequireReady>} />
        <Route path="/you" element={<RequireReady><YouHome /></RequireReady>} />
        <Route path="/you/preferences" element={<RequireReady><PreferencesEdit /></RequireReady>} />
        <Route path="/you/plus" element={<RequireReady><Plus /></RequireReady>} />
        <Route path="/you/gift" element={<RequireReady><GiftClaim /></RequireReady>} />
        <Route path="/you/saathi" element={<RequireReady><Saathi /></RequireReady>} />
        <Route path="/you/settings" element={<RequireReady><Settings /></RequireReady>} />
        <Route path="/you/licences" element={<RequireReady><Licences /></RequireReady>} />
        <Route path="/safety" element={<RequireReady><SafetyHome /></RequireReady>} />
        <Route path="/safety/setup" element={<RequireReady><SafetySetup /></RequireReady>} />
        <Route path="/safety/date/:planId" element={<RequireReady><DateDay /></RequireReady>} />
        <Route path="/safety/checkin/:planId" element={<RequireReady><CheckInPrompt /></RequireReady>} />
        <Route path="/safety/report" element={<RequireReady><ReportFlow /></RequireReady>} />
        <Route path="/safety/strike" element={<RequireReady><StrikeNotice /></RequireReady>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
