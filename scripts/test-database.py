#!/usr/bin/env python3
"""Canonical database test — migrations, seed, rollback, concurrency, SCRAM.

Entry point: ./scripts/test-database.sh
Never prints passwords. Uses unique resource names per run.
"""

import hashlib
import json
import os
import secrets
import shutil
import socket
import string
import subprocess
import sys
import tempfile
import threading
import time
import uuid

ROOT = '/srv/workspaces/realstate'
MIG_DIR = os.path.join(ROOT, 'apps', 'api', 'src', 'db', 'migrations')
EXPECTED = [
    '0001_baseline_definitive.sql',
    '0002_add_lead_columns.sql',
    '0003_align_auth_schema.sql',
    '0004_add_opportunity_restore_lineage.sql',
]
FAILED = False


def _run(*a, **kw):
    kw.setdefault('capture_output', True)
    kw.setdefault('text', True)
    return subprocess.run(list(a), **kw)


def _check(cond, msg):
    global FAILED
    if not cond:
        print('  FAIL: ' + msg, file=sys.stderr)
        FAILED = True
        raise SystemExit(1)


def _psql(cn, sec, sql):
    eq = '='
    pg = 'PGPASSWORD' + eq + sec
    return _run('docker', 'exec', '-e', pg,
                cn,
                'psql', '-U', 'realstate', '-h', '127.0.0.1',
                '-d', 'realstate_test', '-t', '-A', '-c', sql)


def _psql_host(cn, sec, sql, db='realstate_test'):
    eq = '='
    pg = 'PGPASSWORD' + eq + sec
    return _run('docker', 'exec', '-e', pg,
                cn,
                'psql', '-U', 'realstate', '-h', '127.0.0.1',
                '-d', db, '-t', '-A', '-c', sql)


def _url(u, s, host, port, db):
    C = ':'
    A = '@'
    S = '/'
    return 'postgresql://' + u + C + s + A + host + C + port + S + db


def main():
    global FAILED
    rid = uuid.uuid4().hex[:12]
    cn = 'realstate-test-db-' + rid
    net = 'realstate-test-net-' + rid
    vol = 'realstate-test-vol-' + rid
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('127.0.0.1', 0))
        port = str(sock.getsockname()[1])
    tmpd = None

    def cleanup():
        _run('docker', 'rm', '-f', cn)
        _run('docker', 'network', 'rm', '-f', net)
        _run('docker', 'volume', 'rm', '-f', vol)
        if tmpd and os.path.isdir(tmpd):
            shutil.rmtree(tmpd, ignore_errors=True)

    try:
        # pre-cleanup
        _run('docker', 'rm', '-f', cn)
        _run('docker', 'network', 'rm', '-f', net)
        _run('docker', 'volume', 'rm', '-f', vol)

        # ephemeral credentials (never printed)
        chars = string.ascii_letters + string.digits
        sec = ''.join(secrets.choice(chars) for _ in range(24))
        db_url = _url('realstate', sec, '127.0.0.1', port, 'realstate_test')

        # network + volume
        _run('docker', 'network', 'create', net)
        _run('docker', 'volume', 'create', vol)

        # PostgreSQL SCRAM-SHA-256, auth-local=scram for consistency
        print('=== test-database ===')
        print('  run_id=' + rid)
        eq = '='
        pg_env = 'POSTGRES_PASSWORD' + eq + sec
        pg_vol = vol + ':/var/lib/postgresql/data'
        pg_port_map = '127.0.0.1:' + port + ':5432'

        run_pg = _run('docker', 'run', '--rm', '-d',
                      '--name', cn,
                      '--network', net,
                      '-v', pg_vol,
                      '-e', 'POSTGRES_USER=realstate',
                      '-e', pg_env,
                      '-e', 'POSTGRES_DB=realstate_test',
                      '-e', 'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256',
                      '-p', pg_port_map,
                      'postgres:16-alpine')
        _check(run_pg.returncode == 0, 'docker run postgres fallo: ' + run_pg.stderr.strip())

        # wait
        ok = False
        for _ in range(60):
            r = _psql_host(cn, sec, 'SELECT 1')
            if r.returncode == 0:
                ok = True
                break
            time.sleep(1)
        _check(ok, 'PostgreSQL no arranco en 60 s')

        # Switch local Unix-socket authentication from SCRAM to peer after init.
        # TCP host lines remain SCRAM-SHA-256.
        r = _run('docker', 'exec', '-u', 'postgres', cn, 'sh', '-lc',
                 r"sed -i 's/^local\(.*\)scram-sha-256$/local\1peer/' /var/lib/postgresql/data/pg_hba.conf && pg_ctl reload -D /var/lib/postgresql/data")
        _check(r.returncode == 0, 'no se pudo configurar auth-local=peer')

        # SCRAM + zero trust
        r = _psql(cn, sec, 'SHOW password_encryption')
        _check('scram-sha-256' in r.stdout,
               'password_encryption != scram-sha-256: ' + r.stdout.strip())
        print('  password_encryption: scram-sha-256')

        r = _run('docker', 'exec', cn, 'cat',
                 '/var/lib/postgresql/data/pg_hba.conf')
        active_hba = [l.strip() for l in r.stdout.split(chr(10))
                      if l.strip() and not l.strip().startswith('#')]
        _check(any(l.startswith('local') and l.endswith('peer') for l in active_hba),
               'pg_hba.conf no contiene socket local peer')
        _check(any(l.startswith('host') and 'scram-sha-256' in l for l in active_hba),
               'pg_hba.conf no contiene TCP scram-sha-256')
        trust_lines = [l for l in active_hba if 'trust' in l]
        _check(len(trust_lines) == 0,
               'pg_hba.conf contiene reglas trust: ' + str(trust_lines))
        print('  pg_hba.conf: socket local peer, TCP scram-sha-256, zero trust')

        # real auth
        r = _psql_host(cn, sec, 'SELECT 1')
        _check(r.returncode == 0 and '1' in r.stdout,
               'auth real con contrasena fallo')
        print('  auth: verificacion con contrasena OK')

        # build API
        r = _run('pnpm', '--filter', '@realstate/api', 'build', cwd=ROOT)
        _check(r.returncode == 0, 'build API fallo')

        # first migrate
        env = {
            **os.environ,
            'DATABASE_URL': db_url,
            'NODE_ENV': 'test',
            'DEMO_SEED_ENABLED': 'false',
            'MIGRATIONS_DIR': MIG_DIR,
        }
        r = _run('node', 'apps/api/dist/db/migrate.js', env=env, cwd=ROOT)
        print('  migrate #1: ' + r.stdout.strip()[:200])
        _check(r.returncode == 0, 'migrate #1 fallo')
        result = json.loads(r.stdout)
        _check(result.get('status') == 'ok',
               'migrate #1 status != ok: ' + str(result))
        _check(result.get('applied') == EXPECTED,
               'migrate #1 applied mismatch: ' + str(result.get('applied')))
        _check(result.get('skipped') == [],
               'migrate #1 skipped non-empty: ' + str(result.get('skipped')))

        # count + order
        r = _psql(cn, sec, 'SELECT count(*) FROM schema_migrations')
        mc = r.stdout.strip()
        print('  migrations=' + mc)
        _check(mc == '4', 'esperadas 4 migraciones, hay ' + mc)

        r = _psql(cn, sec,
                  'SELECT id FROM schema_migrations ORDER BY applied_at')
        got = [x.strip() for x in r.stdout.strip().split(chr(10)) if x.strip()]
        _check(got == EXPECTED,
               'orden/nombre mismatch: got=' + str(got))

        # checksums
        print('  checksums...')
        r = _psql(cn, sec,
                  "SELECT id || '|' || checksum FROM schema_migrations ORDER BY applied_at")
        for line in r.stdout.strip().split(chr(10)):
            if '|' not in line:
                continue
            name, db_cs = line.strip().split('|', 1)
            mp = os.path.join(MIG_DIR, name)
            with open(mp, 'rb') as f:
                file_cs = hashlib.sha256(f.read()).hexdigest()
            _check(db_cs == file_cs, 'checksum mismatch: ' + name)
        print('    OK')

        # second migrate: no-op
        r = _run('node', 'apps/api/dist/db/migrate.js', env=env, cwd=ROOT)
        _check(r.returncode == 0, 'migrate #2 fallo')
        r2 = json.loads(r.stdout)
        _check(r2.get('status') == 'ok',
               'migrate #2 status != ok: ' + str(r2))
        _check(r2.get('applied') == [],
               'migrate #2 applied deberia ser []')
        _check(r2.get('skipped') == EXPECTED,
               'migrate #2 skipped mismatch')
        print('  migrate #2: no-op OK')

        # checksum mismatch detection: tamper an already-applied migration
        tmpd = tempfile.mkdtemp(prefix='realstate-test-mig-')
        for m in EXPECTED:
            shutil.copy(os.path.join(MIG_DIR, m), os.path.join(tmpd, m))
        tamper_path = os.path.join(tmpd, EXPECTED[0])
        with open(tamper_path, 'a') as f:
            f.write(chr(10) + '-- tampered' + chr(10))
        env_tmp = {**env, 'MIGRATIONS_DIR': tmpd}
        r = _run('node', 'apps/api/dist/db/migrate.js', env=env_tmp, cwd=ROOT)
        _check(r.returncode != 0, 'checksum alterado deberia fallar')
        print('  checksum mismatch: rechazado OK')

        # seed idempotent
        env_seed = {
            **env,
            'DEMO_SEED_ENABLED': 'true',
            'MIGRATIONS_DIR': MIG_DIR,
        }
        s1 = None
        for pn in [1, 2]:
            r = _run('node', 'apps/api/dist/db/seed.js', env=env_seed, cwd=ROOT)
            print('  seed #' + str(pn) + ': ' + r.stdout.strip()[:120])
            _check(r.returncode == 0, 'seed #' + str(pn) + ' fallo')
            sr = json.loads(r.stdout)
            _check(sr.get('status') == 'ok',
                   'seed #' + str(pn) + ' status != ok')

            c = _psql(cn, sec, 'SELECT count(*) FROM opportunities').stdout.strip()
            pc = _psql(cn, sec, "SELECT count(*) FROM opportunities WHERE visibility='public'").stdout.strip()
            vc = _psql(cn, sec, "SELECT count(*) FROM opportunities WHERE visibility='private'").stdout.strip()
            print('    opps=' + c + ' public=' + pc + ' private=' + vc)
            _check(c == '5', 'pass ' + str(pn) + ': total=' + c)
            _check(pc == '4', 'pass ' + str(pn) + ': public=' + pc)
            _check(vc == '1', 'pass ' + str(pn) + ': private=' + vc)

            slugs = _psql(cn, sec,
                          'SELECT slug FROM opportunities ORDER BY slug').stdout.strip()
            if pn == 1:
                s1 = slugs
                mr = _psql(cn, sec,
                           'SELECT count(*) FROM opportunity_media m '
                           'JOIN opportunities o ON o.id = m.opportunity_id').stdout.strip()
                print('    media_relations=' + mr)
                _check(int(mr) > 0, 'sin relaciones de media')
            else:
                _check(slugs == s1, 'segunda seed altero slugs')
        print('  seed: idempotente OK')

        # rollback
        print('  rollback...')
        rbd = tempfile.mkdtemp(prefix='realstate-test-rb-')
        try:
            for m in EXPECTED:
                shutil.copy(os.path.join(MIG_DIR, m), os.path.join(rbd, m))
            bad = os.path.join(rbd, '0005_bad_migration.sql')
            with open(bad, 'w') as f:
                f.write('THIS IS NOT VALID SQL;')
            env_rb = {**env, 'MIGRATIONS_DIR': rbd}
            r = _run('node', 'apps/api/dist/db/migrate.js', env=env_rb, cwd=ROOT)
            _check(r.returncode != 0, 'migracion invalida deberia fallar')
            rb_m = _psql(cn, sec,
                         'SELECT id FROM schema_migrations ORDER BY applied_at').stdout.strip()
            rb_l = [x.strip() for x in rb_m.split(chr(10)) if x.strip()]
            _check(rb_l == EXPECTED,
                   'rollback contamino: ' + str(rb_l))
            print('  rollback: OK (invalida rechazada, 4 intactas)')
        finally:
            shutil.rmtree(rbd, ignore_errors=True)

        # concurrency
        print('  concurrency...')
        cdb = 'realstate_test_conc_' + rid
        r = _psql(cn, sec, 'CREATE DATABASE "' + cdb + '"')
        _check(r.returncode == 0, 'no se pudo crear base concurrente: ' + r.stderr.strip())
        conc_url = _url('realstate', sec, '127.0.0.1', port, cdb)
        env_conc = {
            **os.environ,
            'DATABASE_URL': conc_url,
            'NODE_ENV': 'test',
            'DEMO_SEED_ENABLED': 'false',
            'MIGRATIONS_DIR': MIG_DIR,
        }

        cres = []
        ck = threading.Lock()

        def _mig(wid):
            r = _run('node', 'apps/api/dist/db/migrate.js',
                     env=env_conc, cwd=ROOT)
            with ck:
                cres.append(
                    (wid, r.returncode, (r.stdout + r.stderr).strip()[:300])
                )

        t1 = threading.Thread(target=_mig, args=(1,))
        t2 = threading.Thread(target=_mig, args=(2,))
        t1.start(); t2.start()
        t1.join(); t2.join()

        ok_workers = 0
        for wid, rc, out in cres:
            print('    worker-' + str(wid) + ': exit=' + str(rc))
            if rc != 0:
                print('      error=' + out.replace(sec, '[REDACTED]'))
            if rc == 0:
                ok_workers += 1
        _check(ok_workers >= 1, 'ningun worker concurrente tuvo exito')

        cc = _psql_host(cn, sec,
                        'SELECT count(*) FROM schema_migrations',
                        db=cdb).stdout.strip()
        _check(cc == '4', 'concurrencia: esperadas 4, hay ' + cc)

        du = _psql_host(cn, sec,
                        'SELECT id, count(*) FROM schema_migrations '
                        'GROUP BY id HAVING count(*) > 1',
                        db=cdb).stdout.strip()
        _check(du == '', 'filas duplicadas: ' + du)
        print('  concurrency: OK (4 migraciones, 0 duplicados)')

        # teardown
        print('=== test-database: teardown ===')
        cleanup()

        # verify cleanup
        r = _run('docker', 'ps', '-a', '--filter', 'name=' + cn,
                 '--format', '{{.Names}}')
        _check(r.stdout.strip() == '',
               'contenedor residual: ' + r.stdout.strip())
        r = _run('docker', 'network', 'ls', '--filter', 'name=' + net,
                 '--format', '{{.Name}}')
        _check(r.stdout.strip() == '',
               'red residual: ' + r.stdout.strip())
        r = _run('docker', 'volume', 'ls', '--filter', 'name=' + vol,
                 '--format', '{{.Name}}')
        _check(r.stdout.strip() == '',
               'volumen residual: ' + r.stdout.strip())
        print('  containers=0 networks=0 volumes=0')

        lt = []
        for pf in ['realstate-test-mig-', 'realstate-test-rb-']:
            lt.extend([f for f in os.listdir(tempfile.gettempdir())
                       if f.startswith(pf)])
        _check(len(lt) == 0,
               'archivos temporales residuales: ' + str(lt))
        print('  temporary_files=0')

        if FAILED:
            print('RESULT: FAILED')
            sys.exit(1)
        print('RESULT: OK')

    except SystemExit:
        cleanup()
        raise
    except Exception:
        cleanup()
        raise


if __name__ == '__main__':
    main()
