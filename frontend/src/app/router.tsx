import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/features/dashboard/OverviewPage';
import { LiquidityPage } from '@/features/liquidity/LiquidityPage';
import { ClaimsPage } from '@/features/claims/ClaimsPage';
import { ClaimDetailPage } from '@/features/claims/ClaimDetailPage';
import { SettlementPage } from '@/features/settlement/SettlementPage';
import { BenchmarkPage } from '@/features/benchmark/BenchmarkPage';
import { ProtocolPage } from '@/features/protocol/ProtocolPage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { UserPage } from '@/features/user/UserPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="user" element={<UserPage />} />
      <Route element={<AppShell />}>
        <Route path="dashboard" element={<OverviewPage />} />
        <Route path="liquidity" element={<LiquidityPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="claims/:claimId" element={<ClaimDetailPage />} />
        <Route path="settlement" element={<SettlementPage />} />
        <Route path="benchmark" element={<BenchmarkPage />} />
        <Route path="protocol" element={<ProtocolPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
