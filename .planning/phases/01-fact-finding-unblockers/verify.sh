#!/usr/bin/env bash
set -u

# Phase 1 Verification Script — Wave 0 Infrastructure
# Aggregates all D-* validation commands from RESEARCH.md Validation Architecture.
# Exit code = number of failures (0 = all green).

FAIL=0
FULL=false
if [[ "${1:-}" == "--full" ]]; then
  FULL=true
fi

# ---------------------------------------------------------------------------
# D-01: Trademark clearance file exists
# ---------------------------------------------------------------------------
if test -f .planning/legal/trademark-clearance-dwella.md; then
  echo "OK: D-01 — trademark-clearance-dwella.md exists"
else
  echo "FAIL: D-01 — trademark-clearance-dwella.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-02: Trademark doc references >= 3 official search URLs
# ---------------------------------------------------------------------------
if test -f .planning/legal/trademark-clearance-dwella.md; then
  COUNT=$(grep -cE '(tmsearch\.uspto\.gov|euipo\.europa\.eu/eSearch|tmrsearch\.ipindia\.gov\.in)' .planning/legal/trademark-clearance-dwella.md || true)
  if [ "${COUNT}" -ge 3 ]; then
    echo "OK: D-02 — trademark doc references >= 3 search URLs (found ${COUNT})"
  else
    echo "FAIL: D-02 — trademark doc references < 3 search URLs (found ${COUNT})"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-02 — trademark-clearance-dwella.md missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-03: Trademark doc has >= 3 section headings AND >= 3 conclusion lines
# ---------------------------------------------------------------------------
if test -f .planning/legal/trademark-clearance-dwella.md; then
  HEADINGS=$(grep -c '^### ' .planning/legal/trademark-clearance-dwella.md || true)
  CONCLUSIONS=$(grep -ciE '^conclusion:' .planning/legal/trademark-clearance-dwella.md || true)
  if [ "${HEADINGS}" -ge 3 ] && [ "${CONCLUSIONS}" -ge 3 ]; then
    echo "OK: D-03 — trademark doc structure valid (${HEADINGS} headings, ${CONCLUSIONS} conclusions)"
  else
    echo "FAIL: D-03 — trademark doc structure insufficient (${HEADINGS} headings, ${CONCLUSIONS} conclusions; need >= 3 each)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-03 — trademark-clearance-dwella.md missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-04: Warn if trademark doc contains exact conflict or STOP
# ---------------------------------------------------------------------------
if test -f .planning/legal/trademark-clearance-dwella.md; then
  CONFLICTS=$(grep -iE '(exact conflict|STOP)' .planning/legal/trademark-clearance-dwella.md || true)
  if [ -z "${CONFLICTS}" ]; then
    echo "OK: D-04 — no exact conflicts or STOP markers found"
  else
    echo "WARN: D-04 — trademark doc contains conflict/STOP markers (human review required):"
    echo "${CONFLICTS}"
    # D-04 is a warning, not a hard fail
  fi
else
  echo "FAIL: D-04 — trademark-clearance-dwella.md missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-06: dwella-nobroker-teal.jsx must NOT exist
# ---------------------------------------------------------------------------
if test ! -f dwella-nobroker-teal.jsx; then
  echo "OK: D-06 — dwella-nobroker-teal.jsx does not exist"
else
  echo "FAIL: D-06 — dwella-nobroker-teal.jsx still exists (must be deleted)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-07: Zero references to 'nobroker' outside exclusions
# ---------------------------------------------------------------------------
NB_COUNT=$(grep -riIE 'nobroker' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning --exclude=THIRD-PARTY-LICENSES.md 2>/dev/null | wc -l || true)
NB_COUNT=$(echo "${NB_COUNT}" | tr -d '[:space:]')
if [ "${NB_COUNT}" -eq 0 ]; then
  echo "OK: D-07 — zero nobroker references found"
else
  echo "FAIL: D-07 — ${NB_COUNT} nobroker reference(s) found outside exclusions"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-09: Working directory basename is "Dwella v2"
# ---------------------------------------------------------------------------
DIR_NAME=$(basename "$(pwd)")
if [ "${DIR_NAME}" = "Dwella v2" ]; then
  echo "OK: D-09 — working directory is 'Dwella v2'"
else
  echo "FAIL: D-09 — working directory is '${DIR_NAME}', expected 'Dwella v2'"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-10: npm-licenses.json exists and has >= 1 entry
# ---------------------------------------------------------------------------
if test -f .planning/legal/npm-licenses.json; then
  LIC_COUNT=$(jq 'length' .planning/legal/npm-licenses.json 2>/dev/null || echo "0")
  if [ "${LIC_COUNT}" -ge 1 ]; then
    echo "OK: D-10 — npm-licenses.json has ${LIC_COUNT} entries"
  else
    echo "FAIL: D-10 — npm-licenses.json has 0 entries"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-10 — npm-licenses.json missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-11: No GPL/AGPL/LGPL/SSPL in npm-licenses.json
# ---------------------------------------------------------------------------
if test -f .planning/legal/npm-licenses.json; then
  if ! grep -iE '"licenses?": *"[^"]*\b(A?GPL|LGPL|SSPL)[^"]*"' .planning/legal/npm-licenses.json > /dev/null 2>&1; then
    echo "OK: D-11 — no GPL/AGPL/LGPL/SSPL licenses found"
  else
    echo "FAIL: D-11 — GPL/AGPL/LGPL/SSPL license(s) detected in npm-licenses.json"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-11 — npm-licenses.json missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-12: asset-provenance.md exists with >= 5 section headings
# ---------------------------------------------------------------------------
if test -f .planning/legal/asset-provenance.md; then
  SEC_COUNT=$(grep -c '^## ' .planning/legal/asset-provenance.md || true)
  if [ "${SEC_COUNT}" -ge 5 ]; then
    echo "OK: D-12 — asset-provenance.md has ${SEC_COUNT} sections (>= 5)"
  else
    echo "FAIL: D-12 — asset-provenance.md has ${SEC_COUNT} sections (need >= 5)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-12 — asset-provenance.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-13: THIRD-PARTY-LICENSES.md exists with no-GPL attestation
# ---------------------------------------------------------------------------
if test -f THIRD-PARTY-LICENSES.md; then
  GPL_ATT=$(grep -ciE 'no (GPL|AGPL)' THIRD-PARTY-LICENSES.md || true)
  if [ "${GPL_ATT}" -ge 1 ]; then
    echo "OK: D-13 — THIRD-PARTY-LICENSES.md contains no-GPL attestation"
  else
    echo "FAIL: D-13 — THIRD-PARTY-LICENSES.md missing no-GPL attestation"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-13 — THIRD-PARTY-LICENSES.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-15: Anthropic DPA PDF exists
# ---------------------------------------------------------------------------
DPA_COUNT=$(ls .planning/legal/anthropic-dpa-public*.pdf 2>/dev/null | wc -l || true)
DPA_COUNT=$(echo "${DPA_COUNT}" | tr -d '[:space:]')
if [ "${DPA_COUNT}" -ge 1 ]; then
  echo "OK: D-15 — Anthropic DPA PDF found (${DPA_COUNT} file(s))"
else
  echo "FAIL: D-15 — no Anthropic DPA PDF found in .planning/legal/"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-16: dpa-register.md records Commercial Terms acceptance date
# ---------------------------------------------------------------------------
if test -f .planning/legal/dpa-register.md; then
  DPA_COMM=$(grep -ciE 'Commercial Terms accepted on [0-9]' .planning/legal/dpa-register.md || true)
  if [ "${DPA_COMM}" -ge 1 ]; then
    echo "OK: D-16 — DPA register records Commercial Terms acceptance"
  else
    echo "FAIL: D-16 — DPA register missing Commercial Terms acceptance date"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-16 — dpa-register.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-17: dpa-register.md references Supabase DPA URL
# ---------------------------------------------------------------------------
if test -f .planning/legal/dpa-register.md; then
  SB_DPA=$(grep -c 'supabase\.com/legal/dpa' .planning/legal/dpa-register.md || true)
  if [ "${SB_DPA}" -ge 1 ]; then
    echo "OK: D-17 — DPA register references Supabase DPA URL"
  else
    echo "FAIL: D-17 — DPA register missing Supabase DPA URL"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-17 — dpa-register.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-19: cross-border-transfers.md contains a cloud region
# ---------------------------------------------------------------------------
if test -f .planning/legal/cross-border-transfers.md; then
  if grep -iE 'region: *(us|eu|ap|sa)-[a-z]+-[0-9]+' .planning/legal/cross-border-transfers.md > /dev/null 2>&1; then
    echo "OK: D-19 — cross-border-transfers.md contains a cloud region"
  else
    echo "FAIL: D-19 — cross-border-transfers.md missing cloud region"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-19 — cross-border-transfers.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-20: PROJECT.md has Infrastructure section with Supabase region
# ---------------------------------------------------------------------------
if test -f .planning/PROJECT.md; then
  HAS_INFRA=$(grep -ciE '^## Infrastructure' .planning/PROJECT.md || true)
  HAS_REGION=$(grep -ciE 'supabase.*region' .planning/PROJECT.md || true)
  if [ "${HAS_INFRA}" -ge 1 ] && [ "${HAS_REGION}" -ge 1 ]; then
    echo "OK: D-20 — PROJECT.md has Infrastructure section with Supabase region"
  else
    echo "FAIL: D-20 — PROJECT.md missing Infrastructure section (${HAS_INFRA}) or Supabase region (${HAS_REGION})"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-20 — PROJECT.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-21: cross-border-transfers.md references GDPR, DPDP, and SCC >= 3 times
# ---------------------------------------------------------------------------
if test -f .planning/legal/cross-border-transfers.md; then
  LAW_COUNT=$(grep -cE 'GDPR|DPDP|SCC' .planning/legal/cross-border-transfers.md || true)
  if [ "${LAW_COUNT}" -ge 3 ]; then
    echo "OK: D-21 — cross-border-transfers.md references GDPR/DPDP/SCC ${LAW_COUNT} times"
  else
    echo "FAIL: D-21 — cross-border-transfers.md references GDPR/DPDP/SCC only ${LAW_COUNT} times (need >= 3)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-21 — cross-border-transfers.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-23: No analytics/tracker SDKs in project config files
# ---------------------------------------------------------------------------
if ! grep -iE 'sentry|posthog|amplitude|mixpanel|segment|firebase-analytics|branch|adjust|appsflyer|rudderstack|heap|statsig|customerio|fullstory|hotjar' package.json app.json android/app/build.gradle 2>/dev/null > /dev/null 2>&1; then
  echo "OK: D-23 — no analytics/tracker SDKs found in config files"
else
  echo "FAIL: D-23 — analytics/tracker SDK reference(s) found in config files"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-24: runtime-hostnames.txt exists with >= 1 line
# ---------------------------------------------------------------------------
if test -f .planning/legal/runtime-hostnames.txt; then
  LINE_COUNT=$(wc -l < .planning/legal/runtime-hostnames.txt || echo "0")
  LINE_COUNT=$(echo "${LINE_COUNT}" | tr -d '[:space:]')
  if [ "${LINE_COUNT}" -ge 1 ]; then
    echo "OK: D-24 — runtime-hostnames.txt has ${LINE_COUNT} line(s)"
  else
    echo "FAIL: D-24 — runtime-hostnames.txt is empty"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-24 — runtime-hostnames.txt missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-25: All runtime hostnames are in the allowed list
# ---------------------------------------------------------------------------
if test -f .planning/legal/runtime-hostnames.txt; then
  UNKNOWN=$(grep -vE '^(.*\.supabase\.(co|in)|api\.telegram\.org|api\.anthropic\.com|.*\.push\.apple\.com|fcm\.googleapis\.com|.*\.expo\.(dev|io))$' .planning/legal/runtime-hostnames.txt 2>/dev/null | wc -l || true)
  UNKNOWN=$(echo "${UNKNOWN}" | tr -d '[:space:]')
  if [ "${UNKNOWN}" -eq 0 ]; then
    echo "OK: D-25 — all runtime hostnames are in allowed list"
  else
    echo "FAIL: D-25 — ${UNKNOWN} unknown hostname(s) in runtime-hostnames.txt"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-25 — runtime-hostnames.txt missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-26: tracker-audit.md exists with no-tracker attestation
# ---------------------------------------------------------------------------
if test -f .planning/legal/tracker-audit.md; then
  TRACKER_ATT=$(grep -ciE 'no (third-party analytics|silent trackers|ad SDK)' .planning/legal/tracker-audit.md || true)
  if [ "${TRACKER_ATT}" -ge 1 ]; then
    echo "OK: D-26 — tracker-audit.md contains no-tracker attestation"
  else
    echo "FAIL: D-26 — tracker-audit.md missing no-tracker attestation"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-26 — tracker-audit.md missing"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-28: asset-provenance.md has >= 20 provenance metadata fields
# ---------------------------------------------------------------------------
if test -f .planning/legal/asset-provenance.md; then
  META_COUNT=$(grep -cE '(creator:|tool:|license:|date:)' .planning/legal/asset-provenance.md || true)
  if [ "${META_COUNT}" -ge 20 ]; then
    echo "OK: D-28 — asset-provenance.md has ${META_COUNT} provenance fields (>= 20)"
  else
    echo "FAIL: D-28 — asset-provenance.md has ${META_COUNT} provenance fields (need >= 20)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-28 — asset-provenance.md missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-30: asset-provenance.md has no unknown/unrecoverable/BLOCKER markers
# ---------------------------------------------------------------------------
if test -f .planning/legal/asset-provenance.md; then
  if ! grep -iE '(unknown|unrecoverable|BLOCKER)' .planning/legal/asset-provenance.md > /dev/null 2>&1; then
    echo "OK: D-30 — asset-provenance.md has no unknown/unrecoverable/BLOCKER markers"
  else
    echo "FAIL: D-30 — asset-provenance.md contains unknown/unrecoverable/BLOCKER markers"
    FAIL=$((FAIL + 1))
  fi
else
  echo "FAIL: D-30 — asset-provenance.md missing (prerequisite)"
  FAIL=$((FAIL + 1))
fi

# ---------------------------------------------------------------------------
# D-31: asset-provenance.md exists
# ---------------------------------------------------------------------------
if test -f .planning/legal/asset-provenance.md; then
  echo "OK: D-31 — asset-provenance.md exists"
else
  echo "FAIL: D-31 — asset-provenance.md missing"
  FAIL=$((FAIL + 1))
fi

# ===========================================================================
echo ""
echo "=== Phase 1 verify: $FAIL failure(s) ==="
exit $FAIL
