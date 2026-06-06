# AWS Cost Optimization — Marzi account (ap-south-1)

**Account:** 904233100956 (profile `marzi`)
**Region:** ap-south-1 (Mumbai)
**Cleanup date:** 2026-05-28
**Owner:** MD

---

## 1. Cost baseline (before cleanup)

Pulled from Cost Explorer:

| Month           | Total                                  |
| --------------- | -------------------------------------- |
| April 2026      | $251.91                                |
| May 2026 (1–28) | $261.80 (run rate ~$291/mo full month) |

Top services driving cost: RDS ($55–80/mo), EC2 compute ($34–47), VPC/NAT Gateway ($33–37), ELB ($8–30), EBS/EC2-Other ($20–27), S3 ($13–29).

---

## 2. What we removed — and the verified savings

All prices use current ap-south-1 on-demand rates.

| #   | Resource removed                                                               | Pricing basis                 | Monthly cost eliminated |
| --- | ------------------------------------------------------------------------------ | ----------------------------- | ----------------------- |
| 1   | 8 stopped EC2 instances' EBS volumes (16+16+16+25+50+8+20+30 = **181 GB gp3**) | $0.0912/GB-mo                 | **$16.51**              |
| 2   | Orphan EBS volume `vol-00bbb650d19e92d44` (30 GB gp3)                          | $0.0912/GB-mo                 | **$2.74**               |
| 3   | 8 Elastic IPs released (6 from terminated instances + 2 fully unattached)      | $0.005/hr × 730hr × 8         | **$29.20**              |
| 4   | Broken RDS `marzi-af-meta-data` (db.t4g.micro + 20 GB gp3)                     | $0.018/hr × 730 + $0.115 × 20 | **$15.44**              |
| 5   | Stopped Lightsail `Marzi_Prod` (micro_3_1 bundle)                              | flat bundle                   | **$5.00**               |
|     |                                                                                | **GROSS**                     | **$68.89 / mo**         |

### Safety net (temporary cost added)

10 snapshots created as rollback insurance (tag `Purpose=cost-cleanup-2026-05-28`), ~211 GB initial:

- Estimated cost while retained: **~$7/mo** (snapshots only bill unique blocks, ap-south-1 $0.05/GB-mo)
- **Scheduled deletion: on or after 2026-06-28** (see Action 0 below)

### Net savings

|                                           | Monthly  | Annualized     |
| ----------------------------------------- | -------- | -------------- |
| First month (with snapshot insurance)     | **~$62** | —              |
| Month 2 onwards (after snapshot deletion) | **~$69** | **~$827/year** |

---

## 3. Action items / backlog

### Action 0 — DUE 2026-06-28: Delete safety-net snapshots

Once you've verified nothing is missed from the terminated instances:

```bash
aws ec2 describe-snapshots --profile marzi --region ap-south-1 \
  --filters "Name=tag:Purpose,Values=cost-cleanup-2026-05-28" \
  --query 'Snapshots[].SnapshotId' --output text \
  | xargs -n1 aws ec2 delete-snapshot --profile marzi --region ap-south-1 --snapshot-id
```

Snapshots retained (instance name → snapshot id):

| Source                         | Snapshot ID            | Size  |
| ------------------------------ | ---------------------- | ----- |
| Marzi Chatbase Staging         | snap-0d92a107996bfaacc | 16 GB |
| marzi-backend-prod             | snap-0c716a396352745c6 | 16 GB |
| marzi_backend                  | snap-0cfc842e59c4082a8 | 16 GB |
| marzi_tph_dev                  | snap-095310c94c8d00aae | 25 GB |
| primus-mongodb                 | snap-0628295af4acb5102 | 50 GB |
| marzi_production               | snap-02502cfe70dbed662 | 8 GB  |
| Marzi-Community                | snap-04079ec194d0762dd | 20 GB |
| marzi-data-platform            | snap-0dce922ba404a560c | 30 GB |
| senior-community-blog-api-prod | snap-0ae81d19a74f0e032 | 2 GB  |
| orphan volume                  | snap-0fef27a51b62ff124 | 30 GB |

---

### Action 1 — Decide on `marzi-posts-alb-dev` (potential ~$16/mo)

**Status:** held — user said "leave it" on 2026-05-28.

| Why it looks safe to delete                                             | Why we held              |
| ----------------------------------------------------------------------- | ------------------------ |
| 4 requests in 14 days                                                   | User may resume dev work |
| Both target groups empty (zero registered instances)                    | —                        |
| No Route53 alias points to it                                           | —                        |
| Target instance (`senior-community-blog-api-prod`) is stopped/protected | —                        |

**Recommendation:** revisit when senior-community dev work pauses for >30 days, then delete:

```bash
arn=$(aws elbv2 describe-load-balancers --profile marzi --region ap-south-1 \
  --names marzi-posts-alb-dev --query 'LoadBalancers[0].LoadBalancerArn' --output text)
aws elbv2 delete-load-balancer --profile marzi --region ap-south-1 --load-balancer-arn $arn
# Then delete the empty target groups:
# marzi-blog-tg-dev (arn:aws:...targetgroup/marzi-blog-tg-dev/f6a335dabaf35ca0)
# marzi-posts-tg-dev (arn:aws:...targetgroup/marzi-posts-tg-dev/22036fdf16754eb6)
```

---

### Action 2 — Migrate `senior-community-posts-api` off the prod ALB? (potential ~$16/mo)

**Status:** open question — not recommended in current state.

`marzi-posts-alb-prod` carries low traffic (~219 req/14d) but its target `i-014e35169fe14997a` (senior-community-posts-api, t3.small) is **running and healthy**. Removing the ALB requires refactoring callers (likely Lambdas + API Gateway in the VPC) to hit the EC2 directly — loses health-checking and failover.

**Worth doing only if:** posts service is being phased out, OR you're consolidating it behind API Gateway directly.

---

### Action 3 — NAT Gateway `marzi-prod-nat`: KEEP (heavy use)

**Verdict:** do not touch. $32.85/mo is unavoidable while these Lambdas exist.

7-day Lambda invocations through this NAT:

- MarziOnboardingAPI: 23,860
- SeniorCommunityUserAPI: 9,784
- SeniorCommunityGroupsAPI-dev: 1,026
- sc-events-extra-routes: 609
- MarziOnboardingAPI-dev: 314
- SeniorCommunityModerationAPI: 151
- sc-events-update: 89

**Future optimization (not now):** add VPC interface/gateway endpoints for S3, DynamoDB, Secrets Manager, KMS if these Lambdas grow their outbound traffic — reduces NAT data charges (currently negligible at ~1 MB/day).

---

### Action 4 — Recover the protected `senior-community-blog-api-prod` (potential ~$4/mo)

The IAM policy `ProtectCriticalProdInfra` blocks termination of:

- EC2 `i-09a15fa3a8523e09d` (stopped) — 2 GB EBS = $0.18/mo
- EIP `43.204.105.78` (unattached) — $3.65/mo

**To clean up:** either remove the resource from the policy's deny list, or use an IAM principal not bound by the policy. **~$4/mo savings, low priority.**

---

### Action 5 — Audit S3 storage classes (potential unknown)

Biggest buckets:

- `marzi-community-storage` — 1.1 GB
- `senior-community-blog-media-904233100956` — 369 MB
- `marzi-production-bucket-2a9486138952g` — 67 MB

All on Standard storage. Buckets are tiny so savings are minimal today, but **add lifecycle policies** before they grow:

- Transition objects >30d to Standard-IA
- Transition objects >90d to Glacier IR

Set up once; benefits compound over time.

---

### Action 6 — Reserved Instances / Savings Plans (potential 30–40% on EC2+RDS)

Current monthly steady-state after this cleanup:

- RDS: 3× db.t4g.micro + 1× db.t3.micro = ~$40/mo
- EC2: 3× small/medium running 24/7 = ~$40/mo

**Compute Savings Plan** (1-year, no upfront) would cut ~30% off both. Estimated savings: **~$24/mo (~$288/year)**.

Only commit once these workloads are stable for 60+ days — don't lock in if you're still migrating to SocietyOS.

---

## 4. Guardrails to remember

**IAM policy `ProtectCriticalProdInfra`** (denies destructive ops on flagged resources). When a bulk `terminate-instances` / `release-address` call hits a protected resource, **AWS rejects the entire call** — always retry per-resource to identify which is protected.

Memory record: `reference_aws_protection_policy.md`.

---

## 5. Running total of decisions

| Date       | Decision                                                                                                  | Effect               |
| ---------- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| 2026-05-28 | Terminated 8 stopped EC2s + released 8 EIPs + deleted orphan EBS + deleted broken RDS + deleted Lightsail | **−$68.89/mo gross** |
| 2026-05-28 | Held `marzi-posts-alb-dev` deletion per user                                                              | $0 (revisit)         |
| 2026-05-28 | Confirmed keep `marzi-posts-alb-prod` (in use)                                                            | n/a                  |
| 2026-05-28 | Confirmed keep NAT Gateway (Lambdas depend on it)                                                         | n/a                  |
