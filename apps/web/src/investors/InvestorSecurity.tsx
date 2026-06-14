import { useEffect } from 'react';
import { useAuth } from '../auth/context';
import { setPageMetadata } from '../metadata';

export function InvestorSecurity() {
  const { isAuthAvailable } = useAuth();

  useEffect(() => {
    setPageMetadata('Seguridad | MILLENNIALS CONSTRUYEN | CAPITAL', 'Seguridad de la cuenta de inversor en MILLENNIALS CONSTRUYEN | CAPITAL.');
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-mineral">
        Seguridad
      </p>
      <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
        Seguridad de la cuenta
      </h1>

      {/* ── Security overview ── */}
      <section className="mt-8 border border-border bg-petroleum p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-textLight">Historial de sesiones y seguridad</h2>
        <p className="mt-4 leading-7 text-muted">
          La seguridad de tu cuenta es una prioridad. Desde aquí podrás revisar la actividad reciente,
          gestionar dispositivos autorizados y configurar medidas de protección adicionales.
        </p>
      </section>

      {/* ── Placeholder sections ── */}
      <div className="mt-6 grid gap-4">
        <section className="border border-border bg-carbon p-6">
          <h3 className="font-serif text-xl text-textLight">Cambiar contraseña</h3>
          <p className="mt-2 text-sm text-muted">
            Disponible cuando la autenticación esté habilitada.
          </p>
        </section>

        <section className="border border-border bg-carbon p-6">
          <h3 className="font-serif text-xl text-textLight">Autenticación en dos pasos</h3>
          <p className="mt-2 text-sm text-muted">
            La verificación en dos pasos añade una capa extra de seguridad a tu cuenta. Estará disponible en próximos hitos.
          </p>
        </section>

        <section className="border border-border bg-carbon p-6">
          <h3 className="font-serif text-xl text-textLight">Registro de actividad</h3>
          <p className="mt-2 text-sm text-muted">
            El historial de accesos y actividad de la cuenta se mostrará aquí cuando la funcionalidad esté disponible.
          </p>
        </section>

        <section className="border border-border bg-carbon p-6">
          <h3 className="font-serif text-xl text-textLight">Dispositivos autorizados</h3>
          <p className="mt-2 text-sm text-muted">
            Gestiona los dispositivos desde los que has iniciado sesión.
            {isAuthAvailable ? ' Puedes revisar las sesiones activas en la sección de Cuenta.' : ''}
          </p>
        </section>
      </div>

      {/* ── Honest note ── */}
      <div className="mt-8 border border-border bg-petroleum p-4 text-sm leading-6 text-muted">
        Las funcionalidades avanzadas de seguridad (2FA, notificaciones de inicio de sesión, registro de actividad detallado) estarán disponibles en próximos hitos.
      </div>
    </div>
  );
}
