import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from '@/app/AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireOnboarding } from '@/features/auth/RequireOnboarding'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { ActivityPage } from '@/pages/ActivityPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { CreateLeaguePage } from '@/pages/CreateLeaguePage'
import { JoinLeaguePage } from '@/pages/JoinLeaguePage'
import { LeagueHomePage } from '@/pages/LeagueHomePage'
import { LeagueListPage } from '@/pages/LeagueListPage'
import { LeagueLobbyPage } from '@/pages/LeagueLobbyPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StandingsPage } from '@/pages/StandingsPage'
import { TribePage } from '@/pages/TribePage'
import { AdminPage } from '@/pages/AdminPage'
import { DraftRoomPage } from '@/pages/DraftRoomPage'
import { EpisodeDetailPage } from '@/pages/EpisodeDetailPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { LeagueRulesPage } from '@/pages/LeagueRulesPage'
import { MergeMovePage } from '@/pages/MergeMovePage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/join" element={<JoinLeaguePage />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell />
              </RequireOnboarding>
            </RequireAuth>
          }
        >
          <Route path="/leagues" element={<LeagueListPage />} />
          <Route path="/leagues/new" element={<CreateLeaguePage />} />
          <Route path="/leagues/:leagueId" element={<LeagueLobbyPage />} />
          <Route path="/leagues/:leagueId/draft" element={<DraftRoomPage />} />
          <Route path="/league" element={<LeagueHomePage />} />
          <Route path="/league/rules" element={<LeagueRulesPage />} />
          <Route path="/league/episodes/:episodeNumber" element={<EpisodeDetailPage />} />
          <Route path="/league/merge" element={<MergeMovePage />} />
          <Route path="/tribe" element={<TribePage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
