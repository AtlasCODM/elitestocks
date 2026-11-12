#!/usr/bin/env python3
"""Local cluster only: concurrent psql sessions, no external DB connections."""
import concurrent.futures
import json
import os
import subprocess

if not os.environ.get("PGHOST", "").startswith("/tmp/elitestocks-engine-test."):
    raise SystemExit("Refusing database tests outside the isolated local test cluster")

def sql(query, check=True):
    result = subprocess.run(["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query], capture_output=True, text=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result

def value(query):
    return sql(query).stdout.strip()

def parallel(query, count=8):
    with concurrent.futures.ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(lambda _: sql(query, check=False), range(count)))

def passed(message):
    print("PASS:", message, flush=True)

user = "00000000-0000-0000-0000-000000000004"
admin = "00000000-0000-0000-0000-000000000001"
sql(f"INSERT INTO auth.users(id,email) VALUES ('{user}','concurrent@test.invalid'); UPDATE wallets SET balance=1000 WHERE user_id='{user}' AND asset='USDT';")
results = parallel(f"SELECT engine_create_investment('{user}','Starter 3D',250);")
successes = [json.loads(result.stdout) for result in results if result.returncode == 0]
assert len(successes) == 4, f"Expected 4 successful debits, got {len(successes)}"
assert value(f"SELECT balance FROM wallets WHERE user_id='{user}' AND asset='USDT'") == "0.0000000000"
assert value(f"SELECT count(*) FROM transactions WHERE user_id='{user}' AND type='investment'") == "4"
passed("concurrent creation cannot overspend or lose principal ledger entries")
position = successes[0]["id"]
parallel(f"SELECT engine_cancel_position('{user}','{position}','investment');")
assert value(f"SELECT balance FROM wallets WHERE user_id='{user}' AND asset='USDT'") == "250.0000000000"
assert value(f"SELECT count(*) FROM transactions WHERE reference_id='{position}' AND type='return'") == "1"
passed("concurrent cancellation credits principal once")

profit_position = successes[1]["id"]
verification = parallel(f"SELECT engine_record_performance('{admin}','investment','{profit_position}',25,'evidence:concurrent-trades','contract:concurrent-terms');")
assert sum(result.returncode == 0 for result in verification) == 1
passed("concurrent duplicate performance verification rejected")
sql(f"UPDATE investments SET created_at=clock_timestamp()-interval '2 days', matures_at=clock_timestamp()-interval '1 second' WHERE user_id='{user}' AND status='active';")
results = parallel("SELECT engine_process_jobs();")
assert all(result.returncode == 0 for result in results), [result.stderr for result in results]
assert value(f"SELECT balance FROM wallets WHERE user_id='{user}' AND asset='USDT'") == "1025.0000000000"
passed("concurrent maturity processors release three principals and verified profit exactly once")

config = json.loads(value("SELECT config FROM investment_engine_config WHERE id=true"))
version = config["version"]
config["minDeposit"] = 10
payload = json.dumps(config).replace("'", "''")
results = parallel(f"SELECT engine_update_configuration('{admin}',{version},'{payload}'::jsonb);")
assert sum(result.returncode == 0 for result in results) == 1
assert int(value("SELECT version FROM investment_engine_config WHERE id=true")) == version + 1
passed("concurrent administrator saves prevent lost updates using expected version")

# Existing settings screen and new engine screen may save concurrently. Both must remain synchronized.
for _ in range(5):
    config = json.loads(value("SELECT config FROM investment_engine_config WHERE id=true"))
    version = config["version"]
    config["minWithdrawal"] = 30
    config["maxWithdrawal"] = 700
    payload = json.dumps(config).replace("'", "''")
    queries = [
      f"SELECT engine_update_configuration('{admin}',{version},'{payload}'::jsonb);",
      f"SELECT admin_update_settings('test-btc-address','test-eth-address','test-sol-address','test-usdt-address',31,701,'{admin}');",
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda q: sql(q, check=False), queries))
    assert not any("deadlock" in result.stderr.lower() for result in results), [result.stderr for result in results]
    assert value("SELECT (config->>'minWithdrawal')::numeric=s.min_withdrawal AND (config->>'maxWithdrawal')::numeric=s.max_withdrawal FROM investment_engine_config CROSS JOIN platform_settings s") == "t"
passed("legacy and engine configuration writes remain synchronized without deadlock")
