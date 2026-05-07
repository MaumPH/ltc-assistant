# RAG Benchmark Diagnostics

Generated at: 2026-05-06T14:46:23.850Z
Benchmark generated at: 2026-05-06T14:46:10.399Z

## Summary

- Total benchmark cases: 27
- Analyzed cases: 1
- Actionable cases: 0
- Accepted abstain cases: 1
- top3-rerank-priority-miss: 0
- evidence-visible-fusion-miss: 0
- candidate-recall-miss: 0
- accepted-abstain-negative-case: 1

## Search memo diagnostics

- Cases with memo trace: 27
- Cases with memo hits: 0
- Total hits/misses: 0/53
- Hit rate: 0.0%

- evaluation-change-comparison: hits 0, misses 4, size 4
- evaluation-day-night-care-disliked-foods: hits 0, misses 4, size 4
- evaluation-employee-rights-education: hits 0, misses 4, size 4
- evaluation-employee-rights-primary-evidence: hits 0, misses 4, size 4
- evaluation-daily-training: hits 0, misses 3, size 3
- evaluation-function-training: hits 0, misses 3, size 3
- evaluation-notice-period: hits 0, misses 3, size 3
- evaluation-qa-casebook: hits 0, misses 3, size 3

## Lexical score cache diagnostics

- Cases with cache trace: 27
- Cases with hits: 11
- Total hits/misses: 28872/58670
- Hit rate: 33.0%

- evaluation-employee-rights-education: hits 2982, misses 3425, size 3425
- evaluation-employee-rights-primary-evidence: hits 2982, misses 3425, size 3425
- evaluation-function-training: hits 2979, misses 3052, size 3052
- evaluation-daily-training: hits 2952, misses 2952, size 2952
- evaluation-qa-casebook: hits 2804, misses 2915, size 2915
- evaluation-change-comparison: hits 2747, misses 3127, size 3127
- evaluation-day-night-care-disliked-foods: hits 2658, misses 3768, size 3768
- evaluation-notice-period: hits 2384, misses 2764, size 2764

## Repeated sub-search latency targets

- evaluation-routing: cases 9, avg 44ms, p95 67ms, max 67ms, slow cases evaluation-notice-period, evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- evaluation-base: cases 9, avg 39.6ms, p95 57ms, max 57ms, slow cases evaluation-notice-period, evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-function-training, evaluation-employee-rights-education
- integrated-initial: cases 18, avg 31ms, p95 56ms, max 56ms, slow cases integrated-eligibility-law, integrated-workforce-standard, integrated-benefit-cost-notice, integrated-long-service-faq, integrated-integrated-homecare-manual
- integrated-reranked: cases 2, avg 23ms, p95 28ms, max 28ms, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized
- evaluation-direct-support: cases 7, avg 17.6ms, p95 27ms, max 27ms, slow cases evaluation-day-night-care-disliked-foods, evaluation-function-training, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence, evaluation-qa-casebook
- evaluation-promoted-primary: cases 2, avg 13ms, p95 16ms, max 16ms, slow cases evaluation-notice-period, evaluation-change-comparison
- evaluation-primary-manual: cases 4, avg 11.8ms, p95 18ms, max 18ms, slow cases evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- integrated-promoted-primary: cases 2, avg 11ms, p95 13ms, max 13ms, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized

## Search store latency breakdown

- evaluation-routing: cases 9, total avg 43.4ms, p95 67ms, db lexical avg 0ms, vector avg 0ms, corpus avg 43.4ms, db/vector candidates 0/0, slow cases evaluation-notice-period, evaluation-rights-required-colloquial, evaluation-day-night-care-disliked-foods, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- evaluation-base: cases 9, total avg 38.6ms, p95 56ms, db lexical avg 0ms, vector avg 0ms, corpus avg 38.6ms, db/vector candidates 0/0, slow cases evaluation-notice-period, evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- integrated-initial: cases 18, total avg 30.6ms, p95 55ms, db lexical avg 0ms, vector avg 0ms, corpus avg 30.6ms, db/vector candidates 0/0, slow cases integrated-eligibility-law, integrated-workforce-standard, integrated-benefit-cost-notice, integrated-long-service-faq, integrated-evaluation-doc-not-penalized
- integrated-reranked: cases 2, total avg 22ms, p95 27ms, db lexical avg 0ms, vector avg 0ms, corpus avg 22ms, db/vector candidates 0/0, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized
- evaluation-direct-support: cases 7, total avg 16.7ms, p95 23ms, db lexical avg 0ms, vector avg 0ms, corpus avg 16.7ms, db/vector candidates 0/0, slow cases evaluation-day-night-care-disliked-foods, evaluation-function-training, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence, evaluation-qa-casebook
- evaluation-promoted-primary: cases 2, total avg 12.5ms, p95 16ms, db lexical avg 0ms, vector avg 0ms, corpus avg 12.5ms, db/vector candidates 0/0, slow cases evaluation-notice-period, evaluation-change-comparison
- integrated-promoted-primary: cases 2, total avg 10.5ms, p95 12ms, db lexical avg 0ms, vector avg 0ms, corpus avg 10.5ms, db/vector candidates 0/0, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized
- evaluation-primary-manual: cases 4, total avg 10.3ms, p95 14ms, db lexical avg 0ms, vector avg 0ms, corpus avg 10.3ms, db/vector candidates 0/0, slow cases evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence

## Search corpus phase timing

- evaluation-routing: cases 9, total avg 43.4ms, p95 67ms, lexical pool avg 6.2ms, exact avg 18ms, lexical avg 14.3ms, vector avg 0ms, fusion avg 3ms, evidence avg 0.8ms, fusion detail rrf avg 0.3ms, rerank avg 1ms, entity avg 1.6ms, merge avg 0.1ms, diversify avg 0ms, slow cases evaluation-notice-period, evaluation-rights-required-colloquial, evaluation-day-night-care-disliked-foods, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- evaluation-base: cases 9, total avg 38.4ms, p95 56ms, lexical pool avg 6.2ms, exact avg 20.7ms, lexical avg 8.4ms, vector avg 0ms, fusion avg 2.4ms, evidence avg 0.2ms, fusion detail rrf avg 0ms, rerank avg 1.1ms, entity avg 1.3ms, merge avg 0ms, diversify avg 0ms, slow cases evaluation-notice-period, evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence
- integrated-initial: cases 18, total avg 30.6ms, p95 55ms, lexical pool avg 1.6ms, exact avg 12.6ms, lexical avg 12.4ms, vector avg 0.1ms, fusion avg 2.1ms, evidence avg 0.8ms, fusion detail rrf avg 0.1ms, rerank avg 1.4ms, entity avg 0.4ms, merge avg 0.1ms, diversify avg 0.1ms, slow cases integrated-eligibility-law, integrated-workforce-standard, integrated-benefit-cost-notice, integrated-long-service-faq, integrated-evaluation-doc-not-penalized
- integrated-reranked: cases 2, total avg 22ms, p95 27ms, lexical pool avg 1ms, exact avg 13.5ms, lexical avg 4.5ms, vector avg 0ms, fusion avg 1.5ms, evidence avg 0.5ms, fusion detail rrf avg 0ms, rerank avg 1.5ms, entity avg 0ms, merge avg 0ms, diversify avg 0ms, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized
- evaluation-direct-support: cases 7, total avg 16.7ms, p95 23ms, lexical pool avg 5.1ms, exact avg 5.3ms, lexical avg 4.1ms, vector avg 0ms, fusion avg 1ms, evidence avg 0.1ms, fusion detail rrf avg 0ms, rerank avg 0.9ms, entity avg 0ms, merge avg 0ms, diversify avg 0.1ms, slow cases evaluation-day-night-care-disliked-foods, evaluation-function-training, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence, evaluation-qa-casebook
- evaluation-promoted-primary: cases 2, total avg 12.5ms, p95 16ms, lexical pool avg 5ms, exact avg 1.5ms, lexical avg 2ms, vector avg 0ms, fusion avg 3ms, evidence avg 0.5ms, fusion detail rrf avg 0ms, rerank avg 1ms, entity avg 2ms, merge avg 0ms, diversify avg 0ms, slow cases evaluation-notice-period, evaluation-change-comparison
- integrated-promoted-primary: cases 2, total avg 10.5ms, p95 12ms, lexical pool avg 5.5ms, exact avg 1.5ms, lexical avg 2ms, vector avg 0ms, fusion avg 1ms, evidence avg 0.5ms, fusion detail rrf avg 0.5ms, rerank avg 0.5ms, entity avg 0ms, merge avg 0ms, diversify avg 0ms, slow cases integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized
- evaluation-primary-manual: cases 4, total avg 10.3ms, p95 14ms, lexical pool avg 4.8ms, exact avg 1.5ms, lexical avg 1ms, vector avg 0ms, fusion avg 1.3ms, evidence avg 1ms, fusion detail rrf avg 0ms, rerank avg 1.3ms, entity avg 0ms, merge avg 0ms, diversify avg 0ms, slow cases evaluation-day-night-care-disliked-foods, evaluation-rights-required-colloquial, evaluation-employee-rights-education, evaluation-employee-rights-primary-evidence

## Lexical pool reuse diagnostics

- Cases with diagnostics: 9
- Average coverage: 99.1%
- Minimum coverage: 95.8%
- Full/partial coverage cases: 7/2
- Guard results: accepted=9

- evaluation-change-comparison: target evaluation-base, coverage 95.8%, overlap 23/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-day-night-care-disliked-foods: target evaluation-base, coverage 95.8%, overlap 23/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-daily-training: target evaluation-base, coverage 100.0%, overlap 24/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-employee-rights-education: target evaluation-base, coverage 100.0%, overlap 24/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-employee-rights-primary-evidence: target evaluation-base, coverage 100.0%, overlap 24/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-function-training: target evaluation-base, coverage 100.0%, overlap 24/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24
- evaluation-notice-period: target evaluation-base, coverage 100.0%, overlap 24/24, previous 24, guard accepted, stages evaluation-routing:24
- evaluation-qa-casebook: target evaluation-base, coverage 100.0%, overlap 24/24, previous 48, guard accepted, stages evaluation-routing:24|evaluation-direct-support:24

## Neighbor window expansion diagnostics

- Cases with diagnostics: 27
- Total windows: 531
- Selected evidence windows: 388
- Expansion candidate windows: 143
- Average expansion candidates: 5.3
- Current/previous/next windows: 388/58/85

- integrated-evaluation-doc-not-penalized: windows 32, candidates 12, parents 16, current/previous/next 20/4/8
- integrated-caregiver-continuing-education: windows 23, candidates 11, parents 8, current/previous/next 12/5/6
- integrated-workforce-standard: windows 22, candidates 9, parents 12, current/previous/next 13/4/5
- integrated-payroll-ratio-qa: windows 19, candidates 9, parents 8, current/previous/next 10/4/5
- integrated-integrated-homecare-manual: windows 25, candidates 8, parents 15, current/previous/next 17/3/5
- integrated-eligibility-law: windows 24, candidates 8, parents 14, current/previous/next 16/3/5
- integrated-complaint-casebook: windows 18, candidates 8, parents 7, current/previous/next 10/4/4
- integrated-law-alias-article-variant: windows 25, candidates 7, parents 18, current/previous/next 18/3/4

## Small-to-big context inclusion diagnostics

- Cases with diagnostics: 27
- Included/candidate windows: 60/63
- Skipped windows: 3
- Skip reasons: max chunks 1, max chars 2
- Included chars: 32571
- Inclusion rate: 95.2%

- integrated-law-alias-article-variant: included 5/7, skipped 2 (chunks 0, chars 2), chars 2514, max chars 2520
- integrated-workforce-standard: included 6/7, skipped 1 (chunks 1, chars 0), chars 3016, max chars 3200
- integrated-payroll-ratio-qa: included 5/5, skipped 0 (chunks 0, chars 0), chars 2515, max chars 2520
- integrated-eligibility-law: included 4/4, skipped 0 (chunks 0, chars 0), chars 2012, max chars 2520
- integrated-evaluation-doc-not-penalized: included 4/4, skipped 0 (chunks 0, chars 0), chars 2012, max chars 3200
- integrated-integrated-homecare-manual: included 4/4, skipped 0 (chunks 0, chars 0), chars 2410, max chars 3200
- evaluation-change-comparison: included 3/3, skipped 0 (chunks 0, chars 0), chars 1508, max chars 3200
- integrated-caregiver-continuing-education: included 3/3, skipped 0 (chunks 0, chars 0), chars 1508, max chars 2520

## Integrated reranked path diagnostics

- Cases with reranked path: 2
- Sub-search latency: avg 23ms, p95 28ms, max 28ms
- Corpus phase total avg: 22ms
- Exact input/output avg: 1600/12
- Lexical input/output avg: 2000/24
- Fusion rerank/entity/diversify avg: 1.5/0/0ms
- Slow cases: integrated-benefit-cost-notice, integrated-evaluation-doc-not-penalized

- integrated-benefit-cost-notice: sub-search 28ms, phase total 27ms, exact input/output 1600/10, lexical input/output 2000/24, rerank/entity/diversify 1/0/0ms
- integrated-evaluation-doc-not-penalized: sub-search 18ms, phase total 17ms, exact input/output 1600/14, lexical input/output 2000/24, rerank/entity/diversify 2/0/0ms

## Semantic validation latency diagnostics

- Cases with timing: 27
- Latency: avg 6.9ms, p95 11ms, max 13ms
- Average retrieval share: 9.3%
- Slow cases: integrated-eligibility-law, integrated-claim-work-guide, integrated-long-service-colloquial, integrated-no-grounded-answer, integrated-long-service-faq

- integrated-eligibility-law: semantic validation 13ms, retrieval 105ms, share 12.4%, evidence output 16
- integrated-claim-work-guide: semantic validation 11ms, retrieval 59ms, share 18.6%, evidence output 18
- integrated-long-service-colloquial: semantic validation 11ms, retrieval 64ms, share 17.2%, evidence output 16
- integrated-no-grounded-answer: semantic validation 11ms, retrieval 64ms, share 17.2%, evidence output 0
- integrated-long-service-faq: semantic validation 11ms, retrieval 68ms, share 16.2%, evidence output 16
- integrated-workforce-standard: semantic validation 11ms, retrieval 99ms, share 11.1%, evidence output 13
- integrated-caregiver-continuing-education: semantic validation 9ms, retrieval 62ms, share 14.5%, evidence output 0
- integrated-law-alias-article-variant: semantic validation 9ms, retrieval 66ms, share 13.6%, evidence output 18

## Evaluation authority trace diagnostics

- Cases with expected doc: 9
- Lexical/exact/fusion top matches: 3/5/6
- Visible Top-5 matches: 9
- Drift cases: 3
- Missed Top-5 cases: 0

- evaluation-employee-rights-education: expected stage lexical-top, top3/top5 yes/yes, drift yes, lexical "01-07-직원인권보호", exact "01-07-직원인권보호", fusion "2026년 주야간보호 평가매뉴얼(26년꺼만)", visible "2026년 주야간보호 평가매뉴얼(26년꺼만)"
- evaluation-function-training: expected stage lexical-top, top3/top5 yes/yes, drift yes, lexical "03-08-기능회복훈련", exact "일상생활기능훈련_매뉴얼 (1)", fusion "일상생활기능훈련_매뉴얼 (1)", visible "일상생활기능훈련_매뉴얼 (1)"
- evaluation-qa-casebook: expected stage exact-top, top3/top5 yes/yes, drift yes, lexical "(붙임)1_2023년_재가급여_평가매뉴얼_다빈도_Q&A_사례집(1차)_게시용", exact "2.2026년_재가급여_평가매뉴얼_다빈도Q&A_사례집(1차)", fusion "2020년_재가급여_평가매뉴얼_다빈도_Q&A_사례집", visible "2020년_재가급여_평가매뉴얼_다빈도_Q&A_사례집"
- evaluation-change-comparison: expected stage exact-top, top3/top5 yes/yes, drift no, lexical "2019년_재가급여_평가매뉴얼_다빈도_Q&A_사례집", exact "2026년_장기요양기관_재가급여_평가매뉴얼_다빈도Q&A_개정전후_비교표", fusion "2026년_장기요양기관_재가급여_평가매뉴얼_다빈도Q&A_개정전후_비교표", visible "2026년_장기요양기관_재가급여_평가매뉴얼_다빈도Q&A_개정전후_비교표"
- evaluation-daily-training: expected stage lexical-top, top3/top5 yes/yes, drift no, lexical "일상생활기능훈련_매뉴얼 (1)", exact "일상생활기능훈련_매뉴얼 (1)", fusion "일상생활기능훈련_매뉴얼 (1)", visible "일상생활기능훈련_매뉴얼 (1)"
- evaluation-day-night-care-disliked-foods: expected stage fusion-top, top3/top5 yes/yes, drift no, lexical "04-05-식사간식", exact "장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_세부사항_전문", fusion "2026년 주야간보호 평가매뉴얼(26년꺼만)", visible "2026년 주야간보호 평가매뉴얼(26년꺼만)"
- evaluation-employee-rights-primary-evidence: expected stage fusion-top, top3/top5 yes/yes, drift no, lexical "01-07-직원인권보호", exact "01-07-직원인권보호", fusion "2026년 주야간보호 평가매뉴얼(26년꺼만)", visible "2026년 주야간보호 평가매뉴얼(26년꺼만)"
- evaluation-notice-period: expected stage exact-top, top3/top5 yes/yes, drift no, lexical "02-04-정보제공", exact "2026년 주야간보호 평가매뉴얼(26년꺼만)", fusion "2026년 주야간보호 평가매뉴얼(26년꺼만)", visible "2026년 주야간보호 평가매뉴얼(26년꺼만)"

## Cases

### integrated-no-grounded-answer

- Issue: accepted-abstain-negative-case
- Expected doc: 노인장기요양보험법
- Confidence: low
- Top-3 hit: no
- Top-5 hit: no
- Expected doc in evidence: yes
- Recommended action: Keep as negative-case coverage and separate accepted abstain from document-recall failure metrics.
- Top-5 docs:
  - 장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)
  - 장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_전문
  - 장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_전문
  - 장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)
  - 장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)
- Evidence docs:
  - 장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416)
  - 장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_전문
  - 노인장기요양보험법 시행규칙(보건복지부령)(제01138호)(20251212)
  - 장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_고시_일부_개정문
  - 의료급여법 시행규칙(보건복지부령)(제01159호)(20260304)
  - 장기요양급여_제공기준_및_급여비용_산정방법_등에_관한_세부사항_전문
  - 장기요양기관_부당청구_사례집(2023년)_193p최종수정
  - /knowledge/장기요양급여비용 청구 및 심사·지급업무 처리기준(고시)(제2025-66호)(20250416).md

