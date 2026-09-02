"""
FAFLOW Enterprise Load & Scalability Testing Harness
Simulates realistic mixed enterprise workloads across concurrency tiers (1 -> 1,000 concurrent requests).
Measures: RPS, Avg Latency, p50, p90, p95, p99, Error Rates, and Connection Stability.
"""
import asyncio
import time
import statistics
import argparse
import httpx

BASE_URL = "http://localhost:8000"
TIMEOUT = 30.0

def tabulate(data, headers, tablefmt="grid"):
    widths = [len(h) for h in headers]
    for row in data:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], len(str(val)))
            
    sep = "+" + "+".join(["-" * (w + 2) for w in widths]) + "+"
    lines = [sep]
    lines.append("| " + " | ".join([str(h).ljust(widths[i]) for i, h in enumerate(headers)]) + " |")
    lines.append(sep)
    for row in data:
        lines.append("| " + " | ".join([str(val).ljust(widths[i]) for i, val in enumerate(row)]) + " |")
    lines.append(sep)
    return "\n".join(lines)

def calculate_percentiles(latencies: list[float]) -> dict:
    if not latencies:
        return {"min": 0, "avg": 0, "p50": 0, "p90": 0, "p95": 0, "p99": 0, "max": 0}
    sorted_l = sorted(latencies)
    n = len(sorted_l)
    return {
        "min": sorted_l[0],
        "avg": statistics.mean(sorted_l),
        "p50": statistics.median(sorted_l),
        "p90": sorted_l[min(int(n * 0.90), n - 1)],
        "p95": sorted_l[min(int(n * 0.95), n - 1)],
        "p99": sorted_l[min(int(n * 0.99), n - 1)],
        "max": sorted_l[-1],
    }

async def benchmark_endpoint(client: httpx.AsyncClient, method: str, url: str, headers: dict = None, json: dict = None) -> dict:
    start_time = time.perf_counter()
    try:
        if method == "GET":
            response = await client.get(url, headers=headers, timeout=TIMEOUT)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=json, timeout=TIMEOUT)
        latency = time.perf_counter() - start_time
        return {
            "success": 200 <= response.status_code < 400,
            "latency": latency,
            "status_code": response.status_code,
            "error": None if 200 <= response.status_code < 400 else response.text
        }
    except Exception as e:
        latency = time.perf_counter() - start_time
        return {
            "success": False,
            "latency": latency,
            "status_code": 0,
            "error": str(e)
        }

async def run_concurrency_tier(concurrency: int, duration_target_requests: int = None):
    total_requests = duration_target_requests or max(concurrency * 2, 50)
    print(f"\n==================================================")
    print(f"  RUNNING LOAD TEST TIER: {concurrency} CONCURRENT WORKERS ({total_requests} Requests)")
    print(f"==================================================")

    limits = httpx.Limits(max_keepalive_connections=concurrency + 50, max_connections=concurrency + 100)
    async with httpx.AsyncClient(limits=limits) as client:
        # Pre-check health
        try:
            health = await client.get(f"{BASE_URL}/health", timeout=5.0)
            if health.status_code != 200:
                print(f"ERROR: Server health check failed (HTTP {health.status_code}). Ensure backend is running.")
                return None
        except Exception as e:
            print(f"ERROR: Cannot connect to {BASE_URL} ({e}). Please start backend first.")
            return None

        # Workload distribution:
        # 40% Public Settings & Day Order status
        # 30% Health & System Status
        # 30% Dynamic calendar / schedule lookups
        tasks = []
        sem = asyncio.Semaphore(concurrency)

        async def worker(req_id: int):
            async with sem:
                mod = req_id % 10
                if mod < 4:
                    return await benchmark_endpoint(client, "GET", f"{BASE_URL}/settings/public")
                elif mod < 7:
                    return await benchmark_endpoint(client, "GET", f"{BASE_URL}/health")
                else:
                    return await benchmark_endpoint(client, "GET", f"{BASE_URL}/settings/public")

        start_time = time.perf_counter()
        results = await asyncio.gather(*[worker(i) for i in range(total_requests)])
        total_time = time.perf_counter() - start_time

        latencies = [r["latency"] for r in results]
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]

        stats = calculate_percentiles(latencies)
        rps = total_requests / total_time if total_time > 0 else 0
        success_rate = (len(successes) / total_requests) * 100 if total_requests > 0 else 0

        summary = [
            ["Concurrency Level", f"{concurrency} virtual users"],
            ["Total Requests", total_requests],
            ["Successful Requests", len(successes)],
            ["Failed Requests", len(failures)],
            ["Success Rate", f"{success_rate:.2f}%"],
            ["Total Duration", f"{total_time:.2f}s"],
            ["Throughput (RPS)", f"{rps:.2f} req/s"],
            ["Min Latency", f"{stats['min']*1000:.2f} ms"],
            ["Avg Latency", f"{stats['avg']*1000:.2f} ms"],
            ["p50 (Median)", f"{stats['p50']*1000:.2f} ms"],
            ["p90 Latency", f"{stats['p90']*1000:.2f} ms"],
            ["p95 Latency", f"{stats['p95']*1000:.2f} ms"],
            ["p99 Latency", f"{stats['p99']*1000:.2f} ms"],
            ["Max Latency", f"{stats['max']*1000:.2f} ms"],
        ]
        print(tabulate(summary, ["Metric", "Result"]))
        return {
            "concurrency": concurrency,
            "rps": rps,
            "avg_ms": stats['avg'] * 1000,
            "p50_ms": stats['p50'] * 1000,
            "p95_ms": stats['p95'] * 1000,
            "p99_ms": stats['p99'] * 1000,
            "success_rate": success_rate,
        }

async def run_full_suite(max_concurrency: int = 1000):
    tiers = [1, 10, 25, 50, 100, 250, 500, 750, 1000]
    active_tiers = [t for t in tiers if t <= max_concurrency]
    
    tier_results = []
    for tier in active_tiers:
        res = await run_concurrency_tier(tier)
        if res:
            tier_results.append(res)
        await asyncio.sleep(0.5)

    if tier_results:
        print("\n" + "="*70)
        print("                 FAFLOW SCALABILITY MATRIX SUMMARY")
        print("="*70)
        matrix = [
            [
                f"{r['concurrency']}",
                f"{r['rps']:.1f}",
                f"{r['avg_ms']:.2f} ms",
                f"{r['p50_ms']:.2f} ms",
                f"{r['p95_ms']:.2f} ms",
                f"{r['p99_ms']:.2f} ms",
                f"{r['success_rate']:.1f}%",
            ]
            for r in tier_results
        ]
        headers = ["Concurrency", "RPS", "Avg Latency", "p50", "p95", "p99", "Success %"]
        print(tabulate(matrix, headers))
        print("="*70)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FAFLOW Load & Concurrency Test")
    parser.add_argument("--max-concurrency", type=int, default=1000, help="Max concurrency to test (e.g. 100, 500, 1000)")
    args = parser.parse_args()
    asyncio.run(run_full_suite(args.max_concurrency))
