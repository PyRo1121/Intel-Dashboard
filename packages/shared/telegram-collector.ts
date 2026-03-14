export type TelegramCollectorMessageMedia = {
  url: string;
  type: "photo" | "video";
  width?: number;
  height?: number;
};

export type TelegramCollectorMessage = {
  channel: string;
  label: string;
  category: string;
  messageId: string;
  datetime: string;
  link: string;
  textOriginal: string;
  textEn?: string;
  imageTextEn?: string;
  language?: string;
  views?: string;
  media?: TelegramCollectorMessageMedia[];
  hasVideo?: boolean;
  hasPhoto?: boolean;
  collectorMessageId?: string;
};

export type TelegramCollectorBatch = {
  source: "mtproto";
  accountId: string;
  collectedAt: string;
  messages: TelegramCollectorMessage[];
};

export type TelegramIngestAuthority = "scraper" | "mtproto";

export type TelegramCollectorChannelSpec = {
  username: string;
  label: string;
  category: string;
};

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseTelegramCollectorChannelSpecs(raw: string | undefined | null): TelegramCollectorChannelSpec[] {
  const text = trim(raw);
  if (!text) return [];
  const seen = new Set<string>();
  const entries: TelegramCollectorChannelSpec[] = [];

  for (const part of text.split(/[\n,]+/)) {
    const compact = trim(part);
    if (!compact) continue;
    const [usernameRaw, labelRaw, categoryRaw] = compact.split("|");
    const username = trim(usernameRaw).replace(/^@+/, "").toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    entries.push({
      username,
      label: trim(labelRaw) || username,
      category: trim(categoryRaw).toLowerCase() || "telegram",
    });
  }

  return entries;
}

export function isTelegramCollectorBatch(value: unknown): value is TelegramCollectorBatch {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === "mtproto" &&
    typeof record.accountId === "string" &&
    typeof record.collectedAt === "string" &&
    Array.isArray(record.messages)
  );
}


export type TelegramChannelAuthority = "scraper" | "mtproto";
export type TelegramChannelJoinStatus = "pending" | "joined" | "unavailable";

export type TelegramChannelAuthorityRow = {
  channel: string;
  desiredAuthority: TelegramChannelAuthority;
  effectiveAuthority: TelegramChannelAuthority;
  joinStatus: TelegramChannelJoinStatus;
  lastCollectorMessageAt?: string | null;
  lastScraperMessageAt?: string | null;
  updatedAt: string;
};

export const DEFAULT_TELEGRAM_COLLECTOR_CHANNELS_RAW = "ukraine_context|Ukraine Context|ua_official,GeneralStaffZSU|UA General Staff|ua_official,AFUStratCom|AFU Strategic Comms|ua_official,air_alert_ua|UA Air Alerts|ua_official,kpszsu|UA Air Force Command|ua_official,DeepStateUA|DeepState Map|ua_osint,operativnoZSU|Operatyvnyi ZSU|ua_osint,supernova_plus|Supernova+|ua_osint,pilotblog|Denys Davydov|ua_osint,OSINT_Ukraine_Aggregation|UA OSINT Aggregator|ua_osint,SBUkr|SBU Security Service|ua_intel,informnapalm|InformNapalm OSINT|ua_intel,DIUkraine|GUR Defense Intelligence|ua_intel,Atesh_UA|ATESH Partisan Movement|ua_intel,Molfar_global|Molfar OSINT|ua_intel,azov_media|Azov Brigade|ua_frontline,Soniashnyk|Soniashnyk Aviation|ua_frontline,zsu35obmp|35th Marine Brigade|ua_frontline,ssternenko|Sternenko|ua_journalism,ButusovPlus|Butusov Plus|ua_journalism,ivan_fedorov_zp|Zaporizhzhia RMA|ua_journalism,Tsaplienko|Tsaplienko War Reporter|ua_journalism,pravda_gerashchenko|Gerashchenko Advisor|ua_journalism,nikolaev_vanek|Nikolayevsky Vanyok|ua_journalism,mod_russia|Russian MOD|ru_official,mod_russia_en|Russian MOD (English)|ru_official,MID_Russia|Russian MFA|ru_official,MFARussia|Russian MFA (English)|ru_official,saldo_vga|Vladimir Saldo (Kherson)|ru_official,tass_agency|TASS|ru_official,rian_ru|RIA Novosti|ru_official,rybar|Rybar|ru_milblog,dva_majors|Two Majors|ru_milblog,RVvoenkor|RV Voenkor|ru_milblog,wargonzo|WarGonzo|ru_milblog,strelkovii|Strelkov / Girkin|ru_milblog,voenkorKotenok|Voenkor Kotenok|ru_milblog,epoddubny|Poddubny|ru_milblog,Sladkov_plus|Sladkov+|ru_milblog,boris_rozhin|Colonelcassad|ru_milblog,readovkanews|Readovka|ru_milblog,voenacher|Turned on War|ru_milblog,RKadyrov_95|Kadyrov|ru_milblog,bomber_fighter|Fighterbomber|ru_milblog,grey_zone|Grey Zone / Wagner|ru_milblog,Starshe_eddy|Starshe Eddy|ru_milblog,sudoplatov_official|Sudoplatov Unit|ru_milblog,ASTRApress|ASTRA Independent|ru_milblog,CITeam|Conflict Intel Team|ru_milblog,milinfolive|MilInfoLive|ru_milblog,RWApodcast|Russians With Attitude|ru_milblog,milhelipilot|Helicopter Pilot|ru_milblog,ConflictChronicles|Chronicles of Conflict|ru_milblog,Russian_OSINT|Russian OSINT|ru_milblog,intelslava|Intel Slava Z|ru_milblog,rlz_the_kraken|Kraken Z|ru_milblog,medvedev_telegram|Medvedev|ru_milblog,adelimkhanov_95|Adelimkhanov|ru_milblog,osirskiy|Osirskiy|ru_milblog,neoficialniybezsonov|Unofficial Bezsonov|ru_milblog,sashakots|Kotsnews|ru_milblog,voin_dv|Voin DV|ru_milblog,opersvodki|Operative Summaries|ru_milblog,mig41|MIG Russia|ru_milblog,warfakes|War on Fakes|ru_milblog,infantmilitario|Militarist|ru_milblog,aptialaudinovakhmat|Apti Alaudinov (Akhmat)|ru_milblog,russ_orientalist|Russ Orientialist|ru_milblog,abbasdjuma|Abbas Djuma|ru_milblog,zhivoff|ZHIVOV|ru_milblog,zvezdanews|Zvezda News|ru_milblog,anna_news|ANNA News|ru_milblog,warhronika|War Chronicle|ru_milblog,new_militarycolumnist|Military Columnist|ru_milblog,wartranslated|War Translated|en_analysis,ISW_official|Inst. for Study of War|en_analysis,UkraineNowEnglish|Ukraine NOW English|en_analysis,militarysummary|Military Summary|en_analysis,CITeam_en|Conflict Intel Team EN|en_analysis,andrewperpetua|Andrew Perpetua|en_osint,defmon3war|DefMon3|en_osint,OsintUpdates|OSINT Updates|en_osint,AbuAliExpress|Abu Ali Express (EN)|israel_milblog,israelwarlive|Israel War Live|israel_milblog,idfonline|IDF Know What's Going On|israel_milblog,kann_news|Kann News|israel_milblog,CIG_telegram|CIG Telegram|iran_milblog,hezbollah_ops|Hezbollah Operations Room|iran_milblog,nujaba_media|Nujaba Military Media|iran_milblog,ansarollah_en|Ansarollah English|iran_milblog,sepahcybery|IRGC Cyber Force|iran_milblog,Irna_en|IRNA English|iran_milblog,tasnimnews|Tasnim News|iran_milblog,farsna|Fars News|iran_milblog,irna_ru|IRNA Russian|iran_milblog,sabrennewss|Sabereen News|iran_milblog,military_media_sy|Military Media Syria|syria_osint,Suriyakmaps|Suriyak Maps|syria_osint,KurdishFrontNews|Kurdish Front News|syria_osint,YPGInfo|YPG Press Office|syria_osint,YPJMediaCenter|YPJ Media Center|syria_osint,Levant24|Levant 24 Syria|syria_osint,OSINTdefender|OSINT Defender|global_osint,warmonitors|War Monitor|global_osint,ourwarstoday|Our Wars Today|global_osint,conflictstracker|Conflicts Tracker|global_osint,conflictarchive|Conflict Archive|global_osint,bellingcat|Bellingcat|global_osint,bellingcatmonitoring|Bellingcat Monitoring|global_osint,rnintel|Rerum Novarum Intel|global_osint,drmjournal|De Re Militari|global_osint,LiveuaMap|LiveUA Map|global_osint,DefenderDome|The Defender Dome|global_osint,OsintTv|OSINT TV|global_osint,ClashReport|Clash Report|global_osint,SudanWarMonitor|Sudan War Monitor|global_osint,UAWeapons|UA Weapons Tracker|weapons,UkraineWeaponsTracker|Weapons Tracker (Oryx)|weapons,LostArmour|Lost Armour Vehicle Tracker|weapons,AMK_Mapping|AMK Mapping|mapping,mapsukraine|Ukraine Maps|mapping,war_mapper|War Mapper|mapping,itarmyofukraine2022|IT Army of Ukraine|cyber,cyberknow20|CyberKnow Threat Intel|cyber,CyberWarzone|Cyber Warzone|cyber,vxunderground|vx-underground|cyber,MalwareHunterTeam|MalwareHunterTeam|cyber,gbhackers_news|GBHackers News|cyber,TheDFIRReport|The DFIR Report|cyber,RecordedFutureNews|Recorded Future News|cyber,CiscoTalosIntelligence|Cisco Talos Intelligence|cyber,MandiantAdvantage|Mandiant Intelligence|cyber,SentinelLabs|SentinelLabs|cyber,BleepingComputer|BleepingComputer|cyber,CISAKevWatch|CISA KEV Watch|cyber,CERT_EU_Security|CERT-EU Security|cyber,SANSInternetStormCenter|SANS ISC|cyber,OTXAlienVault|AlienVault OTX|cyber,MISPProject|MISP Project|cyber,ProjectZeroBlog|Project Zero|cyber,HuntressLabs|Huntress Labs|cyber,RedDrip7|RedDrip7|cyber,Unit42_Intel|Unit 42 Intel|cyber,Shadowserver|Shadowserver|cyber,CVE_Threat_Intel|CVE Threat Intel|cyber,blackseastrategyinstitute|Black Sea Strategy Inst.|naval,naval_intelligence|Naval Intelligence|naval,WarshipCam|Warship Cam|naval,warinukraineua|Ukrainian Witness|air_defense,CyberspecNews|CYBERSPEC Air/UAV|air_defense,MissileMap|Missile Map|air_defense,rf200_now_world|Cargo-200 Casualties|casualties,sitreports|SITREP OSINT|satellite,kalibrated|Kalibrated Analysis|satellite,GeoSight|The GeoSight|satellite,mercsat|MERC-SAT Analytics|satellite,MenchOsint|MenchOsint SATINT|satellite,weibo_6477763414|MizarVision|weibo_satellite,aerorozvidka|Aerorozvidka Drones|drone,fpv_drone_war|FPV Drone Warfare|drone,dronesquad_ua|Drone Squad UA|drone,georgian_legion|Georgian Legion|foreign_vol,InternationalLegionUA|International Legion UA|foreign_vol,fightforua|Fight for UA|foreign_vol,noel_reports|NOEL Reports Analysis|think_tank,RUSI_org|RUSI Defence Think Tank|think_tank,IISS_org|IISS Strategic Studies|think_tank,beholdisraelchannel|Behold Israel|middle_east_osint,Yemenimilitary|Yemen Military|middle_east_osint,OSESGY1|UN Envoy Yemen|middle_east_osint,yemenmofa|Yemen MFA (Sanaa)|middle_east_osint,BasedIMINT|Based IMINT|middle_east_osint,RSFSudan|RSF Sudan|sudan_conflict,GeneralDagalo|Hemedti / RSF Commander|sudan_conflict,newsfromsudan|News from Sudan|sudan_conflict,SudanNewsEnglish|Sudan News Network|sudan_conflict,Channel29News|Ethiopia / Tigray Conflict|sudan_conflict,tsegaye_r_ararsaa|OLA Oromo Liberation|sudan_conflict,borkena|Borkena Ethiopia|sudan_conflict,AlmanaraMedia|Libya LNA / Haftar Media|africa_osint,xlrmedia|Africa News Aggregator|africa_osint,addis_news|Addis News|africa_osint,gebeyanews|Gebeya News|africa_osint,chinamilitary|China Military|asia_pacific_osint,SouthChinaSea|South China Sea|asia_pacific_osint,taiwannews|Taiwan News|asia_pacific_osint,ETReport|Korea / DPRK Monitor|asia_pacific_osint,xinhua_news_agency_en|Xinhua News EN|asia_pacific_osint,xinhua_news_agency_ru|Xinhua News RU|asia_pacific_osint,thekashmirgraph|Kashmir News Portal|south_asia_osint,DSquadOfficial|Defence Squad Pak-India|south_asia_osint,meghupdates|India Security Updates|south_asia_osint,nato_aircom|NATO Air Command|nato_tracking,natoarmynews|NATO Army News|nato_tracking,natovideos|NATO Videos|nato_tracking,defcon_alerts|Defcon Alerts|nuclear_monitoring,DEFCONWarningSystem|DEFCON Warning System|nuclear_monitoring,InsightCrimeEN|InSight Crime|latam_security,BorderlandBeat|Borderland Beat|latam_security,ColombiaReports|Colombia Reports|latam_security,VenezuelaIntl|Venezuela Intl|latam_security,HaitiInfoProject|Haiti Info Project|latam_security,entre_guerras|Entre Guerras|latam_security,Conflictos_Ecuador|Ecuador Conflicts|latam_security,la_patilla|La Patilla Venezuela|latam_security,sinembargomx|SinEmbargo Mexico|latam_security,MexicoViolencia|Mexico Violencia|cartel_osint,NarcoFiles|Narco Files|cartel_osint,warinmex|War in Mexico|cartel_osint,elblogdelnarcoofc|Blog del Narco (Official)|cartel_osint,thecartelchannel|The Cartel Channel|cartel_osint,carteldelmexico_off|Cartel de Mexico|cartel_osint,alertachiapas|Alerta Chiapas|cartel_osint,ElGuero_Mx|El Guero Mexico|cartel_osint,MUNDONARCOMX|Mundo Narco MX|cartel_osint,intervencionpolicia|Peru Police Operations|south_america_osint,quepasaaraucania|Araucania/Mapuche Conflict|south_america_osint,frentemilitargeo|LATAM Military & Geopolitics|south_america_osint,Movimiento_Disidente|LATAM Dissident Movements|south_america_osint,correodelsur|Correo del Sur Bolivia|south_america_osint,AvispaMidia|Amazon Indigenous Conflict|south_america_osint";

export function getTelegramCollectorChannelSpecs(raw: string | undefined | null): TelegramCollectorChannelSpec[] {
  const parsed = parseTelegramCollectorChannelSpecs(raw);
  return parsed.length > 0 ? parsed : parseTelegramCollectorChannelSpecs(DEFAULT_TELEGRAM_COLLECTOR_CHANNELS_RAW);
}
