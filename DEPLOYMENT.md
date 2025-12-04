# Production Deployment Checklist

## Pre-Deployment

### Supabase Setup

- [ ] Create Supabase projects in 3 regions:
  - [ ] US East (primary)
  - [ ] EU West
  - [ ] Asia Southeast
- [ ] Run migrations on all regional databases
- [ ] Enable RLS on all tables in all regions
- [ ] Configure database replication/sync strategy
- [ ] Upgrade to Supabase Pro ($25/month per region = $75/month)

### Environment Configuration

- [ ] Set all environment variables in Vercel
- [ ] Generate production CSRF_SECRET and SESSION_SECRET
- [ ] Configure Resend API key (upgrade to Pro $20/month)
- [ ] Set up Upstash Redis for rate limiting ($10/month)

### Email Configuration

- [ ] Verify domain in Resend
- [ ] Set up SPF, DKIM, DMARC records
- [ ] Test email deliverability
- [ ] Configure email templates

### Security

- [ ] Review all security headers
- [ ] Enable HTTPS enforcement
- [ ] Configure CORS policies
- [ ] Set up StatusPage.io ($29/month)
- [ ] Configure PagerDuty ($21/month)

## Deployment Steps

1. **Build and Test**
   ```bash
   npm run build
   npm run test
   npm run test:e2e
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Post-Deployment Verification**
   - [ ] Verify all pages load correctly
   - [ ] Test signup flow end-to-end
   - [ ] Test login from different regions
   - [ ] Verify email sending works
   - [ ] Check security headers in production
   - [ ] Monitor auth latency in different regions
   - [ ] Verify RLS policies are active

## Monitoring Setup

- [ ] Set up Vercel Analytics
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Create alerting rules:
  - [ ] Auth latency >250ms
  - [ ] Plan list load >1s
  - [ ] Error rate >1%
  - [ ] Downtime >2 minutes

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Auth API latency | <250ms P95 | - |
| Plan list load | <1s | - |
| Onboarding step save | <500ms P95 | - |

## Support & Incident Response

- [ ] Create incident response runbook
- [ ] Set up on-call rotation
- [ ] Document rollback procedure
- [ ] Create customer support email: support@plansmart.com

## Rollback Procedure

If issues are detected after deployment:

1. **Immediate Rollback**
   ```bash
   vercel rollback
   ```

2. **Database Rollback** (if migrations caused issues)
   ```bash
   npm run db:rollback
   ```

3. **Notify Stakeholders**
   - Update StatusPage.io
   - Send internal notification
   - Document incident

## Monthly Costs Estimate

| Service | Cost |
|---------|------|
| Supabase Pro (3 regions) | $75/month |
| Resend Pro | $20/month |
| Upstash Redis | $10/month |
| StatusPage.io | $29/month |
| PagerDuty | $21/month |
| Vercel Pro | $20/month |
| **Total** | **$175/month** |
