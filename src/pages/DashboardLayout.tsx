import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Building2, BriefcaseBusiness, Users, Send, Inbox,
  Settings, Menu, X, Zap, ChevronRight, ChevronLeft, Linkedin,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

export type DashboardPage = 'overview' | 'clients' | 'candidates' | 'leads' | 'linkedin' | 'campaigns' | 'inboxkit' | 'replyio' | 'settings' | 'inbox';

const navItems: { id: DashboardPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'inboxkit', label: 'InboxKit', icon: Inbox },
  { id: 'replyio', label: 'ReplyIO', icon: Send },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'campaigns', label: 'Campaigns', icon: Zap },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 68;

export default function DashboardLayout({
  activePage,
  onNavigate,
  children,
}: {
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const initials = (profile?.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 40, display: "none" }}
          className="dash-mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth, flexShrink: 0, background: "#fff", borderRight: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column", transition: "width 0.2s ease",
        position: "sticky", top: 0, height: "100vh", overflow: "hidden", zIndex: 30,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: collapsed ? "20px 14px" : "20px 20px 16px" }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              <img
                src="/images/favicon.svg"
                alt="HubCredo"
                style={{ height: 32, width: "auto", objectFit: "contain", display: "block", flexShrink: 0 }}
              />
            </div>
          )}
          {collapsed && (
            <img
              src="/images/favicon.svg"
              alt="HubCredo"
              style={{ height: 35, width: 'auto', objectFit: "contain", display: "block", flexShrink: 0 }}
            />
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#64748B", cursor: "pointer", flexShrink: 0 }}
          >
            {collapsed ? <ChevronRight style={{ width: 14, height: 14 }} /> : <ChevronLeft style={{ width: 14, height: 14 }} />}
          </button>
        </div>

        {!collapsed && (
          <button style={{
            margin: "0 16px 16px", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
            background: "#F5F3FF", border: "1px solid #E0D9FF", borderRadius: 10, cursor: "pointer", textAlign: "left",
          }}>
            <Zap style={{ width: 15, height: 15, color: "#6B4EFF", flexShrink: 0 }} />
            <strong style={{ fontSize: "0.8125rem", color: "#0A0A0A", flex: 1 }}>{(profile as any)?.credits ?? 90} credits</strong>
            <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: "#6B4EFF", fontWeight: 600, whiteSpace: "nowrap" }}>
              Top up <ChevronRight style={{ width: 12, height: 12 }} />
            </span>
          </button>
        )}

        <nav style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
          {!collapsed && (
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: ".06em", margin: "8px 10px" }}>NAVIGATION</p>
          )}
          {navItems.map(item => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                title={collapsed ? item.label : undefined}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: collapsed ? "10px 0" : "10px 12px", justifyContent: collapsed ? "center" : "flex-start",
                  marginBottom: 2, borderRadius: 9, border: "none", cursor: "pointer",
                  background: active ? "#2563EB" : "transparent",
                  color: active ? "#fff" : "#374151",
                  fontSize: "0.875rem", fontWeight: active ? 700 : 500,
                }}
              >
                <item.icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 14, borderTop: "1px solid #F1F5F9" }}>
          <button
            onClick={signOut}
            style={{
              width: "100%", padding: "9px 0", border: "1px solid #E2E8F0", borderRadius: 9,
              background: "#fff", color: "#64748B", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {collapsed ? "⏻" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px", borderBottom: "1px solid #E2E8F0", background: "#fff",
        }}>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="dash-mobile-toggle"
            style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#374151" }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: "50%", background: "#EFF6FF", color: "#2563EB",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700,
            }}>{initials}</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A" }}>{profile?.full_name || 'User'}</span>
          </div>
        </header>
        <div style={{ flex: 1 }}>{children}</div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dash-mobile-toggle { display: block !important; }
          .dash-mobile-overlay { display: block !important; }
          aside { position: fixed !important; }
        }
      `}</style>
    </div>
  );
}