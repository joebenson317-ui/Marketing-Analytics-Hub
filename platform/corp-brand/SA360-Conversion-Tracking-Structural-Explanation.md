# Why the SA360 Build Has Four Mappings — Structural Explanation

## The original question

Khayri's notes from the call raised this: for Search SA360 across LOBs, there are four separate mappings — Ad-level front-end metrics, Keyword-level front-end metrics, Ad-level conversions, and Keyword-level conversions. The question was whether the SA360 connector prevents pulling Ad, Keyword, and Conversion Tag data together in one report, or whether this was a deliberate build choice.

Annalect's position, communicated separately: this is a structural issue in Datorama.

## What we found, in order

**1. SA360's own reporting API is genuinely split by level.**
Google's Search Ads 360 Reporting API defines separate report types for Ad, Ad Group, Keyword, and Conversion — Ad and Keyword sit as siblings under Ad Group rather than in a parent-child relationship, so a single row-level report can't natively combine them. This holds true in SA360's native UI, independent of any third-party tool.
*Source: Google for Developers, "Types of Reports | Search Ads 360 API," and the individual report-type pages (Ad, Ad Group, Keyword, Conversion) — https://developers.google.com/search-ads/v2/report-types*

**2. Datorama's SA360 connector offers checkboxes that add keyword and conversion data onto one stream.**
The connector's "Get Conversions Data" option adds a conversion bucket (Conversion Tag Category, Conversion Tag Key, Conversion Tag Name, Total Conversions, and related fields) to a data stream. A separate "Get Keyword Data" option adds a Search Keywords bucket (keyword text, match type, quality score, impressions, clicks, cost, position) to the same stream. Both can be checked at once.
*Source: Salesforce Help, "Search Ads 360 API Connector" — https://help.salesforce.com/s/articleView?id=dato_data_streams_api_connect_search_ads360.htm*

**3. Datorama's own data model treats Ads, Search Keywords, Conversion Tag, and Conversion Tag with Keywords as four distinct data stream types.**
Each data stream type has its own main entity and schema, and Datorama deliberately keeps these relationships separate in its database to avoid incorrect aggregation. Media Buy is the main entity for the Ads type but not for the Conversions type. Datorama also documents a dedicated "Conversion Tag with Keywords" type, built specifically to ingest conversion data together with the search keywords that drove it, and lists Search Ads 360 as a supported provider for that type.
*Source: Salesforce Help, "Data Model for Marketing Cloud Intelligence" — https://help.salesforce.com/s/articleView?id=mktg.dato_data_model.htm* (sent by Annalect)

**4. Media Transparency Center (MTC) is unrelated to any of this.**
MTC is a separate premium add-on for reconciling planned media (Insertion Orders) against delivered media for budget pacing — it has no bearing on which fields a connector can pull. Not having MTC doesn't restrict the SA360 connector's keyword/conversion options; those live in core Data Streams / API Connectors, the same base functionality as the Harmonization Center (Classification + Patterns) already in use.
*Source: Salesforce Help, "Media Transparency Center" — https://help.salesforce.com/s/articleView?id=sf.dato_mtc_intro.htm*

**5. Confirmed against the live configuration.**
The actual SA360 data stream is set to Ad Group level, with Get Keyword Data, Get Conversions Data, and Get Device Breakdown checked (no geo breakdown). Its manual mapping contains four sections: Ads, Search Keywords, Conversion Tag, and Conversion Tag with Keywords — one stream, four mapping tabs, matching the four data stream types Datorama documents in Source 3. This also confirmed that keyword-level conversions are already using the native Conversion Tag with Keywords type, not a workaround.
*Source: direct inspection of the live Datorama data stream configuration.*

## Conclusion

Annalect's framing holds up: it's a structural feature of Datorama's data model, not an arbitrary agency choice. Datorama's own entity model keeps Ad-level and Keyword-level data as separate types with separate main entities, so they can't be flattened into one row — that's true independent of SA360's API-level split, though the two reinforce each other. What "four separate mappings" actually describes is not four separate data streams; it's the four native mapping sections of one properly configured SA360 stream, built the way Datorama's connector is designed to be used when both extended properties are enabled.

## Sources

1. Google for Developers — Types of Reports, Search Ads 360 API: https://developers.google.com/search-ads/v2/report-types
2. Salesforce Help — Search Ads 360 API Connector: https://help.salesforce.com/s/articleView?id=dato_data_streams_api_connect_search_ads360.htm
3. Salesforce Help — Data Model for Marketing Cloud Intelligence: https://help.salesforce.com/s/articleView?id=mktg.dato_data_model.htm
4. Salesforce Help — Media Transparency Center: https://help.salesforce.com/s/articleView?id=sf.dato_mtc_intro.htm
5. Internal — GS-CB-Datorama Infrastructure Breakdown.xlsx (Sheet1: data stream list, including the existing `IBD SA360 Custom Keyword Conversion` stream mapped as Conversion Tag With Keywords)
6. Internal — live SA360 data stream configuration (Ad Group level; Get Keyword Data, Get Conversions Data, Get Device Breakdown checked; four-section manual mapping)
