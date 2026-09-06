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

