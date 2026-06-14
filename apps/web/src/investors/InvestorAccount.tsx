import { useEffect, useState } from 'react';
import { useAuth } from '../auth/context';
import { fetchSessions, revokeSession, type SessionData } from '../auth/client';
import { setPageMetadata } from '../metadata';

export function InvestorAccount() {
  const { user, isAuthAvailable } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    setPageMetadata('Cuenta | MILLENNIALS CONSTRUYEN | CAPITAL', 'Configuración de cuenta de inversor en MILLENNIALS CONSTRUYEN | CAPITAL.');
  }, []);

  useEffect(() => {
    if (!isAuthAvailable) {
      setSessionsLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchSessions(controller.signal)
      .then((data) => setSessions(data))
      .catch(() => setSessionsError(true))
      .finally(() => setSessionsLoading(false));

    return () => controller.abort();
  }, [isAuthAvailable]);

  async function handleRevoke(sessionId: string) {
    setRevoking(sessionId);
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // Silently handle
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Cuenta
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Configuración de cuenta
      </h1>

      {/* ── User info card ── */}
      <section className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-textLight">Información del perfil</h2>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Nombre</dt>
            <dd className="mt-1 text-textLight">{user?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 text-textLight">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Estado</dt>
            <dd className="mt-1">
              <span className="border border-border px-2 py-0.5 text-xs font-semibold text-textLight">
                {user?.status || '—'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email verificado</dt>
            <dd className="mt-1 text-textLight">{user?.emailVerified ? 'Sí' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-muted">Roles</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {user?.roles && user.roles.length > 0
                ? user.roles.map((role) => (
                    <span key={role} className="border border-mineral/50 px-2 py-0.5 text-xs font-semibold text-mineral">{role}</span>
                  ))
                : <span className="text-muted">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Miembro desde</dt>
            <dd className="mt-1 text-textLight">
              {user?.createdAt
                ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(user.createdAt))
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Sessions ── */}
      {isAuthAvailable ? (
        <section className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-textLight">Sesiones activas</h2>
          <p className="mt-2 text-sm text-muted">
            Dispositivos y navegadores donde has iniciado sesión.
          </p>

          {sessionsLoading ? (
            <div className="mt-4 flex items-center gap-3 text-muted" role="status">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-mineral" aria-hidden="true" />
              Cargando sesiones…
            </div>
          ) : sessionsError ? (
            <p className="mt-4 text-sm text-muted">No se pudieron cargar las sesiones.</p>
          ) : sessions.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No hay sesiones activas.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-textLight">
                      {session.isCurrent ? (
                        <span className="mr-2 border border-mineral/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-mineral">Actual</span>
                      ) : null}
                      Sesión del {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(session.createdAt))}
                    </p>
                    <p className="text-xs text-muted">
                      Expira: {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(session.expiresAt))}
                    </p>
                  </div>
                  {!session.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => handleRevoke(session.id)}
                      disabled={revoking === session.id}
                      className="shrink-0 border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted transition hover:border-danger hover:text-danger disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-mineralHover"
                    >
                      {revoking === session.id ? 'Cerrando…' : 'Cerrar'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
          <h2 className="font-serif text-2xl text-textLight">Sesiones</h2>
          <p className="mt-2 text-sm text-muted">
            La gestión de sesiones estará disponible cuando la autenticación se habilite.
          </p>
        </section>
      )}
    </div>
  );
}
