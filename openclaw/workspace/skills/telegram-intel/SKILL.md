---
name: telegram-intel
description: Scrape public Telegram channels via telesco.pe, translate non-English messages, and output structured JSON with categorized intel from milbloggers across all major conflict theaters.
metadata:
  openclaw:
    emoji: 📡
    category: intelligence
    permissions:
      network: [telesco.pe, cdn4.telesco.pe]
      filesystem: [write]
---

# telegram-intel

Scrapes public Telegram channels, translates non-English posts to English, and writes structured JSON to `state/latest-telegram-intel.json`.

## Channel List

### Ukrainian Official (`ua_official`)
| Username | Label |
|----------|-------|
| ukraine_context | Ukraine Context |
| GeneralStaffZSU | UA General Staff |
| UkrainianLandForces | UA Ground Forces |
| ukaborona | UA Ministry of Defense |
| AFUStratCom | AFU Strategic Comms |
| air_alert_ua | UA Air Alerts |
| kpszsu | UA Air Force Command |

### Ukrainian OSINT (`ua_osint`)
| Username | Label |
|----------|-------|
| DeepStateUA | DeepState Map |
| operativnoZSU | Operatyvnyi ZSU |
| Kherson_molodec | Kherson Insider |
| supernova_plus | Supernova+ |

### Ukrainian Intelligence (`ua_intel`)
| Username | Label |
|----------|-------|
| SBUkr | SBU Security Service |
| informnapalm | InformNapalm OSINT |
| DIUkraine | GUR Defense Intelligence |
| Atesh_UA | ATESH Partisan Movement |
| Molfar_global | Molfar OSINT |

### Ukrainian Frontline Units (`ua_frontline`)
| Username | Label |
|----------|-------|
| azov_media | Azov Brigade |
| kraken_kha | Kraken Unit Kharkiv |
| Soniashnyk | Soniashnyk Aviation |

### Ukrainian Journalism (`ua_journalism`)
| Username | Label |
|----------|-------|
| ssternenko | Sternenko |
| ButusovPlus | Butusov Plus |
| ivan_fedorov_zp | Zaporizhzhia RMA |
| Tsaplienko | Tsaplienko War Reporter |
| pravda_gerashchenko | Gerashchenko Advisor |

### Russian Official (`ru_official`)
| Username | Label |
|----------|-------|
| mod_russia | Russian MOD |
| mod_russia_en | Russian MOD (English) |
| MID_Russia | Russian MFA |
| MFARussia | Russian MFA (English) |

### Russian Milbloggers (`ru_milblog`)
| Username | Label |
|----------|-------|
| rybar | Rybar |
| dva_majors | Two Majors |
| RVvoenkor | RV Voenkor |
| wargonzo | WarGonzo |
| strelkovii | Strelkov / Girkin |
| voenkorKotenok | Voenkor Kotenok |
| epoddubny | Poddubny |
| Sladkov_plus | Sladkov+ |
| boris_rozhin | Colonelcassad |
| readovkanews | Readovka |
| voenacher | Turned on War |
| RKadyrov_95 | Kadyrov |
| bomber_fighter | Fighterbomber |
| grey_zone | Grey Zone / Wagner |
| Starshe_eddy | Starshe Eddy |
| sudoplatov_official | Sudoplatov Unit |
| ASTRApress | ASTRA Independent |
| CITeam | Conflict Intel Team |
| milinfolive | MilInfoLive |
| SosijPriobin | Military Observer |
| aleksandr_kots | Alexander Kots |
| inteSlava | Intel Slava Z |
| rlz_the_kraken | Kraken Z |

### English Analysis (`en_analysis`)
| Username | Label |
|----------|-------|
| NOELreports | NOEL Reports |
| wartranslated | War Translated |
| ukraine_front_lines | Ukraine Front Lines |
| ISW_official | Inst. for Study of War |
| UkraineNowEnglish | Ukraine NOW English |
| militarysummary | Military Summary |
| CITeam_en | Conflict Intel Team EN |

### English OSINT (`en_osint`)
| Username | Label |
|----------|-------|
| andrewperpetua | Andrew Perpetua |
| defmon3war | DefMon3 |

### Israel / Mideast Intel (`israel_milblog`)
| Username | Label |
|----------|-------|
| AbuAliExpress | Abu Ali Express (EN) |
| AbuAliExpressHeb | Abu Ali Express (HE) |
| israelwarlive | Israel War Live |
| idlofficialchannel | IDF Official |
| ilofficialchannel | IDF Telegram |
| idfonline | IDF Know What's Going On |
| israelrealtimee | Israel Realtime |
| osikimovilim | OSINT Israel & ME |
| INTELMEONLINE | Intel Middle East Online |
| manikimovilim | Manikimovilim |
| kann_news | Kann News |
| N12News | Channel 12 News |

### Iran / Resistance Axis (`iran_milblog`)
| Username | Label |
|----------|-------|
| resistance_trench | Resistance Trench |
| CIG_telegram | CIG Telegram |
| RNN_English | Resistance News Network |
| hezbollah_ops | Hezbollah Operations Room |
| military_media_sy | Military Media Syria |
| nujaba_media | Nujaba Military Media |
| yemen_press | Yemen Press Agency |
| ansarollah_en | Ansarollah English |

### Global OSINT (`global_osint`)
| Username | Label |
|----------|-------|
| OSINTdefender | OSINTdefender |
| ClashReport | Clash Report |
| DefenderDome | DefenderDome |
| MenchOsint | MenchOsint |
| IntelDoge | Intel Doge |
| TheIntelLab | The Intel Lab |
| sentdefender | SentDefender |
| wartranslated | WarTranslated |
| poolof_top | Pool N3 |

### Weapons & Equipment (`weapons`)
| Username | Label |
|----------|-------|
| UAWeapons | UA Weapons Tracker |
| UkraineWeaponsTracker | Weapons Tracker (Oryx) |

### Mapping & Geolocation (`mapping`)
| Username | Label |
|----------|-------|
| AMK_Mapping | AMK Mapping |
| Suriyakmaps | Suriyak Maps |
| mapsukraine | Ukraine Maps |
| war_mapper | War Mapper |

### Cyber Warfare (`cyber`)
| Username | Label |
|----------|-------|
| itarmyofukraine2022 | IT Army of Ukraine |

### Naval / Black Sea (`naval`)
| Username | Label |
|----------|-------|
| blackseastrategyinstitute | Black Sea Strategy Inst. |

### Air Defense & Monitoring (`air_defense`)
| Username | Label |
|----------|-------|
| warinukraineua | Ukrainian Witness |
| CyberspecNews | CYPERSPEC Air/UAV |

### Casualties & Equipment Losses (`casualties`)
| Username | Label |
|----------|-------|
| rf200_now_world | Cargo-200 Casualties |

### Satellite & Geospatial OSINT (`satellite`)
| Username | Label |
|----------|-------|
| sitreports | SITREP OSINT |
| kalibrated | Kalibrated Analysis |
| GeoSight | The GeoSight |
| mercsat | MERC-SAT Analytics |

### Drone Warfare (`drone`)
| Username | Label |
|----------|-------|
| aerorozvidka | Aerorozvidka Drones |

### Foreign Volunteer Units (`foreign_vol`)
| Username | Label |
|----------|-------|
| georgian_legion | Georgian Legion |

### Think Tanks & Analysis (`think_tank`)
| Username | Label |
|----------|-------|
| noel_reports | NOEL Reports Analysis |

## Output Format

JSON written to `state/latest-telegram-intel.json` with structure:
```json
{
  "timestamp": "2026-02-19 03:21 UTC",
  "source": "Telegram public channels",
  "total_channels": 90,
  "channels_fetched": 85,
  "total_messages": 1200,
  "categories": { "category_key": "Category Label", ... },
  "channels": [
    {
      "username": "channel_username",
      "label": "Human Label",
      "category": "category_key",
      "language": "uk",
      "message_count": 20,
      "messages": [
        {
          "text_original": "...",
          "text_en": "...",
          "datetime": "2026-02-18T12:00:00+00:00",
          "link": "https://t.me/channel/1234",
          "views": "50K",
          "media": [],
          "has_video": false,
          "has_photo": false,
          "language": "uk"
        }
      ]
    }
  ]
}
```

## Categories Reference

| Key | Label | Theater |
|-----|-------|---------|
| ua_official | Ukrainian Official | Ukraine |
| ua_osint | Ukrainian OSINT | Ukraine |
| ua_intel | Ukrainian Intelligence | Ukraine |
| ua_frontline | Ukrainian Frontline Units | Ukraine |
| ua_journalism | Ukrainian Journalism | Ukraine |
| ru_official | Russian Official | Ukraine/Russia |
| ru_milblog | Russian Milbloggers | Ukraine/Russia |
| en_analysis | English Analysis | Global |
| en_osint | English OSINT | Global |
| weapons | Weapons & Equipment | Global |
| mapping | Mapping & Geolocation | Global |
| cyber | Cyber Warfare | Global |
| naval | Naval / Black Sea | Ukraine/Global |
| air_defense | Air Defense & Monitoring | Ukraine |
| casualties | Casualties & Equipment Losses | Ukraine |
| satellite | Satellite & Geospatial OSINT | Global |
| drone | Drone Warfare | Ukraine |
| foreign_vol | Foreign Volunteer Units | Ukraine |
| think_tank | Think Tanks & Analysis | Global |
| israel_milblog | Israel / Mideast Intel | Middle East |
| iran_milblog | Iran / Resistance Axis | Middle East |
| global_osint | Global OSINT | Global |
