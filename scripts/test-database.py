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
    '0005_add_in_study_status.sql',
    '0006_add_contact_subject.sql',
    '0007_add_coinvest_columns.sql',
    '0008_add_better_auth_schema.sql',
    '0009_add_private_access_authorization.sql',
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
        _check(mc == '9', 'esperadas 9 migraciones, hay ' + mc)

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
            _check(c == '4', 'pass ' + str(pn) + ': total=' + c)
            _check(pc == '3', 'pass ' + str(pn) + ': public=' + pc)
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
        _check(cc == '9', 'concurrencia: esperadas 9, hay ' + cc)

        du = _psql_host(cn, sec,
                        'SELECT id, count(*) FROM schema_migrations '
                        'GROUP BY id HAVING count(*) > 1',
                        db=cdb).stdout.strip()
        _check(du == '', 'filas duplicadas: ' + du)
        print('  concurrency: OK (9 migraciones, 0 duplicados)')

        # ─────────────────────────────────────────────────────────────────
        # Backup/restore auth tables
        # ─────────────────────────────────────────────────────────────────
        print('  backup/restore auth...')

        # 1. Insert test data — one INSERT per _psql call (psql -c only handles 1 statement)
        _psql(cn, sec, "INSERT INTO auth.\"user\" (id, email, \"emailVerified\", name, created_at, updated_at) VALUES ('ba-restore-active', 'active@restore.test', true, 'Active User', now(), now()), ('ba-restore-suspended', 'suspended@restore.test', true, 'Suspended User', now(), now()), ('ba-restore-revoked', 'revoked@restore.test', true, 'Revoked User', now(), now()), ('ba-restore-pending', 'pending@restore.test', false, 'Pending User', now(), now())")

        _psql(cn, sec, "INSERT INTO auth.\"session\" (id, \"userId\", token, \"expiresAt\", created_at, updated_at) VALUES ('sess-restore-1', 'ba-restore-active', 'tok_abc', now() + interval '8 hours', now(), now()), ('sess-restore-2', 'ba-restore-active', 'tok_def', now() - interval '1 hour', now(), now()), ('sess-restore-3', 'ba-restore-suspended', 'tok_ghi', now() + interval '8 hours', now(), now())")

        _psql(cn, sec, "INSERT INTO auth.\"account\" (id, \"userId\", \"providerId\", \"accountId\", created_at, updated_at) VALUES ('acct-restore-1', 'ba-restore-active', 'email', 'active@restore.test', now(), now())")

        _psql(cn, sec, "INSERT INTO auth.\"verification\" (id, identifier, value, \"expiresAt\", created_at, updated_at) VALUES ('verif-restore-1', 'active@restore.test', 'verify_token_1', now() + interval '30 minutes', now(), now()), ('verif-restore-2', 'pending@restore.test', 'verify_token_2', now() - interval '1 hour', now(), now())")

        _psql(cn, sec, "INSERT INTO auth.\"twoFactor\" (id, \"userId\", secret, enabled, created_at, updated_at) VALUES ('2fa-restore-1', 'ba-restore-active', 'BASE32SECRET1', true, now(), now()), ('2fa-restore-2', 'ba-restore-suspended', 'BASE32SECRET2', false, now(), now())")

        _psql(cn, sec, "INSERT INTO auth.\"organization\" (id, name, slug, created_at) VALUES ('org-restore-1', 'MILLENNIALS CONSTRUYEN', 'millennials-construyen', now())")

        _psql(cn, sec, "INSERT INTO auth.\"member\" (id, \"organizationId\", \"userId\", role, created_at) VALUES ('mbr-restore-1', 'org-restore-1', 'ba-restore-active', 'member', now())")

        _psql(cn, sec, "INSERT INTO auth.\"invitation\" (id, \"organizationId\", email, status, role, \"expiresAt\", created_at) VALUES ('inv-restore-pending', 'org-restore-1', 'invited@restore.test', 'pending', 'member', now() + interval '48 hours', now()), ('inv-restore-expired', 'org-restore-1', 'expired@restore.test', 'expired', 'member', now() - interval '1 hour', now()), ('inv-restore-revoked', 'org-restore-1', 'revoked@restore.test', 'revoked', 'member', now() + interval '24 hours', now())")

        # Business tables
        _psql(cn, sec, "INSERT INTO app_users (id, better_auth_user_id, email_normalized, display_name, role, status, email_verified_at, mfa_enabled_at, activated_at, created_at, updated_at) VALUES (gen_random_uuid(), 'ba-restore-active', 'active@restore.test', 'Active', 'investor', 'active', now(), now(), now(), now(), now()), (gen_random_uuid(), 'ba-restore-suspended', 'suspended@restore.test', 'Suspended', 'investor', 'suspended', now(), now(), now(), now(), now()), (gen_random_uuid(), 'ba-restore-revoked', 'revoked@restore.test', 'Revoked', 'investor', 'revoked', now(), now(), now(), now(), now()), (gen_random_uuid(), 'ba-restore-pending', 'pending@restore.test', 'Pending', 'investor', 'pending_email', NULL, NULL, NULL, now(), now())")

        # Get project IDs for access grants
        opp_ids = _psql(cn, sec, "SELECT id FROM opportunities LIMIT 2").stdout.strip().split(chr(10))
        active_uid = _psql(cn, sec, "SELECT id FROM app_users WHERE status = 'active' LIMIT 1").stdout.strip()
        if opp_ids and active_uid:
            oid = opp_ids[0].strip()
            _psql(cn, sec, f"INSERT INTO project_user_access (app_user_id, opportunity_id, status) VALUES ('{active_uid}', '{oid}', 'active')")
            if len(opp_ids) > 1:
                oid2 = opp_ids[1].strip()
                suspended_uid = _psql(cn, sec, "SELECT id FROM app_users WHERE status = 'suspended' LIMIT 1").stdout.strip()
                _psql(cn, sec, f"INSERT INTO project_user_access (app_user_id, opportunity_id, status) VALUES ('{suspended_uid}', '{oid2}', 'revoked')")

        # Insert invitation rows into access_invitations
        _psql(cn, sec, "INSERT INTO access_invitations (email_normalized, token_hash, intended_role, status, expires_at, created_at, revoked_at) VALUES ('expired_inv@restore.test', 'hash_exp_999', 'investor', 'expired', now() - interval '1 hour', now() - interval '49 hours', NULL), ('revoked_inv@restore.test', 'hash_rev_999', 'investor', 'revoked', now() + interval '48 hours', now(), now()), ('pending_inv@restore.test', 'hash_pend_999', 'investor', 'pending', now() + interval '48 hours', now(), NULL)")

        # Insert audit events
        _psql(cn, sec, "INSERT INTO auth_audit_events (action, actor_id, subject_id, result, metadata, created_at) VALUES ('user_activated', 'ba-restore-active', 'ba-restore-active', 'success', '{\"email\":\"active@restore.test\"}', now()), ('user_suspended', 'ba-restore-active', 'ba-restore-suspended', 'success', '{\"email\":\"suspended@restore.test\"}', now()), ('user_revoked', 'ba-restore-active', 'ba-restore-revoked', 'success', '{\"email\":\"revoked@restore.test\"}', now())")

        # Count before dump
        c_user_before = _psql(cn, sec, "SELECT count(*) FROM auth.\"user\"").stdout.strip()
        c_sess_before = _psql(cn, sec, "SELECT count(*) FROM auth.\"session\"").stdout.strip()
        c_inv_before = _psql(cn, sec, "SELECT count(*) FROM access_invitations").stdout.strip()
        print(f'    before dump: users={c_user_before} sessions={c_sess_before} invs={c_inv_before}')
        _check(c_user_before == '4', f'esperados 4 usuarios, hay {c_user_before}')
        _check(c_sess_before == '3', f'esperadas 3 sesiones, hay {c_sess_before}')

        # 2. Dump to file INSIDE container, then copy OUT to host
        dump_file_container = f'/tmp/realstate-auth-test-{rid}.sql'
        dump_file_host = f'/tmp/realstate-auth-test-host-{rid}.sql'
        r = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec, cn,
                 'pg_dump', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                 '--schema=auth', '--schema=public', '--no-owner', '--no-privileges',
                 '-f', dump_file_container)
        _check(r.returncode == 0, 'pg_dump fallo: ' + r.stderr.strip())

        # Copy dump from container to host
        _run('docker', 'cp', f'{cn}:{dump_file_container}', dump_file_host)
        _check(os.path.getsize(dump_file_host) > 500,
               'dump demasiado pequeno: ' + str(os.path.getsize(dump_file_host)))
        print(f'    dump: {os.path.getsize(dump_file_host)} bytes')

        # 3. Destroy PostgreSQL
        _run('docker', 'rm', '-f', cn)
        _run('docker', 'volume', 'rm', '-f', vol)

        # 4. Create new PostgreSQL
        rid2 = rid + 'r'
        cn2 = 'realstate-test-db-' + rid2
        net2 = 'realstate-test-net-' + rid2
        vol2 = 'realstate-test-vol-' + rid2
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(('127.0.0.1', 0))
            port2 = str(sock.getsockname()[1])
        sec2 = ''.join(secrets.choice(chars) for _ in range(24))

        _run('docker', 'rm', '-f', cn2)
        _run('docker', 'network', 'rm', '-f', net2)
        _run('docker', 'volume', 'rm', '-f', vol2)
        _run('docker', 'network', 'create', net2)
        _run('docker', 'volume', 'create', vol2)

        run_pg2 = _run('docker', 'run', '--rm', '-d',
                       '--name', cn2, '--network', net2,
                       '-v', vol2 + ':/var/lib/postgresql/data',
                       '-e', 'POSTGRES_USER=realstate',
                       '-e', 'POSTGRES_PASSWORD=' + sec2,
                       '-e', 'POSTGRES_DB=realstate_test',
                       '-p', '127.0.0.1:' + port2 + ':5432',
                       'postgres:16-alpine')
        _check(run_pg2.returncode == 0, 'docker run #2 fallo')

        ok2 = False
        for _ in range(60):
            r = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                     'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test', '-c', 'SELECT 1')
            if r.returncode == 0:
                ok2 = True
                break
            time.sleep(1)
        _check(ok2, 'PostgreSQL #2 no arranco en 60 s')

        # Copy dump into new container
        _run('docker', 'cp', dump_file_host, f'{cn2}:{dump_file_host}')

        # 5. Restore
        r = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                 'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                 '-f', dump_file_host)
        _check(r.returncode == 0, 'pg_restore fallo: ' + r.stderr.strip())

        # 6. Validate restored state
        c_user_after = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                            'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                            '-t', '-A', '-c', "SELECT count(*) FROM auth.\"user\"").stdout.strip()
        _check(c_user_after == c_user_before,
               f'user count mismatch: before={c_user_before} after={c_user_after}')

        c_sess_after = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                            'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                            '-t', '-A', '-c', "SELECT count(*) FROM auth.\"session\"").stdout.strip()
        _check(c_sess_after == c_sess_before,
               f'session count mismatch: before={c_sess_before} after={c_sess_after}')

        # Check revoked stays revoked
        revoked_status = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                              'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                              '-t', '-A', '-c',
                              "SELECT status FROM app_users WHERE email_normalized = 'revoked@restore.test'").stdout.strip()
        _check(revoked_status == 'revoked',
               f'revoked user should stay revoked, got: {revoked_status}')

        # Check suspended stays suspended
        suspended_status = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                                'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                                '-t', '-A', '-c',
                                "SELECT status FROM app_users WHERE email_normalized = 'suspended@restore.test'").stdout.strip()
        _check(suspended_status == 'suspended',
               f'suspended user should stay suspended, got: {suspended_status}')

        # Check expired invitation stays expired
        expired_status = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                              'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                              '-t', '-A', '-c',
                              "SELECT status FROM access_invitations WHERE email_normalized = 'expired_inv@restore.test'").stdout.strip()
        _check(expired_status == 'expired',
               f'expired invitation should stay expired, got: {expired_status}')

        # Check revoked invitation stays revoked
        revoked_inv_status = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                                  'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                                  '-t', '-A', '-c',
                                  "SELECT status FROM access_invitations WHERE email_normalized = 'revoked_inv@restore.test'").stdout.strip()
        _check(revoked_inv_status == 'revoked',
               f'revoked invitation should stay revoked, got: {revoked_inv_status}')

        # Check organization not duplicated
        org_count = _run('docker', 'exec', '-e', 'PGPASSWORD=' + sec2, cn2,
                         'psql', '-U', 'realstate', '-h', '127.0.0.1', '-d', 'realstate_test',
                         '-t', '-A', '-c',
                         "SELECT count(*) FROM auth.\"organization\" WHERE slug = 'millennials-construyen'").stdout.strip()
        _check(org_count == '1',
               f'organization should not duplicate, got: {org_count}')

        # Cleanup second PostgreSQL
        _run('docker', 'rm', '-f', cn2)
        _run('docker', 'network', 'rm', '-f', net2)
        _run('docker', 'volume', 'rm', '-f', vol2)
        os.unlink(dump_file_host)

        print('  backup/restore auth: OK (restored, states preserved, no dupes)')

        # ─────────────────────────────────────────────────────────────────
        # Teardown
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
