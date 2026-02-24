import { RouterProvider, createRouter, createRoute, createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import LobbyPage from './pages/LobbyPage';
import ChatroomPage from './pages/ChatroomPage';
import AdminDeleteChatroomsPage from './pages/AdminDeleteChatroomsPage';
import Header from './components/Header';
import Footer from './components/Footer';
import { AlertCircle } from 'lucide-react';
import { Button } from './components/ui/button';

function RootLayout() {
  const routerState = useRouterState();
  const isChatroomPage = routerState.location.pathname.startsWith('/chatroom/');
  const isAdminPage = routerState.location.pathname.startsWith('/admin');

  return (
    <div className="flex h-full flex-col bg-background">
      {!isAdminPage && <Header />}
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      {!isChatroomPage && !isAdminPage && <Footer />}
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">404 - Page Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <Button
          onClick={() => window.location.href = '/'}
          className="mt-6"
        >
          Go to Lobby
        </Button>
      </div>
    </div>
  ),
});

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LobbyPage,
});

const chatroomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chatroom/$chatroomId',
  component: ChatroomPage,
  validateSearch: (search: Record<string, unknown>): { messageId?: string } => {
    return {
      messageId: typeof search.messageId === 'string' ? search.messageId : undefined,
    };
  },
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/delete-chatrooms',
  component: AdminDeleteChatroomsPage,
});

const routeTree = rootRoute.addChildren([lobbyRoute, chatroomRoute, adminRoute]);

const router = createRouter({ 
  routeTree,
  defaultPreload: 'intent',
  defaultNotFoundComponent: () => (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">404 - Page Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <Button
          onClick={() => window.location.href = '/'}
          className="mt-6"
        >
          Go to Lobby
        </Button>
      </div>
    </div>
  ),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
}
