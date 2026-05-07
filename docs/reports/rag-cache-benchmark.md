# RAG Cache Benchmark

Generated at: 2026-05-06T04:36:31.218Z

## Summary

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 2012.6ms
- Average warm total: 24.6ms
- Average total reduction: 1988ms (98.8%)
- Average speedup: 86.8x

## Cases

| Case | Cold total ms | Warm total ms | Retrieval cache hit | Reduction | Speedup |
| --- | ---: | ---: | --- | ---: | ---: |
| evaluation-day-night-care-disliked-foods | 3841 | 26 | yes | 99.3% | 147.7x |
| evaluation-notice-period | 2307 | 22 | yes | 99.0% | 104.9x |
| evaluation-rights-required-colloquial | 1849 | 30 | yes | 98.4% | 61.6x |
| evaluation-change-comparison | 960 | 11 | yes | 98.9% | 87.3x |
| integrated-eligibility-law | 1106 | 34 | yes | 96.9% | 32.5x |

## Decision Guidance

The retrieval cache is effective for repeated slow queries. Keep cache instrumentation and prioritize non-repeat latency paths next.
