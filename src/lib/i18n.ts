/**
 * Lightweight i18n — no extra dependencies.
 *
 * Translations are bundled JSON-style maps keyed by locale. Falls back to
 * English for missing keys. Right-to-left handling exposed via `isRtl`.
 *
 * For aviation-specific terminology, native-speaking AME translators are the
 * gold standard. The strings here are a baseline so the app boots in each
 * language.
 */
import { useEffect, useState, useCallback } from "react";

export type Locale = "en" | "es" | "fr" | "pt" | "ar" | "zh" | "hi" | "ru";

export const LOCALES: { id: Locale; name: string; native: string; rtl?: boolean }[] = [
  { id: "en", name: "English",     native: "English" },
  { id: "es", name: "Spanish",     native: "Español" },
  { id: "fr", name: "French",      native: "Français" },
  { id: "pt", name: "Portuguese",  native: "Português" },
  { id: "ar", name: "Arabic",      native: "العربية", rtl: true },
  { id: "zh", name: "Chinese",     native: "中文" },
  { id: "hi", name: "Hindi",       native: "हिन्दी" },
  { id: "ru", name: "Russian",     native: "Русский" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "nav.home": "Home",
  "nav.logs": "Logs",
  "nav.search": "Search",
  "nav.readiness": "Readiness",
  "nav.more": "More",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.loading": "Loading…",
  "common.empty": "Nothing here yet.",
  "common.add": "Add",
  "common.close": "Close",

  "log.new": "New Log",
  "log.fault": "Fault description",
  "log.action": "Action taken",
  "log.ata": "ATA chapter",
  "log.hours": "Hours",
  "log.signed": "Signed",
  "log.locked": "Locked",
  "log.cosign_request": "Request co-sign",

  "components.title": "Components",
  "components.tsn": "TSN",
  "components.tso": "TSO",
  "components.cycles": "Cycles",
  "components.installed": "Installed",
  "components.removed": "Removed",
  "components.hard_time": "Hard-time limit",

  "adsb.title": "AD / SB Compliance",
  "adsb.open": "Open",
  "adsb.complied": "Complied",
  "adsb.due_date": "Next due",

  "tools.title": "Tool Calibration",
  "tools.next_cal": "Next calibration",
  "tools.overdue": "Overdue",
  "tools.due": "Due soon",
  "tools.in_service": "In service",

  "cpd.title": "Continuing Professional Development",
  "cpd.hours_24mo": "Hours in last 24 months",

  "type_rating.title": "Type Ratings",

  "jobs.title": "Aviation Jobs",
  "jobs.post": "Post a job",
  "jobs.contact": "Contact",

  "verify.title": "Get Verified",
  "verify.unverified": "Unverified",
  "verify.pending": "Verification pending",
  "verify.verified": "Verified AME",
  "verify.rejected": "Verification rejected",

  "privacy.export": "Export my data",
  "privacy.delete": "Delete my data",
};

const es: Dict = {
  "nav.home": "Inicio",
  "nav.logs": "Registros",
  "nav.search": "Buscar",
  "nav.readiness": "Preparación",
  "nav.more": "Más",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.edit": "Editar",
  "common.loading": "Cargando…",
  "common.empty": "Nada aquí todavía.",
  "common.add": "Añadir",
  "common.close": "Cerrar",
  "log.new": "Nuevo registro",
  "log.fault": "Descripción de la avería",
  "log.action": "Acción tomada",
  "log.ata": "Capítulo ATA",
  "log.hours": "Horas",
  "log.signed": "Firmado",
  "log.locked": "Bloqueado",
  "log.cosign_request": "Solicitar firma conjunta",
  "components.title": "Componentes",
  "components.tsn": "TSN",
  "components.tso": "TSO",
  "components.cycles": "Ciclos",
  "components.installed": "Instalado",
  "components.removed": "Retirado",
  "components.hard_time": "Límite hard-time",
  "adsb.title": "Cumplimiento AD / SB",
  "adsb.open": "Abierto",
  "adsb.complied": "Cumplido",
  "adsb.due_date": "Próximo vencimiento",
  "tools.title": "Calibración de herramientas",
  "tools.next_cal": "Próxima calibración",
  "tools.overdue": "Vencida",
  "tools.due": "Próxima",
  "tools.in_service": "En servicio",
  "cpd.title": "Formación continua profesional",
  "cpd.hours_24mo": "Horas en los últimos 24 meses",
  "type_rating.title": "Habilitaciones de tipo",
  "jobs.title": "Empleos aeronáuticos",
  "jobs.post": "Publicar un empleo",
  "jobs.contact": "Contacto",
  "verify.title": "Obtener verificación",
  "verify.unverified": "Sin verificar",
  "verify.pending": "Verificación pendiente",
  "verify.verified": "AME verificado",
  "verify.rejected": "Verificación rechazada",
  "privacy.export": "Exportar mis datos",
  "privacy.delete": "Eliminar mis datos",
};

const fr: Dict = {
  "nav.home": "Accueil",
  "nav.logs": "Registres",
  "nav.search": "Recherche",
  "nav.readiness": "Préparation",
  "nav.more": "Plus",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.loading": "Chargement…",
  "common.empty": "Rien ici pour le moment.",
  "common.add": "Ajouter",
  "common.close": "Fermer",
  "log.new": "Nouveau registre",
  "log.fault": "Description de la panne",
  "log.action": "Action effectuée",
  "log.ata": "Chapitre ATA",
  "log.hours": "Heures",
  "log.signed": "Signé",
  "log.locked": "Verrouillé",
  "log.cosign_request": "Demander une co-signature",
  "components.title": "Composants",
  "components.tsn": "TSN",
  "components.tso": "TSO",
  "components.cycles": "Cycles",
  "components.installed": "Installé",
  "components.removed": "Déposé",
  "components.hard_time": "Limite hard-time",
  "adsb.title": "Conformité AD / SB",
  "adsb.open": "Ouvert",
  "adsb.complied": "Conforme",
  "adsb.due_date": "Prochaine échéance",
  "tools.title": "Étalonnage des outils",
  "tools.next_cal": "Prochain étalonnage",
  "tools.overdue": "En retard",
  "tools.due": "Bientôt dû",
  "tools.in_service": "En service",
  "cpd.title": "Formation continue",
  "cpd.hours_24mo": "Heures sur 24 derniers mois",
  "type_rating.title": "Qualifications de type",
  "jobs.title": "Emplois aéronautiques",
  "jobs.post": "Publier un emploi",
  "jobs.contact": "Contact",
  "verify.title": "Obtenir la vérification",
  "verify.unverified": "Non vérifié",
  "verify.pending": "Vérification en cours",
  "verify.verified": "AME vérifié",
  "verify.rejected": "Vérification refusée",
  "privacy.export": "Exporter mes données",
  "privacy.delete": "Supprimer mes données",
};

const pt: Dict = {
  "nav.home": "Início",
  "nav.logs": "Registros",
  "nav.search": "Buscar",
  "nav.readiness": "Prontidão",
  "nav.more": "Mais",
  "common.save": "Salvar",
  "common.cancel": "Cancelar",
  "common.delete": "Excluir",
  "common.edit": "Editar",
  "common.loading": "Carregando…",
  "common.empty": "Nada aqui ainda.",
  "common.add": "Adicionar",
  "common.close": "Fechar",
  "log.new": "Novo registro",
  "log.fault": "Descrição da falha",
  "log.action": "Ação tomada",
  "log.ata": "Capítulo ATA",
  "log.hours": "Horas",
  "log.signed": "Assinado",
  "log.locked": "Bloqueado",
  "log.cosign_request": "Solicitar contra-assinatura",
  "components.title": "Componentes",
  "components.tsn": "TSN",
  "components.tso": "TSO",
  "components.cycles": "Ciclos",
  "components.installed": "Instalado",
  "components.removed": "Removido",
  "components.hard_time": "Limite hard-time",
  "adsb.title": "Cumprimento AD / SB",
  "adsb.open": "Aberto",
  "adsb.complied": "Cumprido",
  "adsb.due_date": "Próximo vencimento",
  "tools.title": "Calibração de ferramentas",
  "tools.next_cal": "Próxima calibração",
  "tools.overdue": "Vencida",
  "tools.due": "Próxima",
  "tools.in_service": "Em serviço",
  "cpd.title": "Desenvolvimento profissional contínuo",
  "cpd.hours_24mo": "Horas nos últimos 24 meses",
  "type_rating.title": "Habilitações de tipo",
  "jobs.title": "Vagas em aviação",
  "jobs.post": "Publicar vaga",
  "jobs.contact": "Contato",
  "verify.title": "Obter verificação",
  "verify.unverified": "Não verificado",
  "verify.pending": "Verificação pendente",
  "verify.verified": "AME verificado",
  "verify.rejected": "Verificação rejeitada",
  "privacy.export": "Exportar meus dados",
  "privacy.delete": "Excluir meus dados",
};

const ar: Dict = {
  "nav.home": "الرئيسية",
  "nav.logs": "السجلات",
  "nav.search": "بحث",
  "nav.readiness": "الجاهزية",
  "nav.more": "المزيد",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.loading": "جارٍ التحميل…",
  "common.empty": "لا يوجد شيء هنا بعد.",
  "common.add": "إضافة",
  "common.close": "إغلاق",
  "log.new": "سجل جديد",
  "log.fault": "وصف العطل",
  "log.action": "الإجراء المتخذ",
  "log.ata": "فصل ATA",
  "log.hours": "ساعات",
  "log.signed": "موقّع",
  "log.locked": "مقفل",
  "log.cosign_request": "طلب توقيع مشترك",
  "components.title": "المكونات",
  "components.tsn": "TSN",
  "components.tso": "TSO",
  "components.cycles": "الدورات",
  "components.installed": "مُركَّب",
  "components.removed": "مفكوك",
  "components.hard_time": "حد الزمن الصلب",
  "adsb.title": "الامتثال AD / SB",
  "adsb.open": "مفتوح",
  "adsb.complied": "ممتثل",
  "adsb.due_date": "الاستحقاق القادم",
  "tools.title": "معايرة الأدوات",
  "tools.next_cal": "المعايرة القادمة",
  "tools.overdue": "متأخر",
  "tools.due": "قريب الاستحقاق",
  "tools.in_service": "في الخدمة",
  "cpd.title": "التطوير المهني المستمر",
  "cpd.hours_24mo": "الساعات في آخر 24 شهرًا",
  "type_rating.title": "تأهيلات النوع",
  "jobs.title": "وظائف الطيران",
  "jobs.post": "نشر وظيفة",
  "jobs.contact": "اتصال",
  "verify.title": "الحصول على التحقق",
  "verify.unverified": "غير موثّق",
  "verify.pending": "التحقق قيد المراجعة",
  "verify.verified": "AME موثّق",
  "verify.rejected": "تم رفض التحقق",
  "privacy.export": "تصدير بياناتي",
  "privacy.delete": "حذف بياناتي",
};

// Stubs for zh / hi / ru — fall back to English. Real translations to follow.
const stub: Dict = {};

const DICTS: Record<Locale, Dict> = { en, es, fr, pt, ar, zh: stub, hi: stub, ru: stub };

const STORAGE_KEY = "amel.locale";

export function getLocale(): Locale {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && DICTS[stored]) return stored;
  // Auto-detect from browser
  if (typeof navigator !== "undefined") {
    const lang = navigator.language.slice(0, 2) as Locale;
    if (DICTS[lang]) return lang;
  }
  return "en";
}

export function setLocale(loc: Locale) {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, loc);
  if (typeof document !== "undefined") {
    document.documentElement.lang = loc;
    document.documentElement.dir = isRtl(loc) ? "rtl" : "ltr";
  }
  // Notify listeners
  if (typeof window !== "undefined") window.dispatchEvent(new Event("amel-locale-changed"));
}

export function isRtl(loc: Locale): boolean {
  return LOCALES.find((l) => l.id === loc)?.rtl ?? false;
}

export function t(key: string, loc?: Locale): string {
  const locale = loc ?? getLocale();
  return DICTS[locale]?.[key] ?? DICTS.en[key] ?? key;
}

/** React hook — returns translator + locale + setLocale. */
export function useT() {
  const [locale, setL] = useState<Locale>(getLocale());
  useEffect(() => {
    const handler = () => setL(getLocale());
    if (typeof window !== "undefined") window.addEventListener("amel-locale-changed", handler);
    return () => { if (typeof window !== "undefined") window.removeEventListener("amel-locale-changed", handler); };
  }, []);
  const translate = useCallback((key: string) => t(key, locale), [locale]);
  return { t: translate, locale, setLocale };
}
