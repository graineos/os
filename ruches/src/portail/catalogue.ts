/**
 * Ruches — catalogue du portail : raccourcis et services français du quotidien.
 * Données pures : aucune dépendance à un hôte. Chaque lien ouvre le site de l'éditeur, qui applique ses règles.
 * Licence AGPL-3.0 (projet Ruches).
 */
import type { LucideIcon } from "lucide-react";
import { Mail, Cloud, CloudSun, CalendarDays, Images, Navigation, ContactRound, Map, Video, Clapperboard, Music2, BookOpen, Sparkles, Languages, Info, Heart, Users, MessagesSquare, ShieldCheck, UsersRound, UserSearch, TentTree, MessageCircleMore, LibraryBig, Landmark, ShoppingBag, GraduationCap, Cpu, HeartPulse, Briefcase, TrainFront, Receipt, HandCoins, Handshake, Radio, HeartHandshake, Sprout, PawPrint, Cross, HandHeart, Rss, RadioTower, Tv, MonitorPlay, MessageSquareLock } from "lucide-react";

export type PanelServiceKey = "forum" | "useful" | "good" | "radio" | "tv" | "mail" | "messages" | "routes" | "music" | "ai";

export type Service = {
  name: string;
  description: string;
  url: string;
  icon: LucideIcon;
  accent: string;
  panel?: PanelServiceKey;
  keywords?: string[];
};

export const services: Service[] = [
  {
    name: "Radio",
    description: "Radios & podcasts français",
    url: "#radio",
    icon: RadioTower,
    accent: "#c5221f",
    panel: "radio",
    keywords: ["radio", "radios", "webradio", "podcast", "podcasts", "écouter", "france inter", "rtl", "nrj", "skyrock"],
  },
  {
    name: "TV",
    description: "Chaînes & replay français",
    url: "#tv",
    icon: Tv,
    accent: "#1d4ed8",
    panel: "tv",
    keywords: ["tv", "télé", "television", "replay", "direct", "france.tv", "tf1", "m6", "arte", "canal"],
  },
  {
    name: "Mail",
    description: "Messageries e-mail françaises",
    url: "#mail",
    icon: Mail,
    accent: "#2b6cb0",
    panel: "mail",
    keywords: ["mail", "email", "e-mail", "courriel", "boîte", "mailo", "laposte", "caramail"],
  },
  {
    name: "Messageries",
    description: "Messageries instantanées chiffrées",
    url: "#messageries",
    icon: MessageSquareLock,
    accent: "#0f766e",
    panel: "messages",
    keywords: ["messagerie", "messageries", "chat", "chiffré", "olvid", "skred", "treebal", "signal"],
  },
  {
    name: "Réseaux",
    description: "Réseaux & forums français",
    url: "#reseaux",
    icon: MessagesSquare,
    accent: "#1a73e8",
    panel: "forum",
    keywords: ["réseaux", "reseaux", "forum", "communauté", "discussion", "social", "mastodon"],
  },
  {
    name: "Sites utiles",
    description: "Sites français du quotidien",
    url: "#sites-utiles",
    icon: LibraryBig,
    accent: "#0f766e",
    panel: "useful",
    keywords: ["sites utiles", "démarches", "administration", "services publics", "quotidien", "annonces", "santé", "emploi", "impôts"],
  },
  { name: "Stockage", description: "Fichiers avec Mailo", url: "https://www.mailo.com/?language=fr&page=id", icon: Cloud, accent: "#0f766e" },
  { name: "Agenda", description: "Calendrier avec Mailo", url: "https://www.mailo.com/?language=fr&page=id", icon: CalendarDays, accent: "#2563eb" },
  { name: "Photos", description: "Photos avec Photoweb Cloud", url: "https://account.photowebcloud.fr/login.php", icon: Images, accent: "#e11d48" },
  {
    name: "Itinéraires",
    description: "Itinéraires & cartes françaises",
    url: "#itineraires",
    icon: Navigation,
    accent: "#7c3aed",
    panel: "routes",
    keywords: ["itinéraire", "itineraires", "trajet", "route", "gps", "guidage", "mappy", "viamichelin", "carte"],
  },

  { name: "Annuaire", description: "PagesJaunes et PagesBlanches", url: "https://www.pagesjaunes.fr/", icon: ContactRound, accent: "#eab308" },
  { name: "Carte", description: "Cartes avec l’IGN", url: "https://cartes.gouv.fr/decouvrir/explorer-les-cartes/", icon: Map, accent: "#15803d" },
  { name: "Vidéo", description: "Avec Dailymotion", url: "https://www.dailymotion.com/fr", icon: Video, accent: "#111827" },
  { name: "Films & Séries", description: "Films et séries avec AlloCiné", url: "https://www.allocine.fr/", icon: Clapperboard, accent: "#111827" },
  {
    name: "Musique",
    description: "Musique en ligne française",
    url: "#musique",
    icon: Music2,
    accent: "#a21caf",
    panel: "music",
    keywords: ["musique", "streaming", "écouter", "deezer", "qobuz", "album", "playlist"],
  },

  { name: "Livres", description: "Avec Vivlio", url: "https://www.vivlio.com/", icon: BookOpen, accent: "#c2410c" },
  {
    name: "IA",
    description: "Avec Gemini",
    url: "#ia-mistral",
    icon: Sparkles,
    accent: "#f97316",
    panel: "ai",
    keywords: ["ia", "i.a", "intelligence artificielle", "mistral", "chat ia", "assistant", "chatbot"],
  },
  { name: "Météo", description: "Prévisions avec Météo-France", url: "https://meteofrance.com/", icon: CloudSun, accent: "#0284c7" },
  { name: "Traduction", description: "Avec Reverso", url: "https://www.reverso.net/traduction-texte", icon: Languages, accent: "#0369a1" },
  {
    name: "Bonne action",
    description: "Solidarité & associations françaises",
    url: "#bonne-action",
    icon: HeartHandshake,
    accent: "#c2185b",
    panel: "good",
    keywords: ["bonne action", "association", "associations", "don", "dons", "solidaire", "solidarité", "bénévolat", "caritatif", "lilo"],
  },
];

export type LinkCard = {
  name: string;
  description: string;
  url: string;
  host: string;
  badge: string;
  icon: LucideIcon;
  accent: string;
  recommended?: boolean;
};

export type LinkGroup = { title: string; note?: string; secondary?: boolean; items: LinkCard[] };

// Radio : Radioplayer France en premier choix, puis accès rapides vers les sites officiels.
export const radioGroups: LinkGroup[] = [
  {
    title: "Écouter toutes les radios",
    items: [
      {
        name: "Radioplayer France",
        description: "Plateforme officielle et gratuite des radios françaises : radios, webradios et podcasts.",
        url: "https://www.radioplayer.fr/",
        host: "radioplayer.fr",
        badge: "🇫🇷 Recommandé",
        icon: RadioTower,
        accent: "#c5221f",
        recommended: true,
      },
    ],
  },
  {
    title: "Podcasts",
    note: "Contenus fournis par leurs éditeurs : Ruches n’héberge aucun programme. Si Deezer refuse l’accès avec un VPN, essayez sans VPN ou utilisez Radioplayer.",
    items: [
      {
        name: "Podcasts des radios",
        description: "Podcasts et rediffusions des radios françaises sur Radioplayer.",
        url: "https://www.radioplayer.fr/",
        host: "radioplayer.fr",
        badge: "🇫🇷 Radios",
        icon: Rss,
        accent: "#c5221f",
      },
      {
        name: "Podcasts sur Deezer",
        description: "Catalogue de podcasts de Deezer, service français de streaming.",
        url: "https://www.deezer.com/fr/channels/podcasts",
        host: "deezer.com",
        badge: "🇫🇷 Deezer",
        icon: Music2,
        accent: "#a21caf",
      },
    ],
  },
];

export const radioStations: Array<{ name: string; url: string }> = [
  { name: "France Inter", url: "https://www.radiofrance.fr/franceinter" },
  { name: "franceinfo", url: "https://www.radiofrance.fr/franceinfo" },
  { name: "FIP", url: "https://www.radiofrance.fr/fip" },
  { name: "France Culture", url: "https://www.radiofrance.fr/franceculture" },
  { name: "France Musique", url: "https://www.radiofrance.fr/francemusique" },

  { name: "RTL", url: "https://www.rtl.fr/" },
  { name: "Europe 1", url: "https://www.europe1.fr/" },
  { name: "RMC", url: "https://rmc.bfmtv.com/" },
  { name: "NRJ", url: "https://www.nrj.fr/" },
  { name: "Skyrock", url: "https://www.skyrock.fm/" },
  { name: "Fun Radio", url: "https://www.funradio.fr/" },
  { name: "RTL2", url: "https://www.rtl2.fr/" },
  { name: "Nostalgie", url: "https://www.nostalgie.fr/" },
  { name: "RFM", url: "https://www.rfm.fr/" },
  { name: "Chérie FM", url: "https://www.cheriefm.fr/" },
];

// TV : chaînes publiques françaises d'abord, puis les autres plateformes.
export const tvGroups: LinkGroup[] = [
  {
    title: "Chaînes publiques françaises",
    items: [
      {
        name: "france.tv",
        description: "France 2, France 3, France 4, France 5 et franceinfo : direct et replay gratuits.",
        url: "https://www.france.tv/",
        host: "france.tv",
        badge: "🇫🇷 Gratuit",
        icon: Tv,
        accent: "#1d4ed8",
        recommended: true,
      },
    ],
  },
  {
    title: "Autres chaînes et plateformes",
    note: "Direct et replay selon le service ; certaines offres nécessitent un compte ou un abonnement.",
    items: [
      {
        name: "TF1+",
        description: "Direct et replay du groupe TF1, avec création de compte.",
        url: "https://www.tf1.fr/",
        host: "tf1.fr",
        badge: "🇫🇷 Compte requis",
        icon: MonitorPlay,
        accent: "#0ea5e9",
      },
      {
        name: "M6+",
        description: "Direct et replay du groupe M6, avec création de compte.",
        url: "https://www.m6.fr/",
        host: "m6.fr",
        badge: "🇫🇷 Compte requis",
        icon: MonitorPlay,
        accent: "#7c3aed",
      },
      {
        name: "ARTE",
        description: "Chaîne culturelle franco-allemande 🇫🇷🇩🇪, en accès libre.",
        url: "https://www.arte.tv/fr/",
        host: "arte.tv",
        badge: "🇫🇷🇩🇪 Gratuit",
        icon: Tv,
        accent: "#f97316",
      },
      {
        name: "CANAL+",
        description: "Chaînes et contenus CANAL+, selon offre et abonnement.",
        url: "https://www.canalplus.com/",
        host: "canalplus.com",
        badge: "🇫🇷 Abonnement",
        icon: MonitorPlay,
        accent: "#111827",
      },
    ],
  },
  {
    title: "Plus de choix",
    secondary: true,
    note: "Chaînes parlementaires et publiques, en direct et en rediffusion.",
    items: [
      {
        name: "LCP – Assemblée nationale",
        description: "Séances, débats et magazines de la chaîne parlementaire.",
        url: "https://www.lcp.fr/",
        host: "lcp.fr",
        badge: "🇫🇷 Public",
        icon: Landmark,
        accent: "#1d4ed8",
      },
      {
        name: "Public Sénat",
        description: "Travaux du Sénat, débats et documentaires en accès libre.",
        url: "https://www.publicsenat.fr/",
        host: "publicsenat.fr",
        badge: "🇫🇷 Public",
        icon: Landmark,
        accent: "#0f766e",
      },
    ],
  },
];


export const mailGroups: LinkGroup[] = [
  {
    title: "Messageries françaises",
    items: [
      {
        name: "Mailo",
        description: "Mail, agenda et cloud, données hébergées en France.",
        url: "https://www.mailo.com/fr/",
        host: "mailo.com",
        badge: "🇫🇷 Recommandé",
        icon: Mail,
        accent: "#2b6cb0",
        recommended: true,
      },
      {
        name: "Laposte.net",
        description: "Boîte mail gratuite du groupe La Poste.",
        url: "https://www.laposte.net/accueil",
        host: "laposte.net",
        badge: "🇫🇷 Gratuit",
        icon: Mail,
        accent: "#1a73e8",
      },
    ],
  },
  {
    title: "Exception historique",
    secondary: true,
    note: "CaraMail, service historique français, existe aujourd’hui via GMX CaraMail, opéré par un acteur allemand.",
    items: [
      {
        name: "GMX CaraMail",
        description: "Service allemand qui héberge aujourd’hui les adresses CaraMail.",
        url: "https://www.gmx.fr/",
        host: "gmx.fr",
        badge: "🇩🇪 Exception historique",
        icon: Mail,
        accent: "#6b7280",
      },
    ],
  },
  {
    title: "Plus de choix",
    secondary: true,
    items: [
      {
        name: "Proton Mail",
        description: "Messagerie suisse chiffrée de bout en bout, éditée par Proton AG.",
        url: "https://proton.me/fr/mail",
        host: "proton.me",
        badge: "🇨🇭 Alternative indépendante",
        icon: MessageSquareLock,
        accent: "#6b7280",
      },
    ],
  },

];

export const messagingGroups: LinkGroup[] = [
  {
    title: "Messageries françaises",
    items: [
      {
        name: "Olvid",
        description: "Messagerie française chiffrée, sans numéro de téléphone ni annuaire.",
        url: "https://www.olvid.io/fr/",
        host: "olvid.io",
        badge: "🇫🇷 Recommandé",
        icon: MessageSquareLock,
        accent: "#0f766e",
        recommended: true,
      },
      {
        name: "Skred",
        description: "Messagerie française orientée confidentialité.",
        url: "https://skred.mobi/",
        host: "skred.mobi",
        badge: "🇫🇷 Confidentialité",
        icon: MessageCircleMore,
        accent: "#1a73e8",
      },
      {
        name: "Treebal",
        description: "Messagerie française chiffrée et écoresponsable.",
        url: "https://www.treebal.green/",
        host: "treebal.green",
        badge: "🇫🇷 Écoresponsable",
        icon: Sprout,
        accent: "#15803d",
      },
    ],
  },
  {
    title: "Alternatives indépendantes à l’étranger",
    secondary: true,
    items: [
      {
        name: "Signal",
        description: "Organisme indépendant à but non lucratif, sans publicité ni trackers.",
        url: "https://signal.org/",
        host: "signal.org",
        badge: "🇺🇸 Indépendant",
        icon: MessageSquareLock,
        accent: "#6b7280",
      },
      {
        name: "Threema",
        description: "Messagerie suisse payante, utilisable sans numéro de téléphone.",
        url: "https://threema.ch/fr",
        host: "threema.ch",
        badge: "🇨🇭 Indépendant",
        icon: MessageSquareLock,
        accent: "#6b7280",
      },
    ],
  },
];

// Itinéraires : plusieurs solutions françaises pour qu'une panne n'empêche pas de préparer un trajet.
export const routeGroups: LinkGroup[] = [
  {
    title: "Itinéraires en France",
    items: [
      {
        name: "Mappy",
        description: "Itinéraires voiture, transports et à pied, service français historique.",
        url: "https://fr.mappy.com/",
        host: "fr.mappy.com",
        badge: "🇫🇷 Recommandé",
        icon: Navigation,
        accent: "#7c3aed",
        recommended: true,
      },
      {
        name: "ViaMichelin",
        description: "Itinéraires, coûts de trajet et cartes routières Michelin.",
        url: "https://www.viamichelin.fr/",
        host: "viamichelin.fr",
        badge: "🇫🇷 Itinéraires",
        icon: Map,
        accent: "#1d4ed8",
      },
    ],
  },
  {
    title: "Plus de choix",
    secondary: true,
    items: [
      {
        name: "cartes.gouv.fr (IGN)",
        description: "Cartes officielles de l’Institut national de l’information géographique et forestière.",
        url: "https://cartes.gouv.fr/",
        host: "cartes.gouv.fr",
        badge: "🇫🇷 Public",
        icon: Map,
        accent: "#15803d",
      },
      {
        name: "SNCF Connect",
        description: "Trajets en train et mobilité longue distance.",
        url: "https://www.sncf-connect.com/",
        host: "sncf-connect.com",
        badge: "🇫🇷 Train",
        icon: TrainFront,
        accent: "#7c3aed",
      },
    ],
  },
];

export const musicGroups: LinkGroup[] = [
  {
    title: "Musique en ligne",
    note: "Si Deezer refuse l’accès avec un VPN, essayez sans VPN ou utilisez Radioplayer.",
    items: [
      {
        name: "Deezer",
        description: "Service français de streaming musical et de podcasts.",
        url: "https://www.deezer.com/fr/",
        host: "deezer.com",
        badge: "🇫🇷 Recommandé",
        icon: Music2,
        accent: "#a21caf",
        recommended: true,
      },
      {
        name: "Qobuz",
        description: "Plateforme française de streaming et de téléchargement en haute qualité.",
        url: "https://www.qobuz.com/fr-fr/",
        host: "qobuz.com",
        badge: "🇫🇷 Haute qualité",
        icon: Music2,
        accent: "#0f766e",
      },
    ],
  },
  {
    title: "Plus de choix",
    secondary: true,
    items: [
      {
        name: "Radioplayer France",
        description: "Radios, webradios musicales et podcasts, sans compte.",
        url: "https://www.radioplayer.fr/",
        host: "radioplayer.fr",
        badge: "🇫🇷 Gratuit",
        icon: RadioTower,
        accent: "#c5221f",
      },
    ],
  },
];




export type UsefulSite = {
  name: string;
  description: string;
  url: string;
  host: string;
  badge: string;
  icon: LucideIcon;
  accent: string;
};

export type UsefulGroup = { title: string; items: UsefulSite[] };

export const usefulGroups: UsefulGroup[] = [
  {
    title: "Démarches & services publics",
    items: [
      { name: "Service-Public", description: "Démarches et informations administratives.", url: "https://www.service-public.gouv.fr/", host: "service-public.gouv.fr", badge: "Public", icon: Landmark, accent: "#1a73e8" },
      { name: "Ameli", description: "Assurance Maladie, remboursements et carte Vitale.", url: "https://www.ameli.fr/", host: "ameli.fr", badge: "Public", icon: HeartPulse, accent: "#0e7490" },
      { name: "Impots.gouv", description: "Impôts, déclaration et démarches fiscales.", url: "https://www.impots.gouv.fr/accueil", host: "impots.gouv.fr", badge: "Public", icon: Receipt, accent: "#7c3aed" },
      { name: "France Travail", description: "Emploi, inscription et démarches.", url: "https://www.francetravail.fr/accueil/", host: "francetravail.fr", badge: "Public", icon: Briefcase, accent: "#c2410c" },
      { name: "Mes Droits Sociaux", description: "Droits et aides sociales en un seul point d’entrée.", url: "https://www.mesdroitssociaux.gouv.fr/accueil/", host: "mesdroitssociaux.gouv.fr", badge: "Public", icon: HandCoins, accent: "#15803d" },
    ],
  },
  {
    title: "Quotidien",
    items: [
      { name: "leboncoin", description: "Petites annonces entre particuliers et pros.", url: "https://www.leboncoin.fr/", host: "leboncoin.fr", badge: "Quotidien", icon: ShoppingBag, accent: "#ea580c" },
      { name: "Gens de Confiance", description: "Petites annonces sur recommandation.", url: "https://gensdeconfiance.com/fr", host: "gensdeconfiance.com", badge: "Quotidien", icon: Handshake, accent: "#0f766e" },
      { name: "Doctolib", description: "Rendez-vous de santé et téléconsultation.", url: "https://www.doctolib.fr/", host: "doctolib.fr", badge: "Santé", icon: HeartPulse, accent: "#2563eb" },
      { name: "SNCF Connect", description: "Trains, billets et mobilité.", url: "https://www.sncf-connect.com/", host: "sncf-connect.com", badge: "Mobilité", icon: TrainFront, accent: "#7c3aed" },
    ],
  },
  {
    title: "Info, études & tech",
    items: [
      { name: "Actu.fr", description: "Actualités locales et nationales.", url: "https://actu.fr/", host: "actu.fr", badge: "Actu", icon: Radio, accent: "#c5221f" },
      { name: "L’Étudiant", description: "Orientation, études, jobs et alternance.", url: "https://www.letudiant.fr/", host: "letudiant.fr", badge: "Études", icon: GraduationCap, accent: "#1d4ed8" },
      { name: "Les Numériques", description: "Tests et actualité tech.", url: "https://www.lesnumeriques.com/", host: "lesnumeriques.com", badge: "Tech", icon: Cpu, accent: "#0891b2" },
      { name: "Gallica (BnF)", description: "Bibliothèque numérique de la Bibliothèque nationale de France.", url: "https://gallica.bnf.fr/accueil/fr/content/accueil-fr", host: "gallica.bnf.fr", badge: "Culture", icon: LibraryBig, accent: "#7c3aed" },
      { name: "France Identité", description: "Identité numérique officielle et justificatifs sécurisés.", url: "https://france-identite.gouv.fr/", host: "france-identite.gouv.fr", badge: "Public", icon: ShieldCheck, accent: "#1a73e8" },
    ],
  },

];


export type ForumCommunity = {
  name: string;
  description: string;
  url: string;
  host: string;
  badge: string;
  icon: LucideIcon;
  accent: string;
  recommended?: boolean;
};

export const forumCommunities: ForumCommunity[] = [
  {
    name: "Piaille",
    description: "Communauté française du Fediverse / Mastodon, pour les échanges publics.",
    url: "https://piaille.fr/",
    host: "piaille.fr",
    badge: "🇫🇷 Fediverse",
    icon: MessageCircleMore,
    accent: "#6366f1",
    recommended: true,
  },
  {
    name: "Whaller",
    description: "Réseau social et communautés, solution française hébergée en France.",
    url: "https://whaller.com/fr",
    host: "whaller.com",
    badge: "🇫🇷 Souverain",
    icon: UsersRound,
    accent: "#1a73e8",
  },

  {
    name: "BeReal",
    description: "Réseau social français centré sur les moments du quotidien.",
    url: "https://bereal.com/fr/",
    host: "bereal.com",
    badge: "🇫🇷 Grand public",
    icon: Users,
    accent: "#111827",
  },
  {
    name: "Copains d’avant",
    description: "Retrouver d’anciens camarades, photos de classe et connaissances.",
    url: "https://copainsdavant.linternaute.com/",
    host: "copainsdavant.linternaute.com",
    badge: "🇫🇷 Réseau historique",
    icon: UserSearch,
    accent: "#0f766e",
  },
  {
    name: "Fraternité du Scoutisme",
    description: "Communauté et ressources autour du scoutisme et de l’interscoutisme.",
    url: "https://www.fraternite.net/",
    host: "fraternite.net",
    badge: "🇫🇷 Scoutisme",
    icon: TentTree,
    accent: "#15803d",
  },
  {
    name: "Forums JV",
    description: "Forums communautaires français historiques et toujours actifs.",
    url: "https://www.jeuxvideo.com/forums.htm",
    host: "jeuxvideo.com",
    badge: "🇫🇷 Forum",
    icon: MessagesSquare,
    accent: "#c5221f",
  },
  {
    name: "Skyrock Chat",
    description: "Chat et communauté Skyrock ; un compte ou l’application peut être nécessaire.",
    url: "https://skyrock.com/chat",
    host: "skyrock.com",
    badge: "🇫🇷 Chat / communauté",
    icon: MessageCircleMore,
    accent: "#f97316",
  },
];


export type GoodCause = {
  name: string;
  description: string;
  url: string;
  host: string;
  badge: string;
  icon: LucideIcon;
  accent: string;
};

// URLs vérifiées (HTTP 200 en suivant les redirections) avant intégration.
export const goodCauses: GoodCause[] = [
  {
    name: "Restos du Cœur",
    description: "Aide alimentaire, actions de terrain, dons et bénévolat.",
    url: "https://www.restosducoeur.org/",
    host: "restosducoeur.org",
    badge: "Solidarité",
    icon: HandHeart,
    accent: "#c2185b",
  },
  {
    name: "SPA",
    description: "Protection animale, refuges et adoptions.",
    url: "https://www.la-spa.fr/",
    host: "la-spa.fr",
    badge: "Animaux",
    icon: PawPrint,
    accent: "#15803d",
  },
  {
    name: "Croix-Rouge française",
    description: "Aide humanitaire, secourisme et action sociale.",
    url: "https://www.croix-rouge.fr/",
    host: "croix-rouge.fr",
    badge: "Humanitaire",
    icon: Cross,
    accent: "#c5221f",
  },
  {
    name: "Secours populaire",
    description: "Lutte contre la précarité et solidarité de proximité.",
    url: "https://www.secourspopulaire.fr/",
    host: "secourspopulaire.fr",
    badge: "Solidarité",
    icon: Handshake,
    accent: "#0f766e",
  },
  {
    name: "Fondation de France",
    description: "Soutien à de nombreuses causes d’intérêt général.",
    url: "https://www.fondationdefrance.org/fr/",
    host: "fondationdefrance.org",
    badge: "Causes multiples",
    icon: Sprout,
    accent: "#7c3aed",
  },
  {
    name: "Téléthon (AFM-Téléthon)",
    description: "Recherche sur les maladies rares et soutien aux malades.",
    url: "https://www.telethon.fr/",
    host: "telethon.fr",
    badge: "Recherche",
    icon: Heart,
    accent: "#1d4ed8",
  },
];
