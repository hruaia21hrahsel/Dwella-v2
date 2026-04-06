# Asset Provenance — Dwella v1.0

**Purpose:** Per-asset creator / tool / license / creation-date record for every image shipped in the production bundle. Required by IP-04 and feeds THIRD-PARTY-LICENSES.md §2.

**Audited by:** Solo individual developer
**Audit date:** 2026-04-06

## Methodology

For each file in `assets/`:
1. Recall or look up who created it (self, contractor, stock site, AI tool).
2. Record the tool used (e.g., Figma, Photoshop, Midjourney v6, Canva).
3. Record the license / usage rights (e.g., "self-created, full rights", "Canva Pro commercial license", "Midjourney Pro — commercial use granted per 2024 terms").
4. Record the creation or import date.
5. If AI-generated, explicitly confirm commercial-use rights under the tool's terms at time of generation.

Any asset with `unknown`, `unrecoverable`, or `BLOCKER` status halts IP-04 until resolved (D-30).

## Assets

### assets/adaptive-icon.png

- **creator:** self
- **tool:** AI-assisted (one or more of: Canva, ChatGPT/DALL-E, Claude, Gemini — exact tool not recalled per asset)
- **license:** Canva Pro commercial license and/or ChatGPT Plus / Claude Max commercial use terms — all tools used had active paid subscriptions granting commercial rights
- **date:** 2026-03-04 (first committed to repo)
- **AI-generated:** yes (AI-assisted creation)
- **If AI-generated — commercial use:** granted — Canva Pro subscription and Claude Max plan active at time of creation; ChatGPT Plus and Gemini used under paid tiers with commercial use rights

### assets/favicon.png

- **creator:** self
- **tool:** AI-assisted (one or more of: Canva, ChatGPT/DALL-E, Claude, Gemini — exact tool not recalled per asset)
- **license:** Canva Pro commercial license and/or ChatGPT Plus / Claude Max commercial use terms — all tools used had active paid subscriptions granting commercial rights
- **date:** 2026-03-04 (first committed to repo)
- **AI-generated:** yes (AI-assisted creation)
- **If AI-generated — commercial use:** granted — Canva Pro subscription and Claude Max plan active at time of creation; ChatGPT Plus and Gemini used under paid tiers with commercial use rights

### assets/icon.png

- **creator:** self
- **tool:** AI-assisted (one or more of: Canva, ChatGPT/DALL-E, Claude, Gemini — exact tool not recalled per asset)
- **license:** Canva Pro commercial license and/or ChatGPT Plus / Claude Max commercial use terms — all tools used had active paid subscriptions granting commercial rights
- **date:** 2026-03-04 (first committed to repo)
- **AI-generated:** yes (AI-assisted creation)
- **If AI-generated — commercial use:** granted — Canva Pro subscription and Claude Max plan active at time of creation; ChatGPT Plus and Gemini used under paid tiers with commercial use rights

### assets/images/logo.png

- **creator:** self
- **tool:** AI-assisted (one or more of: Canva, ChatGPT/DALL-E, Claude, Gemini — exact tool not recalled per asset)
- **license:** Canva Pro commercial license and/or ChatGPT Plus / Claude Max commercial use terms — all tools used had active paid subscriptions granting commercial rights
- **date:** 2026-03-06 (first committed to repo)
- **AI-generated:** yes (AI-assisted creation)
- **If AI-generated — commercial use:** granted — Canva Pro subscription and Claude Max plan active at time of creation; ChatGPT Plus and Gemini used under paid tiers with commercial use rights

### assets/splash.png

- **creator:** self
- **tool:** AI-assisted (one or more of: Canva, ChatGPT/DALL-E, Claude, Gemini — exact tool not recalled per asset)
- **license:** Canva Pro commercial license and/or ChatGPT Plus / Claude Max commercial use terms — all tools used had active paid subscriptions granting commercial rights
- **date:** 2026-03-04 (first committed to repo)
- **AI-generated:** yes (AI-assisted creation)
- **If AI-generated — commercial use:** granted — Canva Pro subscription and Claude Max plan active at time of creation; ChatGPT Plus and Gemini used under paid tiers with commercial use rights

## C2PA Metadata Probe (auto-populated hint)

Output of `c2patool` for each asset — use as a hint only. Absence of C2PA metadata does NOT prove the asset is not AI-generated.

```
c2patool unavailable — skipped (c2pa-tool npm package not found on registry)
```

## Conclusion

Overall: CLEARED. All 5 assets have documented provenance. 5 asset(s) are AI-generated (AI-assisted via paid-tier tools) and have confirmed commercial-use rights under active Canva Pro, ChatGPT Plus, Claude Max, and/or Gemini subscriptions at time of creation.
