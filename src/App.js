/**
 * Application shell: wires session, routing, responsive layout, sidebar,
 * views, the floating agent dock and modals.
 */
import { h, useCallback, useEffect, useState } from './core/runtime.js';
import { api } from './core/api.js';
import { useAuth } from './hooks/useAuth.js';
import { useTheme } from './hooks/useTheme.js';
import { useRoute } from './hooks/useRoute.js';
import { useModal } from './hooks/useModal.js';
import { useChat } from './hooks/useChat.js';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';
import { useIsMobile } from './hooks/useMediaQuery.js';
import { useInsightsAlert } from './hooks/useInsightsAlert.js';
import { Toast } from './components/Toast.js';
import { Sidebar } from './components/Sidebar.js';
import { MobileTopBar } from './components/MobileTopBar.js';
import { AgentFab } from './components/AgentFab.js';
import { AgentDock } from './components/AgentDock.js';
import { LoginView } from './views/LoginView.js';
import { ChangePasswordView } from './views/ChangePasswordView.js';
import { UsersView } from './views/UsersView.js';
import { SettingsView } from './views/SettingsView.js';
import { AgentView } from './views/AgentView.js';
import { OrdersView } from './views/OrdersView.js';
import { ExpensesView } from './views/ExpensesView.js';
import { ReportsView } from './views/ReportsView.js';
import { LibraryView } from './views/LibraryView.js';
import { NewOrderModal } from './modals/NewOrderModal.js';
import { NewExpenseModal } from './modals/NewExpenseModal.js';
import { ImportModal } from './modals/ImportModal.js';

export function App() {
  const auth = useAuth();
  const theme = useTheme();
  const { route, navigate } = useRoute();
  const { modal, open, close } = useModal();
  const install = useInstallPrompt();
  const online = useOnlineStatus();
  const isMobile = useIsMobile();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  // Bumping this key makes data views refetch after a mutation.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const [conversations, setConversations] = useState([]);

  // El backend escucha el endpoint y la hoja; este hook solo pregunta si el
  // análisis quedó viejo y avisa con un toast, sin regenerar nada.
  const insightsAlert = useInsightsAlert(auth.isAuthenticated && !auth.mustChangePassword);

  const loadConversations = useCallback(async () => {
    try {
      const { items } = await api.listConversations();
      setConversations(items);
    } catch {
      // The sidebar history is optional; ignore failures.
    }
  }, []);

  // One chat thread shared by the full view and the floating dock.
  const chat = useChat({
    onConversationChanged: loadConversations,
    // A tool that wrote to the database refreshes the open views instantly.
    onDataChanged: refresh,
  });

  useEffect(() => {
    if (auth.isAuthenticated) loadConversations();
  }, [auth.isAuthenticated]);

  if (!auth.isAuthenticated) {
    return h(LoginView, { onLogin: auth.login });
  }

  // An account created or reset by an admin picks its own password first;
  // nothing else in the panel is reachable until then.
  if (auth.mustChangePassword) {
    return h(ChangePasswordView, {
      email: auth.email,
      onSubmit: auth.changePassword,
      onCancel: auth.logout,
    });
  }

  const openConversation = async (id) => {
    await chat.open(id);
    navigate('agent');
    setDockOpen(false);
  };

  const newConversation = () => {
    chat.reset();
    navigate('agent');
    setDockOpen(false);
  };

  const deleteConversation = async (id) => {
    await api.deleteConversation(id);
    if (chat.conversationId === id) chat.reset();
    loadConversations();
  };

  const deleteConversations = async (ids) => {
    await api.deleteConversations(ids);
    // An empty list clears everything, so drop the open thread when it went too.
    if (ids.length === 0 || ids.includes(chat.conversationId)) chat.reset();
    loadConversations();
  };

  const views = {
    agent: () => h(AgentView, { chat, email: auth.email }),
    orders: () => h(OrdersView, { onOpenModal: open, refreshKey, onChanged: refresh }),
    expenses: () => h(ExpensesView, { onOpenModal: open, refreshKey, onChanged: refresh }),
    reports: () => h(ReportsView, { refreshKey }),
    library: () => h(LibraryView, { refreshKey }),
    // Guarded here too: the entry is hidden for members, and so is the view.
    settings: () => h(SettingsView, { isAdmin: auth.isAdmin, theme }),
    users: () => (auth.isAdmin
      ? h(UsersView, { currentUserId: auth.user?.id, onSelfUpdated: auth.refreshUser })
      : h(AgentView, { chat, email: auth.email })),
  };

  const modals = {
    'new-order': () => h(NewOrderModal, {
      catalogs: modal.payload?.catalogs,
      onClose: close,
      onSaved: () => { close(); refresh(); },
    }),
    'new-expense': () => h(NewExpenseModal, {
      onClose: close,
      onSaved: () => { close(); refresh(); },
    }),
    import: () => h(ImportModal, {
      kind: modal.payload.kind,
      onClose: close,
      onImported: refresh,
    }),
  };

  // The dock only makes sense outside the agent view, which already has a composer.
  const dockAvailable = route !== 'agent';

  return h('div', { className: `app ${isMobile ? 'app--mobile' : ''}`.trim() },
    isMobile
      ? h(MobileTopBar, {
          onToggleMenu: () => setMenuOpen((value) => !value),
          onToggleTheme: theme.toggle,
          isDark: theme.isDark,
        })
      : null,

    h(Sidebar, {
      route,
      onNavigate: navigate,
      conversations,
      activeConversationId: chat.conversationId,
      onOpenConversation: openConversation,
      email: auth.email,
      isAdmin: auth.isAdmin,
      role: auth.role,
      onLogout: auth.logout,
      isDark: theme.isDark,
      onToggleTheme: theme.toggle,
      canInstall: install.available,
      onInstall: install.install,
      online,
      isMobile,
      isOpen: menuOpen,
      onClose: () => setMenuOpen(false),
      onDeleteConversation: deleteConversation,
      onDeleteConversations: deleteConversations,
      onNewConversation: newConversation,
    }),

    h('main', { className: 'main' }, (views[route] || views.agent)()),

    dockAvailable && dockOpen
      ? h(AgentDock, {
          chat,
          view: route,
          email: auth.email,
          onClose: () => setDockOpen(false),
          onExpand: () => { setDockOpen(false); navigate('agent'); },
          // Starts a fresh thread without leaving the current screen.
          onNewConversation: () => { chat.reset(); loadConversations(); },
        })
      : null,

    dockAvailable && !dockOpen
      ? h(AgentFab, { onClick: () => setDockOpen(true) })
      : null,

    insightsAlert.alert
      ? h(Toast, {
          message: 'Entró información nueva. Actualice el análisis si desea verla reflejada.',
          actionLabel: 'Ver análisis',
          onAction: () => { insightsAlert.dismiss(); navigate('reports'); },
          onClose: insightsAlert.dismiss,
        })
      : null,

    modal ? modals[modal.name]?.() : null);
}
