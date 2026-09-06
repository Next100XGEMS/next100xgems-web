export const networkChannels = [
  ["X", "Fast market commentary, research distribution, and live narratives."],
  ["Telegram", "Community updates, research and Radar distribution, and announcements."],
  ["YouTube", "Longer-form explainers, interviews, and educational media content."],
  ["Instagram", "Visual crypto media, short-form content, and brand distribution."],
] as const;

export const networkFlow = [
  ["01", "RESEARCH / RADAR / EDITORIAL", "An idea, signal, or piece of context is prepared."],
  ["02", "CONTENT PRODUCTION", "The material is shaped for its intended format and audience."],
  ["03", "CHANNEL DISTRIBUTION", "Approved content moves through applicable media inventory."],
  ["04", "AUDIENCE INTERACTION", "Readers and viewers respond, ask questions, and carry the context forward."],
] as const;

export const organicContentTypes = [
  "Market Intelligence",
  "Research",
  "Radar Updates",
  "Editorial",
  "Visual Content",
  "Short-form Distribution",
] as const;

export const commercialContentTypes = [
  "Sponsored Content",
  "AMA / Interviews",
  "Launch Campaigns",
  "Multi-platform Media Campaigns",
] as const;

export const commercialServices = [
  ["Sponsored Content", "Disclosed paid content built around an agreed brief.", "Sponsored editorial-style asset or placement."],
  ["X Campaigns", "Focused distribution for announcements, narratives, or launches.", "Agreed posts and campaign sequencing."],
  ["Telegram Campaigns", "Community-facing updates and campaign distribution.", "Channel-ready announcements or campaign assets."],
  ["AMA", "A structured conversation for a community or project moment.", "Planned session format and supporting promotion."],
  ["Launch Campaigns", "A coordinated media path for a product or ecosystem announcement.", "Launch content and agreed channel distribution."],
  ["Content Production", "Clear, crypto-native creative and editorial production.", "Written, visual, video, or short-form content."],
  ["Multi-platform Distribution", "A single campaign shaped for applicable channel types.", "Cross-channel content plan and delivery scope."],
] as const;

export const campaignTypes = [
  "Project Awareness",
  "Product / Feature Launch",
  "Token / Ecosystem Announcement",
  "AMA / Community Session",
  "Research / Sponsored Education",
  "Multi-platform Media Campaign",
] as const;

export const engagementStages = [
  ["01", "INQUIRY", "Share campaign context, goals, links, and relevant constraints."],
  ["02", "REVIEW", "NEXT100XGEMS reviews fit, claims, links, and campaign needs."],
  ["03", "PLAN", "Agree scope, channels, timing, deliverables, and disclosure treatment."],
  ["04", "PRODUCTION", "Prepare the approved content, creative, or campaign assets."],
  ["05", "DISTRIBUTION", "Distribute through the agreed inventory and applicable channels."],
  ["06", "REPORT", "Where supported later, review delivery and results in context."],
] as const;

export const sponsorReviewReasons = [
  "Phishing, drainers, or impersonation.",
  "Fake presales or guaranteed-return claims.",
  "Misleading yield or APY claims.",
  "Deceptive creative or obvious pump-and-dump promotion.",
] as const;

export const partnerVisibilityOptions = [
  ["Homepage Featured Partners", "A clearly disclosed place in the homepage commercial relationship section when applicable."],
  ["Partners directory presence", "A directory entry when a partner relationship is published."],
  ["Dedicated partner profile", "A focused overview with official links and relevant commercial context when a profile is created."],
  ["Sponsored coverage context", "Links to applicable sponsored coverage, without presenting it as independent research."],
  ["Multi-platform opportunities", "Channel distribution shaped around the agreed scope rather than assumed for every partner."],
] as const;

export const partnerReviewPrinciples = [
  "Official project presence and website/social consistency.",
  "Claims used in campaign material and their supporting context.",
  "Contract or token information where relevant to the campaign.",
  "Obvious security, impersonation, phishing, or scam indicators.",
  "Required commercial disclosures and destination-link clarity.",
] as const;

export const advertisingInventoryCategories = [
  ["Homepage", "Premium Spotlight, Mid-page Native, and Research Sponsor contexts.", "HP-01 / HP-02 / HP-03"],
  ["Research", "Article Header, Inline Native, and Sidebar contexts.", "RS-01 / RS-02 / RS-03"],
  ["Radar-adjacent", "Radar Native and Category Sponsor contexts, kept separate from Radar output.", "RD-01 / RD-02"],
  ["Featured Partners", "Featured Partner and Partner Directory commercial contexts.", "PT-01 / PT-02"],
  ["Social / Network Distribution", "Applicable channel distribution agreed as part of a campaign scope.", "SCOPED"],
] as const;

export const advertisingFormats = [
  ["Native Sponsored Cards", "Site-fitting cards that remain visibly labeled SPONSORED and do not imitate a Radar signal."],
  ["Contextual Display Placements", "Display placements near relevant content without impersonating editorial or research output."],
  ["Section Sponsorships", "A labeled presentation such as “Market Overview presented by PROJECT” or “Weekly Research presented by PROJECT.”"],
] as const;

export const advertisingPlacements = [
  ["Homepage", "HP-01", "Premium Spotlight"],
  ["Homepage", "HP-02", "Mid-page Native"],
  ["Homepage", "HP-03", "Research Sponsor"],
  ["Research", "RS-01", "Article Header"],
  ["Research", "RS-02", "Inline Native"],
  ["Research", "RS-03", "Sidebar"],
  ["Radar", "RD-01", "Radar Native"],
  ["Radar", "RD-02", "Category Sponsor"],
  ["Partners", "PT-01", "Featured Partner"],
  ["Partners", "PT-02", "Partner Directory"],
] as const;

export const plannedReportingMetrics = [
  "Impressions and unique views",
  "Clicks and CTR",
  "Device and geography context",
  "Campaign duration",
  "Page and placement breakdown",
] as const;

export const creativeStandards = [
  "Paid placement must be clearly labeled.",
  "No deceptive buttons or fake download UI.",
  "No flashing token ads or autoplay sound.",
  "No ad may impersonate Radar, Research, or an organic trending status.",
  "No guaranteed-return claims or obvious malicious/scam creative.",
  "The experience uses restrained density and fewer placements on mobile.",
] as const;
